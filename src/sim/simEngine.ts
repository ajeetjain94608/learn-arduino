import type { LineEntry } from '../build/compiler/types';
import { AvrRunner } from './avr/AvrRunner';
import { currentLine } from './avr/sourceLine';

export const MAX_DEBT_MS = 200;  // after a slow stretch, catch up at most this much (no fast-forward bursts)
const SPEED_WINDOW_MS = 500;     // speed = chip time ÷ wall time over windows this long

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

  stop(): void { this.chip = null; }
  setHold(on: boolean): void { this.hold = on; }
  serialWrite(text: string): void { this.chip?.serialWrite(text); }

  // ?test&hold: freeze once pin 13 is HIGH and the line it printed is complete (deterministic screenshots)
  private holding(): boolean { return this.hold && !!this.chip && this.chip.pin(13).high && this.lastChar === '\n'; }

  // Advance the chip toward real time, using at most `budgetMs` of wall time. Returns how long the caller may wait
  // before the next step (0 = the chip is behind, step again at once).
  step(now: number, budgetMs = 12): number {
    const chip = this.chip;
    if (!chip || this.paused || this.holding()) { this.speed = 1; return 16; }
    let target = this.anchorSim + (now - this.anchorWall);
    if (target - chip.simMs > MAX_DEBT_MS) { // too far behind: let real time go, don't race
      target = chip.simMs + MAX_DEBT_MS;
      this.anchorSim = target;
      this.anchorWall = now;
    }
    if (target <= chip.simMs) return Math.max(1, Math.min(16, chip.simMs - target));
    chip.runFor(target - chip.simMs, budgetMs);
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
    if (!chip) return { running: false, simMs: 0, levels: 0, pin13: false, line: null, serial, lastTxSimMs: -Infinity, speed: 1 };
    let levels = 0;
    for (let n = 0; n < 20; n++) if (chip.pin(n).high) levels |= 1 << n;
    return {
      running: true,
      simMs: chip.simMs,
      levels,
      pin13: (levels & (1 << 13)) !== 0,
      line: currentLine(chip.pc, chip.returnAddresses(), this.lines),
      serial,
      lastTxSimMs: chip.lastTxSimMs,
      speed: this.holding() ? 1 : this.speed,
    };
  }
}
