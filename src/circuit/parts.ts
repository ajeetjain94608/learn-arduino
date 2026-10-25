import { COLUMNS, type Row } from '../three/breadboard/breadboardGeometry';
import type { PartType, Placement } from './types';

export type ParamDef = { key: string; options: (string | number)[]; default: string | number };
export type InputDef = { key: string; min: number; max: number; step: number; unit: string; default: number };
export type PartDef = {
  pins: string[];
  // where each pin's leg sits on the breadboard (hole names like "10a"), or null if the part can't sit there
  footprint(at: Placement, params: Record<string, string | number>): Record<string, string> | null;
  params: ParamDef[];
  inputs: InputDef[];
};

export const LED_COLORS = ['red', 'green', 'yellow', 'blue', 'white'] as const;
export const LED_VF: Record<string, number> = { red: 1.9, yellow: 2.0, green: 2.1, blue: 3.0, white: 3.0 };
export const POT_OHMS = 10_000;

const STRIP_ROWS: Row[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const onBoard = (col: number) => col >= 1 && col <= COLUMNS;
// legs in one row, at these column offsets from the anchor
const inRow = (pinsAt: Record<string, number>) => (at: Placement) => {
  if (!STRIP_ROWS.includes(at.row) || Object.values(pinsAt).some((d) => !onBoard(at.col + d))) return null;
  return Object.fromEntries(Object.entries(pinsAt).map(([pin, d]) => [pin, `${at.col + d}${at.row}`]));
};

export const PART_DEFS: Record<PartType, PartDef> = {
  led: {
    pins: ['A', 'K'],
    footprint: inRow({ A: 0, K: 1 }),
    params: [{ key: 'color', options: [...LED_COLORS], default: 'red' }],
    inputs: [],
  },
  resistor: {
    pins: ['1', '2'],
    footprint: inRow({ 1: 0, 2: 4 }),
    params: [{ key: 'ohms', options: [220, 1000, 10000], default: 220 }],
    inputs: [],
  },
  // A 6 mm tactile button straddling the centre gap: legs 1, 2 in row e and 3, 4 in row f (columns col, col+2).
  // As on the real part, the legs across the gap (1–3, 2–4) are always joined; pressing joins the two columns.
  button: {
    pins: ['1', '2', '3', '4'],
    footprint: (at) => (at.row !== 'e' || !onBoard(at.col) || !onBoard(at.col + 2) ? null
      : { 1: `${at.col}e`, 2: `${at.col + 2}e`, 3: `${at.col}f`, 4: `${at.col + 2}f` }),
    params: [],
    inputs: [{ key: 'pressed', min: 0, max: 1, step: 1, unit: '', default: 0 }],
  },
  // 10 kΩ rotary potentiometer: outer legs 1 and 2, wiper W in the middle. position 1 = wiper at leg 1.
  pot: {
    pins: ['1', 'W', '2'],
    footprint: inRow({ 1: 0, W: 2, 2: 4 }),
    params: [],
    inputs: [{ key: 'position', min: 0, max: 1, step: 0.001, unit: '', default: 0.5 }],
  },
};

// The part's parameters with defaults filled in.
export function paramsOf(type: PartType, params: Record<string, string | number>): Record<string, string | number> {
  return Object.fromEntries(PART_DEFS[type].params.map((p) => [p.key, params[p.key] ?? p.default]));
}
