import type { AVRTWI, TWIEventHandler } from 'avr8js';
import { CPU_HZ, type AvrRunner } from './avr/AvrRunner';

// Modules the chip talks to faster than the circuit is solved (every 1 ms): they watch pin edges the moment the
// program makes them, and answer at the exact CPU cycle — so tone(), pulseIn(), the Servo and Stepper libraries and
// I²C behave as on hardware. Each runs only while it has power and its signal pins are wired to the UNO.

// What the page shows of a module.
export type DeviceState = {
  hz?: number;              // buzzer: the note it plays (0 = silent)
  angle?: number;           // servo: degrees 0–180 (undefined until it gets a pulse); stepper: shaft angle
  steps?: number;           // stepper: full steps from where it started
  frame?: Uint8Array;       // OLED: 128 × 64 pixels, 8 rows per byte (SSD1306 layout)
  on?: boolean;             // OLED: display switched on
};
export interface Device { state(): DeviceState; detach(): void }

const US = CPU_HZ / 1_000_000; // cycles per microsecond

// Piezo buzzer: the note is how often its pin goes HIGH (tone() toggles it from a timer interrupt).
export class Buzzer implements Device {
  private rises: number[] = [];
  private stop: () => void;
  constructor(private chip: AvrRunner, pin: number) {
    this.stop = chip.watchPins((n, high) => {
      if (n !== pin || !high) return;
      this.rises.push(chip.cycles);
      if (this.rises.length > 9) this.rises.shift();
    });
  }
  state(): DeviceState {
    const r = this.rises, since = this.chip.cycles - r[r.length - 1];
    if (r.length < 3 || since < 0 || since > 0.05 * CPU_HZ) return { hz: 0 }; // quiet for 50 ms (or the chip rebooted): silent
    return { hz: Math.round(((r.length - 1) * CPU_HZ) / (r[r.length - 1] - r[0]) * 10) / 10 };
  }
  detach() { this.stop(); }
}

// SG90 servo: the angle follows the width of the pulses on its signal pin (544 µs = 0°, 2400 µs = 180°).
export class Servo implements Device {
  private riseAt = -1;
  private angle: number | undefined;
  private stop: () => void;
  constructor(chip: AvrRunner, pin: number) {
    this.stop = chip.watchPins((n, high) => {
      if (n !== pin) return;
      if (high) { this.riseAt = chip.cycles; return; }
      if (this.riseAt < 0) return;
      const us = (chip.cycles - this.riseAt) / US;
      if (us > 400 && us < 2700) this.angle = Math.min(180, Math.max(0, ((us - 544) / (2400 - 544)) * 180));
    });
  }
  state(): DeviceState { return { angle: this.angle }; }
  detach() { this.stop(); }
}

// HC-SR04: a trigger pulse of at least 10 µs makes it send its burst, then hold ECHO high for 58 µs per cm
// (38 ms when nothing is in range). It drives the ECHO pin itself.
export class Sonar implements Device {
  private riseAt = -1;
  private busy = false;
  private dead = false; // detached: a pending echo must not touch the pin any more
  private stop: () => void;
  constructor(chip: AvrRunner, trig: number, private echo: number, private cm: () => number) {
    chip.setInput(echo, false);
    this.stop = chip.watchPins((n, high) => {
      if (n !== trig) return;
      if (high) { this.riseAt = chip.cycles; return; }
      if (this.riseAt < 0 || this.busy || (chip.cycles - this.riseAt) / US < 10) return;
      this.busy = true;
      const d = this.cm();
      const width = d > 400 ? 38_000 : d * 58;
      chip.after(250 * US, () => { // the 8-pulse burst goes out first
        if (this.dead) return;
        chip.setInput(this.echo, true);
        chip.after(width * US, () => { if (this.dead) return; chip.setInput(this.echo, false); this.busy = false; });
      });
    });
  }
  state(): DeviceState { return {}; }
  detach() { this.dead = true; this.stop(); }
}

// 28BYJ-48 on a ULN2003: the coils energised (IN1–IN4) step the shaft; 2048 full steps (4096 half steps) a turn.
const PHASE: Record<number, number> = { 0b1000: 0, 0b1100: 1, 0b0100: 2, 0b0110: 3, 0b0010: 4, 0b0011: 5, 0b0001: 6, 0b1001: 7 };
export class Stepper implements Device {
  private half = 0;
  private phase = 1; // at rest the shaft lines up with coils A+B (where the Stepper library counts step 0)
  private stop: () => void;
  constructor(chip: AvrRunner, ins: [number, number, number, number]) {
    this.stop = chip.watchPins((n) => {
      if (!ins.includes(n)) return;
      const bits = ins.reduce((b, p, i) => b | (chip.pin(p).high ? 8 >> i : 0), 0);
      const ph = PHASE[bits];
      if (ph === undefined) return;
      const d = (ph - this.phase + 8) % 8;
      if (d >= 1 && d <= 3) this.half += d;
      else if (d >= 5) this.half -= 8 - d;
      this.phase = ph;
    });
  }
  state(): DeviceState { return { steps: Math.round(this.half / 2), angle: (this.half / 4096) * 360 }; }
  detach() { this.stop(); }
}

// SSD1306 OLED at I²C address 0x3C: commands (control byte 0x00) and picture data (0x40) into its 1 KB of RAM,
// horizontal addressing within the column and page window set by commands 0x21 and 0x22.
const ARGS: Record<number, number> = { 0x20: 1, 0x21: 2, 0x22: 2, 0x81: 1, 0x8d: 1, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1 };
export class Oled implements Device, TWIEventHandler {
  readonly ram = new Uint8Array(1024);
  private on = false;
  private mode: 'control' | 'commands' | 'data' | 'command1' | 'data1' = 'control';
  private cmd: number[] = [];
  private col = 0; private page = 0;
  private cols = [0, 127]; private pages = [0, 7];
  private twi!: AVRTWI;
  constructor(private chip: AvrRunner, private address = 0x3c) { chip.setTwiDevice((twi) => { this.twi = twi; return this; }); }
  start() { this.twi.completeStart(); }
  stop() { this.mode = 'control'; this.twi.completeStop(); }
  connectToSlave(addr: number, write: boolean) { this.mode = 'control'; this.twi.completeConnect(addr === this.address && write); }
  writeByte(b: number) { this.receive(b); this.twi.completeWrite(true); }
  readByte() { this.twi.completeRead(0xff); }
  private receive(b: number) {
    if (this.mode === 'control') { this.mode = b & 0x40 ? (b & 0x80 ? 'data1' : 'data') : b & 0x80 ? 'command1' : 'commands'; return; }
    if (this.mode === 'data' || this.mode === 'data1') {
      this.ram[this.page * 128 + this.col] = b;
      if (++this.col > this.cols[1]) { this.col = this.cols[0]; if (++this.page > this.pages[1]) this.page = this.pages[0]; }
      if (this.mode === 'data1') this.mode = 'control';
      return;
    }
    this.cmd.push(b);
    if (this.cmd.length <= (ARGS[this.cmd[0]] ?? 0)) return; // waiting for the command's arguments
    const [c, a, z] = this.cmd;
    this.cmd = [];
    if (c === 0xae) this.on = false;
    else if (c === 0xaf) this.on = true;
    else if (c === 0x21) { this.cols = [a & 127, z & 127]; this.col = this.cols[0]; }
    else if (c === 0x22) { this.pages = [a & 7, z & 7]; this.page = this.pages[0]; }
    if (this.mode === 'command1') this.mode = 'control';
  }
  state(): DeviceState { return { frame: this.ram.slice(), on: this.on }; }
  detach() { this.chip.setTwiDevice(null); }
}
