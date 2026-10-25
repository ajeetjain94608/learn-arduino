import { COLUMNS, connectedHoles, isRailColumn, type Row } from '../three/breadboard/breadboardGeometry';

// The UNO's header pins as one connection point each (its GND pins are joined on the board, so they are one: GND).
export const UNO_PINS: string[] = [
  ...Array.from({ length: 14 }, (_, i) => `D${i}`),
  ...Array.from({ length: 6 }, (_, i) => `A${i}`),
  '5V', '3V3', 'VIN', 'GND', 'AREF',
];
// Uno pin number (0–19, A0 = 14) of a D/A pin name, else null.
export function unoPinNumber(name: string): number | null {
  const m = name.match(/^([DA])(\d+)$/);
  if (!m) return null;
  const n = Number(m[2]) + (m[1] === 'A' ? 14 : 0);
  return n <= 19 ? n : null;
}

const ROWS: Row[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
// Rails: T- (outer, blue) and T+ (inner, red) beside row a; B- (inner, blue) and B+ (outer, red) beside row j.
export const RAILS = ['T-', 'T+', 'B-', 'B+'] as const;
export const railColumns = (): number[] => Array.from({ length: COLUMNS }, (_, i) => i + 1).filter(isRailColumn);

export const BB_HOLES: string[] = [
  ...Array.from({ length: COLUMNS }, (_, i) => ROWS.map((r) => `${i + 1}${r}`)).flat(),
  ...RAILS.flatMap((rail) => railColumns().map((c) => `${rail}${c}`)),
];

// Holes joined inside the breadboard: each five-hole strip, and each rail along the whole board.
export function bbInternalNets(): string[][] {
  const strips: string[][] = [];
  for (let col = 1; col <= COLUMNS; col++) for (const row of ['a', 'f'] as Row[]) strips.push(connectedHoles(col, row).map((h) => `${h.col}${h.row}`));
  const rails = RAILS.map((rail) => railColumns().map((c) => `${rail}${c}`));
  return [...strips, ...rails];
}
