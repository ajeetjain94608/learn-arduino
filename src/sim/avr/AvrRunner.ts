import {
  adcConfig, AVRADC, AVRIOPort, AVRTimer, AVRUSART, avrInstruction, CPU, PinState,
  portBConfig, portCConfig, portDConfig, timer0Config, timer1Config, timer2Config, usart0Config,
} from 'avr8js';
import { unoPin, type Port } from './unoPins';

export const CPU_HZ = 16_000_000;
const CYCLES_PER_MS = CPU_HZ / 1000;
const CHUNK = 1000; // instructions between wall-clock checks

type Machine = { cpu: CPU; ports: Record<Port, AVRIOPort>; usart: AVRUSART; adc: AVRADC; timers: AVRTimer[] };
export type PinMode = 'input' | 'input-pullup' | 'output';

// A simulated ATmega328P running a compiled program (avr8js): the Uno's pins, Serial and analog inputs.
// Time is simulated (CPU cycles at 16 MHz), so programs behave exactly as on hardware even when the host is slower.
export class AvrRunner {
  private m!: Machine;
  private readonly inputs = new Map<number, boolean | null>(); // externally driven input pins (null = floating)
  private readonly analog: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private rxQueue: number[] = [];
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
    adc.channelValues.splice(0, this.analog.length, ...this.analog);
    usart.onByteTransmit = (b) => { this.tx += String.fromCharCode(b); this.lastTxSimMs = this.simMs; };
    this.m = { cpu, ports, usart, adc, timers };
    // when the program changes a pin's direction or pull-up, re-apply what the outside world puts on input pins
    for (const p of Object.values(ports)) p.addListener(() => this.applyInputs());
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

  setAnalog(channel: number, volts: number): void {
    this.analog[channel] = volts;
    this.m.adc.channelValues[channel] = volts;
  }

  serialWrite(text: string): void {
    for (const ch of text) this.rxQueue.push(ch.charCodeAt(0) & 0xff);
  }

  takeSerial(): string { const s = this.tx; this.tx = ''; return s; }

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
