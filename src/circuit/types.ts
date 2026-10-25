// The circuit a learner builds: parts placed on the breadboard, and wires. Pure data (runs in the simulation
// worker too) — nothing here imports React or three.js.
import type { Row } from '../three/breadboard/breadboardGeometry';

export type { Row };

// "<partId>.<pin>": the UNO is part `uno` (D0…D13, A0…A5, 5V, 3V3, VIN, GND, AREF), the breadboard is part `bb`
// (holes "<col><row>" like 12a; rails T+<col>, T-<col>, B+<col>, B-<col> — T is the side next to row a).
export type PinRef = string;

export type PartType = 'led' | 'resistor' | 'button' | 'pot';
export type Placement = { col: number; row: Row }; // the breadboard hole of the part's first leg

export type PartInstance = { id: string; type: PartType; params: Record<string, string | number>; at: Placement };
export type Wire = { id: string; from: PinRef; to: PinRef; color: string };
export type CircuitSpec = { parts: PartInstance[]; wires: Wire[] };
