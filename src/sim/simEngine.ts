import type { LineEntry } from '../build/compiler/types';
import { evaluate, type Burn, type InputValues, type PartState, type PinDrive } from '../circuit/evaluate';
import type { CircuitSpec } from '../circuit/types';
import { AvrRunner } from './avr/AvrRunner';
import { currentLine } from './avr/sourceLine';

export const MAX_DEBT_MS = 200;  // after a slow stretch, catch up at most this much (no fast-forward bursts)
const SPEED_WINDOW_MS = 500;     // speed = chip time ÷ wall time over windows this long
const CIRCUIT_SLICE_MS = 1;      // with a circuit, the chip runs in slices this long and the circuit follows its pins
const HIGH_VOLTS = 2.5;          // a digital input reads HIGH above this

// seq goes up each time the circuit is solved again, so the page only re-renders when something changed
export type CircuitSnapshot = { seq: number; parts: Record<string, PartState>; burns: Burn[]; board: { shorted: boolean; burntPins: number[] } };

// Whether a snapshot's circuit is news for the page (worker messages are fresh copies, so compare by seq).
export const circuitChanged = (prev: CircuitSnapshot | null, next: CircuitSnapshot | null) => (next ? prev?.seq !== next.seq : prev !== null);

// What the page needs from the chip each frame.
export type SimSnapshot = {
  running: boolean;
  simMs: number;
  levels: number;        // bit n = Uno pin n is HIGH (pins 0–19)
  pin13: boolean;
  line: number | null;   // sketch line running now
  serial: string;        // printed since the last snapshot
  lastTxSimMs: number;
  speed: number;         // chip time ÷ real time (1 = keeping up)
  replaced: number;      // replace requests handled so far (the page ignores older snapshots after asking)
  circuit?: CircuitSnapshot; // the learner's circuit, when one is attached (Build)
};

// The simulated chip, paced to real time. Runs in the simulation worker (sim.worker.ts), where it can use a whole
// CPU core; `now` is passed in (performance.now() there, a fake clock in tests).
export class SimEngine {
  private chip: AvrRunner | null = null;
  private lines: LineEntry[] = [];
  private paused = true;
  private hold = false;
  private anchorWall = 0;  // wall time at which the chip was at anchorSim
  private anchorSim = 0;
  private serial = '';
  private lastChar = '';
  private speed = 1;
  private window = { wall: 0, sim: 0 };
  private spec: CircuitSpec | null = null;
  private inputs: InputValues = {};
  private burnt = new Set<string>();
  private burns: Burn[] = [];
  private circuitState: CircuitSnapshot | null = null;
  private signature = '';      // the chip's pin drives last time the circuit was solved
  private dirty = true;        // the circuit or an input changed: solve again
  evaluations = 0;             // how many times the circuit was solved (tests keep this low)
  private replaced = 0;

  load(flash: Uint8Array, lines: LineEntry[], now: number): void {
    this.chip = new AvrRunner(flash);
    this.lines = lines;
    this.serial = this.lastChar = '';
    this.resume(now);
  }

  // The reset button: the chip restarts and waits (the bootloader's flashes play first), then resume().
  reset(): void { this.chip?.reset(); this.paused = true; this.serial = this.lastChar = ''; }

  resume(now: number): void {
    this.paused = false;
    this.anchorWall = now;
    this.anchorSim = this.chip?.simMs ?? 0;
    this.window = { wall: now, sim: this.anchorSim };
    this.speed = 1;
  }

  stop(): void { this.chip = null; this.signature = ''; this.dirty = true; }

  // The learner's circuit around the UNO (null = none: the chip runs on its own, as on Home).
  setCircuit(spec: CircuitSpec | null): void {
    this.spec = spec;
    this.dirty = true;
    // a part that was thrown away takes its burn with it (the board's own burns stay until "Replace board")
    const ids = new Set(spec?.parts.map((p) => p.id) ?? []);
    for (const b of [...this.burnt]) if (!b.startsWith('uno') && !ids.has(b)) this.burnt.delete(b);
    this.burns = this.burns.filter((b) => this.burnt.has(b.id));
    if (!spec) { this.circuitState = null; this.chip && this.releasePins(this.chip); }
  }
  setInput(partId: string, key: string, value: number): void { (this.inputs[partId] ??= {})[key] = value; this.dirty = true; }
  // "Replace part" / "Replace board": forget a burn ('uno' also clears the short and every burnt pin).
  replace(id: string): void {
    this.replaced++;
    for (const b of [...this.burnt]) if (b === id || (id === 'uno' && b.startsWith('uno'))) this.burnt.delete(b);
    this.burns = this.burns.filter((b) => this.burnt.has(b.id));
    this.dirty = true;
  }
  // Burns the page kept (the build remembers them across screen switches and reloads).
  setBurns(burns: Burn[]): void {
    this.burnt = new Set(burns.map((b) => b.id));
    this.burns = [...burns];
    this.dirty = true;
  }
  private releasePins(chip: AvrRunner) { for (let n = 0; n < 20; n++) chip.setInput(n, null); }

  // Solve the circuit for the chip's pins as they are now and feed the voltages back to its inputs and ADC.
  // With no program (stopped), the board is still powered from USB and its pins are all inputs.
  private applyCircuit(chip: AvrRunner | null) {
    const drives: PinDrive[] = Array.from({ length: 20 }, (_, n) => {
      if (!chip) return { mode: 'input', high: false, duty: null };
      const p = chip.pin(n);
      return { mode: p.mode, high: p.high, duty: chip.pwmDuty(n) };
    });
    // a PWM pin's level flips hundreds of times a second; the circuit only depends on its duty
    const signature = drives.map((d) => (d.duty === null ? `${d.mode[0]}${d.high ? 1 : 0}` : `${d.mode[0]}p${d.duty.toFixed(3)}`)).join();
    if (!this.dirty && signature === this.signature) return;
    this.signature = signature;
    this.dirty = false;
    const r = evaluate(this.spec!, drives, this.inputs, this.burnt, !!chip); // stopped: lit, but nothing burns until Run
    this.evaluations++;
    for (const b of r.newBurns) { this.burnt.add(b.id); this.burns.push(b); }
    this.circuitState = { seq: (this.circuitState?.seq ?? 0) + 1, parts: r.parts, burns: [...this.burns], board: r.board };
    if (chip) drives.forEach((d, n) => {
      if (d.mode !== 'output') chip.setInput(n, r.pinVolts[n] > HIGH_VOLTS);
      if (n >= 14) chip.setAnalog(n - 14, r.pinVolts[n]);
    });
  }
  private get shorted() { return this.burnt.has('uno'); }
  setHold(on: boolean): void { this.hold = on; }
  serialWrite(text: string): void { this.chip?.serialWrite(text); }

  // ?test&hold: freeze once pin 13 is HIGH and the line it printed is complete (deterministic screenshots)
  private holding(): boolean { return this.hold && !!this.chip && this.chip.pin(13).high && this.lastChar === '\n'; }

  // Advance the chip toward real time, using at most `budgetMs` of wall time. Returns how long the caller may wait
  // before the next step (0 = the chip is behind, step again at once).
  step(now: number, budgetMs = 12): number {
    const chip = this.chip;
    if (!chip && this.spec) this.applyCircuit(null); // stopped: the circuit is still powered
    if (!chip || this.paused || this.holding() || this.shorted) { this.speed = 1; return 16; }
    let target = this.anchorSim + (now - this.anchorWall);
    if (target - chip.simMs > MAX_DEBT_MS) { // too far behind: let real time go, don't race
      target = chip.simMs + MAX_DEBT_MS;
      this.anchorSim = target;
      this.anchorWall = now;
    }
    if (target <= chip.simMs) return Math.max(1, Math.min(16, chip.simMs - target));
    if (this.spec) {
      const until = performance.now() + budgetMs;
      this.applyCircuit(chip);
      while (chip.simMs < target && !this.shorted) {
        chip.runFor(Math.min(CIRCUIT_SLICE_MS, target - chip.simMs), Math.max(0, until - performance.now()));
        this.applyCircuit(chip);
        if (performance.now() >= until) break;
      }
    } else chip.runFor(target - chip.simMs, budgetMs);
    const out = chip.takeSerial();
    if (out) { this.serial += out; this.lastChar = out[out.length - 1]; }
    if (now - this.window.wall >= SPEED_WINDOW_MS) {
      this.speed = Math.min(1, (chip.simMs - this.window.sim) / (now - this.window.wall));
      this.window = { wall: now, sim: chip.simMs };
    }
    return chip.simMs < target ? 0 : 1;
  }

  snapshot(): SimSnapshot {
    const chip = this.chip;
    const serial = this.serial;
    this.serial = '';
    const circuit = this.spec && this.circuitState ? this.circuitState : undefined;
    if (!chip) return { running: false, simMs: 0, levels: 0, pin13: false, line: null, serial, lastTxSimMs: -Infinity, speed: 1, circuit, replaced: this.replaced };
    let levels = 0;
    for (let n = 0; n < 20; n++) if (chip.pin(n).high) levels |= 1 << n;
    return {
      running: !this.shorted,
      circuit,
      simMs: chip.simMs,
      levels,
      pin13: (levels & (1 << 13)) !== 0,
      line: currentLine(chip.pc, chip.returnAddresses(), this.lines),
      serial,
      lastTxSimMs: chip.lastTxSimMs,
      speed: this.holding() ? 1 : this.speed,
      replaced: this.replaced,
    };
  }
}
