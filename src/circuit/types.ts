// The circuit a learner builds: parts placed on the breadboard, and wires. Pure data (runs in the simulation
// worker too) — nothing here imports React or three.js.
import type { Row } from '../three/breadboard/breadboardGeometry';

export type { Row };

// "<partId>.<pin>": the UNO is part `uno` (D0…D13, A0…A5, 5V, 3V3, VIN, GND, AREF), a breadboard is a part too — the first is
// `bb`, the next `breadboard2`, `breadboard3`… (holes "<col><row>" like 12a; rails T+<col>, T-<col>, B+<col>, B-<col> — T is the
// side next to row a), and a module standing on the bench is its own part (e.g. "servo1.SIG").
export type PinRef = string;

export type PartType =
  | 'led' | 'resistor' | 'button' | 'pot'                                         // basics
  | 'rgb' | 'buzzer' | 'ldr' | 'tmp36' | 'fsr' | 'diode' | 'npn' | 'traffic'      // on the breadboard
  | 'motor' | 'servo' | 'hcsr04' | 'stepper' | 'oled' | 'soil'                   // modules on the bench
  | 'breadboard';                                                                  // a breadboard is a part too: holes are "<its id>.<hole>"
export type BoardPlacement = { col: number; row: Row; board?: string };  // the breadboard hole of the part's first leg (on this breadboard: 'bb', the first, when not said)
export type BenchPlacement = { x: number; z: number };   // a module's centre on the bench (world mm)
export type Placement = BoardPlacement | BenchPlacement;
export const onBench = (at: Placement): at is BenchPlacement => 'x' in at;

// rot: how far the part is turned, in degrees clockwise seen from above (0 = facing the viewer, the way it is modelled):
// any angle for a module on the bench; a quarter turn at a time for a part in the breadboard's holes
export type PartInstance = { id: string; type: PartType; params: Record<string, string | number>; at: Placement; rot?: number };
export type Wire = { id: string; from: PinRef; to: PinRef; color: string };
export type CircuitSpec = { parts: PartInstance[]; wires: Wire[] };
