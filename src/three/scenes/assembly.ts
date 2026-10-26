import { createContext, useContext } from 'react';

// Build-up animation when a project's circuit opens: the breadboard slides in while the camera moves,
// the parts drop into their holes one by one, then each jumper wire draws itself from the board to the
// breadboard. Times in seconds from the moment the circuit is shown.
export type Slot = readonly [start: number, duration: number];
export const ASSEMBLY = {
  breadboard: [0, 0.55],
  led: [0.5, 0.4],
  resistor: [0.75, 0.4],
  signal: [1.1, 0.55],
  ground: [1.5, 0.55],
} as const satisfies Record<string, Slot>;
export type AssemblyStep = keyof typeof ASSEMBLY;
export const ASSEMBLY_DONE = 2.1;

// The same build-up for any project: the breadboard slides in, each part drops into place one after another, then each
// jumper wire draws itself. The pace speeds up for projects with many parts and wires so a build never drags on.
export type AssemblyPlan = { breadboard: Slot; parts: Slot[]; wires: Slot[]; done: number };
export function assemblyPlan(parts: number, wires: number): AssemblyPlan {
  const breadboard: Slot = [0, 0.55];
  const partGap = Math.min(0.25, 1.1 / Math.max(parts, 1));
  const partSlots = Array.from({ length: parts }, (_, i): Slot => [0.5 + i * partGap, 0.4]);
  const wireStart = 0.5 + Math.max(parts, 1) * partGap + 0.15;
  const wireGap = Math.min(0.4, 2.0 / Math.max(wires, 1));
  const wireDur = wires > 10 ? 0.4 : 0.55; // a crowded circuit draws its wires a little quicker
  const wireSlots = Array.from({ length: wires }, (_, j): Slot => [wireStart + j * wireGap, wireDur]);
  const end = wires > 0 ? wireStart + (wires - 1) * wireGap + wireDur : parts > 0 ? 0.5 + (parts - 1) * partGap + 0.4 : 0.55;
  return { breadboard, parts: partSlots, wires: wireSlots, done: Math.round((end + 0.05) * 100) / 100 };
}
export type StepRef = AssemblyStep | Slot; // a named step of the Blink build, or a slot from a plan
export const slotOf = (s: StepRef): Slot => (typeof s === 'string' ? ASSEMBLY[s] : s);

export const BREADBOARD_SLIDE_MM = 160; // the breadboard starts this far to the right (+x)
export const DROP_MM = 34;              // parts start this far above their holes

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const slotProgress = (t: number, [start, dur]: Slot) => clamp01((t - start) / dur);
export const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;

// Remaining height as a fraction of the drop: 1 at the start, 0 when seated, with a small settle
// (ease-out-back) so the part lands rather than stops.
export function dropOffset(p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return 0; // exact endpoints: the part starts at the full height and is seated exactly
  const c1 = 1.2, c3 = c1 + 1, q = p - 1;
  return -(c3 * q ** 3 + c1 * q ** 2);
}

// Shared clock: seconds since the circuit appeared (Infinity = fully built, e.g. reduced motion).
export type AssemblyClock = { t: number };
export const AssemblyContext = createContext<AssemblyClock>({ t: Infinity });
export const useAssemblyClock = () => useContext(AssemblyContext);
