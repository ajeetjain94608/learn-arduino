import type { AvrRunner } from './AvrRunner';

// Test helper: advance to exactly `simMs` more simulated time however slow the machine is (runFor stops at its
// wall-clock budget, so it is called until the target is reached).
export function runSim(r: AvrRunner, simMs: number): void {
  const target = r.simMs + simMs;
  while (r.simMs < target - 1e-9) r.runFor(target - r.simMs, 1000);
}
