import {
  adcConfig, AVRADC, AVRIOPort, AVRTimer, AVRTWI, AVRUSART, avrInstruction, CPU, NoopTWIEventHandler, PinState,
  portBConfig, portCConfig, portDConfig, timer0Config, timer1Config, timer2Config, twiConfig, usart0Config, type TWIEventHandler,
} from 'avr8js';
import { pwmDuty } from './pwm';
import { unoPin, type Port } from './unoPins';

export const CPU_HZ = 16_000_000;
const CYCLES_PER_MS = CPU_HZ / 1000;
const CHUNK = 1000; // instructions between wall-clock checks
const RAMEND = 0x8ff;

type Machine = { cpu: CPU; ports: Record<Port, AVRIOPort>; usart: AVRUSART; adc: AVRADC; timers: AVRTimer[]; twi: AVRTWI };
export type PinWatcher = (pin: number, high: boolean) => void;
const PORT_PINS: Record<Port, number[]> = { D: [0, 1, 2, 3, 4, 5, 6, 7], B: [8, 9, 10, 11, 12, 13], C: [14, 15, 16, 17, 18, 19] };
export type PinMode = 'input' | 'input-pullup' | 'output';

// A simulated ATmega328P running a compiled program (avr8js): the Uno's pins, Serial and analog inputs.
// Time is simulated (CPU cycles at 16 MHz), so programs behave exactly as on hardware even when the host is slower.
export class AvrRunner {
  private m!: Machine;
  private readonly inputs = new Map<number, boolean | null>(); // externally driven input pins (null = floating)
  private readonly analog: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private rxQueue: number[] = [];
  private watchers: PinWatcher[] = [];       // told of every pin level change, the moment the program makes it
  private levels: boolean[] = new Array(20).fill(false);
  private twiDevice: ((twi: AVRTWI) => TWIEventHandler) | null = null; // what answers on the I²C bus (A4/A5)
  private tx = '';
  lastTxSimMs = -Infinity;

  constructor(private readonly flash: Uint8Array) { this.boot(); }

  get simMs(): number { return this.m.cpu.cycles / CYCLES_PER_MS; }
  get machine(): Machine { return this.m; }

  // Power-on / reset button: the chip restarts the program from the beginning (peripherals rebuilt fresh).
  reset(): void { this.boot(); }

  private boot() {
    const progMem = new Uint16Array(this.flash.buffer.slice(this.flash.byteOffset, this.flash.byteOffset + this.flash.byteLength));
    const cpu = new CPU(progMem);
    const ports = { B: new AVRIOPort(cpu, portBConfig), C: new AVRIOPort(cpu, portCConfig), D: new AVRIOPort(cpu, portDConfig) };
    const timers = [new AVRTimer(cpu, timer0Config), new AVRTimer(cpu, timer1Config), new AVRTimer(cpu, timer2Config)];
    const usart = new AVRUSART(cpu, usart0Config, CPU_HZ);
    const adc = new AVRADC(cpu, adcConfig);
    const twi = new AVRTWI(cpu, twiConfig, CPU_HZ);
    twi.eventHandler = this.twiDevice ? this.twiDevice(twi) : new NoopTWIEventHandler(twi);
    adc.channelValues.splice(0, this.analog.length, ...this.analog);
    usart.onByteTransmit = (b) => { this.tx += String.fromCharCode(b); this.lastTxSimMs = this.simMs; };
    this.m = { cpu, ports, usart, adc, timers, twi };
    this.levels.fill(false);
    // when the program changes a pin's direction or pull-up, re-apply what the outside world puts on input pins;
    // and tell the watchers (modules timing the pins) about every level that changed
    for (const [name, p] of Object.entries(ports) as [Port, AVRIOPort][]) p.addListener(() => { this.applyInputs(); this.emitEdges(name); });
    this.rxQueue = [];
    this.lastTxSimMs = -Infinity;
    this.applyInputs();
  }

  // Advances up to `simMs` of simulated time, stopping early after `budgetMs` of wall time so the page stays
  // responsive (a busy loop then just runs below real time). Returns the simulated ms actually advanced.
  runFor(simMs: number, budgetMs = 8): number {
    const { cpu } = this.m;
    const start = cpu.cycles, end = start + simMs * CYCLES_PER_MS, t0 = performance.now();
    while (cpu.cycles < end) {
      this.feedSerial();
      for (let i = 0; i < CHUNK && cpu.cycles < end; i++) { avrInstruction(cpu); cpu.tick(); }
      if (performance.now() - t0 > budgetMs) break;
    }
    return (cpu.cycles - start) / CYCLES_PER_MS;
  }

  pin(n: number): { mode: PinMode; high: boolean } {
    const { port, bit } = unoPin(n);
    const p = this.m.ports[port];
    const s = p.pinState(bit);
    const mode: PinMode = s === PinState.Input ? 'input' : s === PinState.InputPullUp ? 'input-pullup' : 'output';
    return { mode, high: mode === 'output' ? s === PinState.High : this.inputLevel(n, mode) };
  }

  // What the outside world puts on a pin: true/false drives it, null leaves it floating.
  setInput(n: number, high: boolean | null): void {
    this.inputs.set(n, high);
    this.applyInputs();
  }

  // 0–1 when a timer's PWM output drives the pin (analogWrite), else null
  pwmDuty(n: number): number | null { return this.pin(n).mode === 'output' ? pwmDuty(this.m.cpu, n) : null; }

  // Program counter as a byte address.
  get pc(): number { return this.m.cpu.pc * 2; }

  // Candidate return addresses (byte addresses) on the stack, innermost first. AVR pushes the 2-byte word
  // address high byte at the lower memory address; data on the stack can look like an address too, so callers
  // treat these as candidates (see currentLine).
  returnAddresses(max = 16): number[] {
    const { data, SP } = this.m.cpu;
    const out: number[] = [];
    for (let i = SP + 1; i < RAMEND && out.length < max; i++) out.push(((data[i] << 8) | data[i + 1]) * 2);
    return out;
  }

  setAnalog(channel: number, volts: number): void {
    this.analog[channel] = volts;
    this.m.adc.channelValues[channel] = volts;
  }

  serialWrite(text: string): void {
    for (const ch of text) this.rxQueue.push(ch.charCodeAt(0) & 0xff);
  }

  takeSerial(): string { const s = this.tx; this.tx = ''; return s; }

  get cycles(): number { return this.m.cpu.cycles; }
  // Calls `cb` after `cycles` CPU cycles of simulated time (a module answering at the right moment).
  after(cycles: number, cb: () => void): void { this.m.cpu.addClockEvent(cb, Math.max(1, Math.round(cycles))); }
  watchPins(cb: PinWatcher): () => void { this.watchers.push(cb); return () => { this.watchers = this.watchers.filter((w) => w !== cb); }; }
  // The device on the I²C bus (null: nobody answers). Kept across resets.
  setTwiDevice(make: ((twi: AVRTWI) => TWIEventHandler) | null): void {
    this.twiDevice = make;
    this.m.twi.eventHandler = make ? make(this.m.twi) : new NoopTWIEventHandler(this.m.twi);
  }
  private emitEdges(port: Port) {
    for (const n of PORT_PINS[port]) {
      const high = this.pin(n).high;
      if (high === this.levels[n]) continue;
      this.levels[n] = high;
      for (const w of this.watchers) w(n, high);
    }
  }

  // A floating input reads HIGH with the internal pull-up enabled, LOW without.
  private inputLevel(n: number, mode: PinMode): boolean {
    const v = this.inputs.get(n);
    return v ?? mode === 'input-pullup';
  }

  // Every input pin nobody drives is floating (reads its pull-up); driven pins read what drives them.
  private applyInputs() {
    for (let n = 0; n < 20; n++) {
      const { port, bit } = unoPin(n);
      const p = this.m.ports[port];
      const s = p.pinState(bit);
      if (s === PinState.High || s === PinState.Low) continue;
      p.setPin(bit, this.inputs.get(n) ?? s === PinState.InputPullUp);
    }
  }

  private feedSerial() {
    if (this.rxQueue.length && this.m.usart.writeByte(this.rxQueue[0]) !== false) this.rxQueue.shift();
  }
}
