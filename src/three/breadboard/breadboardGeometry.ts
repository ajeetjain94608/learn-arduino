// Half-size breadboard (30 columns), local millimetres with the origin at the board centre.
export const BB = { L: 82, W: 55, H: 8.5 } as const;
export type Row = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';
export const ROW: Record<Row, number> = { a: -14.0, b: -11.46, c: -8.92, d: -6.38, e: -3.84, f: 3.84, g: 6.38, h: 8.92, i: 11.46, j: 14.0 };
export const RAIL_Z = [-24.0, -21.46, 21.46, 24.0] as const;
export const COLUMNS = 30;

export const colX = (col: number) => (col - 15.5) * 2.54;

export function holeLocal(col: number, row: Row): [number, number, number] {
  return [colX(col), BB.H, ROW[row]];
}

// Rail holes come in groups of five with a gap after each group.
export const isRailColumn = (col: number) => col >= 2 && col <= 29 && (col - 2) % 6 !== 5;

export function railHoles(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let col = 2; col <= 29; col++) if (isRailColumn(col)) for (const z of RAIL_Z) out.push([colX(col), BB.H, z]);
  return out;
}

const SIDE_A: Row[] = ['a', 'b', 'c', 'd', 'e'];
const SIDE_B: Row[] = ['f', 'g', 'h', 'i', 'j'];

// The five holes joined by one metal strip inside the breadboard.
export function connectedHoles(col: number, row: Row): { col: number; row: Row }[] {
  return (SIDE_A.includes(row) ? SIDE_A : SIDE_B).map((r) => ({ col, row: r }));
}
