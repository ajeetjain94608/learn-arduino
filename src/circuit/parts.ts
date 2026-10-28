import { COLUMNS, ROW, type Row } from '../three/breadboard/breadboardGeometry';
import { onBench, type BoardPlacement, type PartInstance, type PartType, type Placement, type Wire } from './types';

export type ParamDef = { key: string; options: (string | number)[]; default: string | number };
export type InputDef = { key: string; min: number; max: number; step: number; unit: string; default: number };
// A module standing on the bench: its size (mm, x by z) and where each header pin's tip is, from its centre (x, y, z).
export type BenchDef = { w: number; d: number; h: number; pins: Record<string, [number, number, number]> };
export type PartDef = {
  pins: string[];
  // where each pin's leg sits on the breadboard (hole names like "10a"), or null if the part can't sit there
  footprint(at: Placement, params: Record<string, string | number>): Record<string, string> | null;
  // every hole the part's body sits over, legs included (no other part may use them); [] if it can't sit there
  covers(at: Placement, params: Record<string, string | number>): string[];
  bench?: BenchDef; // set for modules: they stand on the bench and wires go to their own pins
  params: ParamDef[];
  inputs: InputDef[];
};

export const LED_COLORS = ['red', 'green', 'yellow', 'blue', 'white'] as const;
export const LED_VF: Record<string, number> = { red: 1.9, yellow: 2.0, green: 2.1, blue: 3.0, white: 3.0 };
export const RGB_VF = { R: 2.0, G: 3.0, B: 3.0 } as const;           // a common-cathode RGB LED's three dies
export const TRAFFIC_VF = { R: 1.9, Y: 2.0, G: 2.1 } as const;       // the traffic-light module's LEDs…
export const TRAFFIC_OHMS = 220;                                     // …each with its own resistor on the board
export const POT_OHMS = 10_000;
export const MOTOR_OHMS = 8;            // a small 3–6 V hobby motor's winding
export const MOTOR_FULL_A = 0.5;        // its current at full speed on 5 V through a TIP120 (5 V ÷ (8 Ω + 2 Ω))

// Sensor curves (from typical data sheets)
// LDR (GL5528-like): about 10 kΩ at 10 lux, falling as the light grows; 1 MΩ in the dark.
export const ldrOhms = (lux: number) => Math.min(1e6, 10_000 * (10 / Math.max(lux, 0.01)) ** 0.8);
// FSR (402-like): open when not pressed; about 10 kΩ at 100 g, 1 kΩ at 1 kg.
export const fsrOhms = (grams: number) => (grams <= 0.5 ? 1e7 : Math.min(1e7, 1e6 / grams));
// TMP36: 0.5 V at 0 °C, +10 mV per °C.
export const tmp36Volts = (celsius: number) => 0.5 + 0.01 * celsius;
// Capacitive soil-moisture sensor: about 2.54 V in dry air (reading 520), 1.27 V in water (260).
export const soilVolts = (percent: number) => 2.54 - 0.0127 * Math.min(100, Math.max(0, percent));

const STRIP_ROWS: Row[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const onBoard = (col: number) => col >= 1 && col <= COLUMNS;
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
// a block of holes: columns col…col+w-1 and up to h rows from `row` on its own side of the gap
function block(at: BoardPlacement, w: number, h: number): string[] {
  const i = STRIP_ROWS.indexOf(at.row), side = i < 5 ? 0 : 5;
  const rows = range(i, h).filter((r) => r < side + 5);
  while (rows.length < h && rows[0] > side) rows.unshift(rows[0] - 1); // near the gap: grow away from it
  return range(at.col, w).flatMap((c) => rows.map((r) => `${c}${STRIP_ROWS[r]}`));
}
// legs in one row, at these column offsets from the anchor
const inRow = (pinsAt: Record<string, number>) => (at: Placement) => {
  if (onBench(at) || !STRIP_ROWS.includes(at.row) || Object.values(pinsAt).some((d) => !onBoard(at.col + d))) return null;
  return Object.fromEntries(Object.entries(pinsAt).map(([pin, d]) => [pin, `${at.col + d}${at.row}`]));
};
// a part whose body covers only the holes its legs are in
const legsOnly = (pinsAt: Record<string, number>) => ({ footprint: inRow(pinsAt), covers: (at: Placement) => Object.values(inRow(pinsAt)(at) ?? {}) });
// a part whose body covers `w` columns × `h` rows from its first leg
const bodyBlock = (pinsAt: Record<string, number>, w: number, h: number) => ({
  footprint: inRow(pinsAt),
  covers: (at: Placement) => (inRow(pinsAt)(at) && !onBench(at) ? block(at, w, h) : []),
});
// a module: no breadboard holes, its own pins
const module = (bench: BenchDef) => ({ pins: Object.keys(bench.pins), footprint: () => null, covers: () => [], bench });
// header pins in a row along x, `pitch` apart, centred on x0
const header = (names: string[], x0: number, y: number, z: number, pitch = 2.54): Record<string, [number, number, number]> =>
  Object.fromEntries(names.map((n, i) => [n, [x0 + (i - (names.length - 1) / 2) * pitch, y, z]]));

export const PART_DEFS: Record<PartType, PartDef> = {
  led: {
    pins: ['A', 'K'],
    ...legsOnly({ A: 0, K: 1 }),
    params: [{ key: 'color', options: [...LED_COLORS], default: 'red' }],
    inputs: [],
  },
  resistor: {
    pins: ['1', '2'],
    footprint: inRow({ 1: 0, 2: 4 }),
    covers: (at) => (inRow({ 1: 0, 2: 4 })(at) && !onBench(at) ? range(at.col, 5).map((c) => `${c}${at.row}`) : []),
    params: [{ key: 'ohms', options: [220, 1000, 10000], default: 220 }],
    inputs: [],
  },
  // A 6 mm tactile button straddling the centre gap: legs 1, 2 in row e and 3, 4 in row f (columns col, col+2).
  // As on the real part, the legs across the gap (1–3, 2–4) are always joined; pressing joins the two columns.
  button: {
    pins: ['1', '2', '3', '4'],
    footprint: (at) => (onBench(at) || at.row !== 'e' || !onBoard(at.col) || !onBoard(at.col + 2) ? null
      : { 1: `${at.col}e`, 2: `${at.col + 2}e`, 3: `${at.col}f`, 4: `${at.col + 2}f` }),
    covers: (at) => (onBench(at) || at.row !== 'e' || !onBoard(at.col) || !onBoard(at.col + 2) ? []
      : range(at.col, 3).flatMap((c) => ['d', 'e', 'f', 'g'].map((r) => `${c}${r}`))),
    params: [],
    inputs: [{ key: 'pressed', min: 0, max: 1, step: 1, unit: '', default: 0 }],
  },
  // 10 kΩ rotary potentiometer: outer legs 1 and 2, wiper W in the middle. position 1 = wiper at leg 1.
  pot: {
    pins: ['1', 'W', '2'],
    ...bodyBlock({ 1: 0, W: 2, 2: 4 }, 5, 3),
    params: [],
    inputs: [{ key: 'position', min: 0, max: 1, step: 0.001, unit: '', default: 0.5 }],
  },
  // 5 mm RGB LED, common cathode: legs red, cathode (the longest), green, blue.
  rgb: { pins: ['R', 'K', 'G', 'B'], ...legsOnly({ R: 0, K: 1, G: 2, B: 3 }), params: [], inputs: [] },
  // 12 mm passive piezo buzzer, legs 7.6 mm apart (+ marked on top).
  buzzer: { pins: ['+', '-'], ...bodyBlock({ '+': 0, '-': 3 }, 4, 4), params: [], inputs: [] },
  // light-dependent resistor; `lux` is the light falling on it (the desk lamp sets it, or the slider)
  ldr: { pins: ['1', '2'], ...bodyBlock({ 1: 0, 2: 2 }, 3, 1), params: [], inputs: [{ key: 'lux', min: 0, max: 1000, step: 1, unit: 'lux', default: 300 }] },
  // TMP36 temperature sensor, flat face forward: +Vs, Vout, GND
  tmp36: { pins: ['VS', 'OUT', 'GND'], ...legsOnly({ VS: 0, OUT: 1, GND: 2 }), params: [], inputs: [{ key: 'celsius', min: -10, max: 60, step: 0.5, unit: '°C', default: 22 }] },
  // force-sensing resistor: two legs in the breadboard, the round pad beside it
  fsr: { pins: ['1', '2'], ...legsOnly({ 1: 0, 2: 1 }), params: [], inputs: [{ key: 'grams', min: 0, max: 5000, step: 10, unit: 'g', default: 0 }] },
  // 1N4001 diode: anode, cathode (the band), laid flat like a resistor
  diode: { pins: ['A', 'K'], footprint: inRow({ A: 0, K: 4 }), covers: (at) => (inRow({ A: 0, K: 4 })(at) && !onBench(at) ? range(at.col, 5).map((c) => `${c}${at.row}`) : []), params: [], inputs: [] },
  // TIP120 Darlington transistor (TO-220, tab at the back): base, collector, emitter
  npn: { pins: ['B', 'C', 'E'], ...legsOnly({ B: 0, C: 1, E: 2 }), params: [], inputs: [] },
  // traffic-light module: red, yellow and green LEDs, each with its own resistor, and a common GND pin
  traffic: { pins: ['R', 'Y', 'G', 'GND'], ...legsOnly({ R: 0, Y: 1, G: 2, GND: 3 }), params: [], inputs: [] },

  // small DC motor (with a fan blade or bare), two solder tabs
  motor: { ...module({ w: 30, d: 30, h: 28, pins: { '+': [-3, 10, 12], '-': [3, 10, 12] } }), params: [{ key: 'load', options: ['fan', 'none'], default: 'fan' }], inputs: [] },
  // SG90 micro servo: its lead ends in a 3-pin plug — brown GND, red V+, orange signal
  servo: { ...module({ w: 34, d: 20, h: 30, pins: header(['GND', 'V+', 'SIG'], 0, 6, 16) }), params: [], inputs: [] },
  // HC-SR04 ultrasonic distance sensor, eyes facing away from the UNO; `cm` is how far the obstacle is
  hcsr04: { ...module({ w: 46, d: 22, h: 16, pins: header(['VCC', 'TRIG', 'ECHO', 'GND'], 0, 12, 9) }), params: [], inputs: [{ key: 'cm', min: 2, max: 400, step: 1, unit: 'cm', default: 30 }] },
  // 28BYJ-48 stepper on its ULN2003 driver board: IN1–IN4, + and −
  stepper: { ...module({ w: 76, d: 40, h: 22, pins: { ...header(['IN1', 'IN2', 'IN3', 'IN4'], 14, 6, 16), '+': [26, 6, 10], '-': [26, 6, 7.46] } }), params: [{ key: 'load', options: ['wheel', 'none'], default: 'wheel' }], inputs: [] },
  // 0.96" SSD1306 OLED, 128 × 64, I²C: GND, VCC, SCL, SDA
  oled: { ...module({ w: 28, d: 28, h: 12, pins: header(['GND', 'VCC', 'SCL', 'SDA'], 0, 6, -11) }), params: [], inputs: [] },
  // a breadboard: stands on the bench; its holes are wire points of their own ("<id>.12a"), parts push their legs into them
  breadboard: { ...module({ w: 82, d: 55, h: 8.5, pins: {} }), params: [], inputs: [] },
  // capacitive soil-moisture sensor standing in a plant pot: GND, VCC, AOUT
  soil: { ...module({ w: 60, d: 60, h: 60, pins: header(['GND', 'VCC', 'AOUT'], 0, 58, 14) }), params: [], inputs: [{ key: 'moisture', min: 0, max: 100, step: 1, unit: '%', default: 50 }] },
};

// Breadboards: the first is `bb`, then `breadboard2`, `breadboard3`… A hole is "<board id>.<hole>".
export const DEFAULT_BOARD = 'bb';
export const BOARD_ID = /^(bb|breadboard\d+)$/;
export const BOARD_REF = /^(bb|breadboard\d+)\./;
export const boardOf = (p: { at: Placement }): string | null => (onBench(p.at) ? null : p.at.board ?? DEFAULT_BOARD);
export const isBoard = (p: { type: PartType }) => p.type === 'breadboard';
export const BOARD_AT = { x: 50, z: 8 }; // where the first breadboard goes (as in the Blink project)
export const BOARD_SLOTS = [BOARD_AT, { x: 50, z: 80 }, { x: 50, z: -62 }, { x: 140, z: 8 }, { x: 140, z: 80 }, { x: 140, z: -62 }, { x: -60, z: 100 }, { x: -60, z: -100 }];
// the board that a hole near (x, z) belongs to, and that hole: the nearest of the ten strip rows and thirty columns
export function holeUnder(boards: readonly PartInstance[], x: number, z: number): { board: string; col: number; row: Row } | null {
  for (const b of boards) {
    if (b.type !== 'breadboard' || !onBench(b.at)) continue;
    const lx = x - b.at.x, lz = z - b.at.z;
    if (Math.abs(lx) > 41 || Math.abs(lz) > 27.5) continue;
    const col = Math.min(COLUMNS, Math.max(1, Math.round(lx / 2.54 + 15.5)));
    let row: Row = 'a', best = Infinity;
    for (const r of STRIP_ROWS) { const d = Math.abs(ROW[r] - lz); if (d < best) { best = d; row = r; } }
    return { board: b.id, col, row };
  }
  return null;
}
export const BENCH_TYPES = (Object.keys(PART_DEFS) as PartType[]).filter((t) => PART_DEFS[t].bench);

// The part's parameters with defaults filled in.
export function paramsOf(type: PartType, params: Record<string, string | number>): Record<string, string | number> {
  return Object.fromEntries(PART_DEFS[type].params.map((p) => [p.key, params[p.key] ?? p.default]));
}

// Whether the part is connected at all: a module or a part standing on the table always is; a breadboard part when its
// legs are in holes.
export const isPlaced = (p: PartInstance) => isFree(p) || footprintOf(p) !== null;

// The connection points a wire can go to on this part: the pins of a module or of a part standing on the table (a part in
// the breadboard is wired through the holes its legs are in).
export const partPoints = (p: PartInstance): string[] => (isFree(p) ? PART_DEFS[p.type].pins.map((pin) => `${p.id}.${pin}`) : []);

// The bench around the UNO and the breadboard (world mm, x by z). Modules stand anywhere on it except on those two.
export type Rect = { x: number; z: number; w: number; d: number }; // centre and size
export const BENCH_AREA: Rect = { x: 30, z: 5, w: 520, d: 380 };
export const KEEP_OUT: Rect[] = [
  { x: -38, z: 2, w: 72, d: 58 }, // the UNO (blinkLayout BLINK.board, 68.6 × 53.3 mm and a margin)
  { x: 50, z: 8, w: 86, d: 59 },  // the breadboard (blinkLayout BLINK.breadboard, 82 × 55 mm and a margin)
];
// where a new module goes first: along the back of the bench (its pins face the viewer and wires reach the UNO's digital
// header without crossing the UNO or the breadboard), then in front of them, then to the right
export const BENCH_SLOTS = [
  ...[-60, -15, 30, 75, 120].map((x) => ({ x, z: -72 })),
  ...[-60, -15, 30, 75, 120].map((x) => ({ x, z: 75 })),
  { x: 135, z: 5 },
];
export const BENCH_STEP = 10; // a move arrow moves a module this far

// A point (dx, dz) turned `rot` degrees clockwise seen from above (0° = unturned, 90° sends "right" to "towards the viewer").
export function rotatePoint(dx: number, dz: number, rot: number): [number, number] {
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [dx * c - dz * s, dx * s + dz * c];
}
// The room a module takes when turned: the box around its turned footprint.
export function benchRect(type: PartType, at: { x: number; z: number }, rot = 0): Rect {
  const b = PART_DEFS[type].bench!;
  const a = (rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { x: at.x, z: at.z, w: b.w * c + b.d * s, d: b.w * s + b.d * c };
}
export const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.z - b.z) * 2 < a.d + b.d;
export const inside = (a: Rect, area: Rect) =>
  Math.abs(a.x - area.x) * 2 + a.w <= area.w && Math.abs(a.z - area.z) * 2 + a.d <= area.d;

// ── Turning parts that sit in the breadboard ─────────────────────────────────────────────────────────────────────────
// Legs stay in holes, so a part turns in quarter turns around its first leg, and only where the turned shape fits on
// the board and in one half of it (the middle gap is not crossed). The push button straddles the gap and does not turn.
export const TURNS = [0, 90, 180, 270] as const;
export const canTurn = (type: PartType) => !PART_DEFS[type].bench && type !== 'button';

type Offsets = [dc: number, dr: number]; // columns right, rows down (row index: a = 0 … j = 9)
const rowOf = (hole: string) => STRIP_ROWS.indexOf(hole.replace(/^\d+/, '') as Row);
const colOf = (hole: string) => Number(hole.replace(/[a-j]$/, ''));

// the part's shape unturned, measured with the part placed where nothing is near an edge
const shapes = new Map<string, { legs: Record<string, Offsets>; body: Offsets[] } | null>();
function shapeOf(type: PartType, params: Record<string, string | number>) {
  const key = `${type}:${JSON.stringify(params)}`;
  if (shapes.has(key)) return shapes.get(key)!;
  const refRow: Row = type === 'button' ? 'e' : 'c', ref = { col: 15, row: refRow };
  const fp = PART_DEFS[type].footprint(ref, params);
  const off = (h: string): Offsets => [colOf(h) - 15, rowOf(h) - STRIP_ROWS.indexOf(refRow)];
  const shape = fp ? { legs: Object.fromEntries(Object.entries(fp).map(([pin, h]) => [pin, off(h)])), body: PART_DEFS[type].covers(ref, params).map(off) } : null;
  shapes.set(key, shape);
  return shape;
}
// a quarter turn clockwise seen from above sends "right" (+column) to "towards the viewer" (+row)
const turnOffsets = ([dc, dr]: Offsets, rot: number): Offsets => (rot === 90 ? [-dr, dc] : rot === 180 ? [-dc, -dr] : [dr, -dc]);

type Placed = Pick<PartInstance, 'type' | 'params' | 'rot'> & { at: Placement };
const normRot = (rot = 0) => ((Math.round(rot) % 360) + 360) % 360;

// the holes a turned part's offsets land on, or null when any is off the board or the part would cross the middle gap
function place(offsets: Offsets[], at: { col: number; row: Row }, rot: number): string[] | null {
  const base = STRIP_ROWS.indexOf(at.row), half = base < 5 ? 0 : 1, out: string[] = [];
  for (const o of offsets) {
    const [dc, dr] = turnOffsets(o, rot), col = at.col + dc, r = base + dr;
    if (col < 1 || col > COLUMNS || r < 0 || r > 9 || (r < 5 ? 0 : 1) !== half) return null;
    out.push(`${col}${STRIP_ROWS[r]}`);
  }
  return out;
}

// Where each leg is, for a part placed at \`at\` (default: its own place) and turned by its own \`rot\`: pin → hole, or null.
export function footprintOf(p: Placed, at: Placement = p.at): Record<string, string> | null {
  const rot = normRot(p.rot);
  if (onBench(at)) return null;
  if (rot === 0) return PART_DEFS[p.type].footprint(at, p.params);
  if (rot % 90 !== 0 || !canTurn(p.type)) return null;
  const sh = shapeOf(p.type, p.params);
  if (!sh) return null;
  const pins = Object.keys(sh.legs), holes = place(pins.map((k) => sh.legs[k]), at, rot);
  return holes ? Object.fromEntries(pins.map((k, i) => [k, holes[i]])) : null;
}

// Every hole the part's body sits over (legs included), or [] when it does not fit.
export function coversOf(p: Placed, at: Placement = p.at): string[] {
  const rot = normRot(p.rot);
  if (onBench(at)) return [];
  if (rot === 0) return PART_DEFS[p.type].covers(at, p.params);
  if (!footprintOf(p, at)) return [];
  const sh = shapeOf(p.type, p.params);
  return sh ? place(sh.body, at, rot) ?? [] : [];
}

// ── Parts standing on the table, no breadboard ───────────────────────────────────────────────────────────────────────
// Any part can also stand on the bench with its legs free: it is placed by its first leg (x, z in world mm), turns to any
// angle like a module, and a wire goes straight to each of its legs, as to a module's header pin.
export const isFree = (p: Pick<PartInstance, 'type' | 'at'>) => !!PART_DEFS[p.type].bench || onBench(p.at);
export const isLoose = (p: Pick<PartInstance, 'type' | 'at'>) => !PART_DEFS[p.type].bench && onBench(p.at);
// Whether a build needs the breadboard at all: a part in its holes, or a wire to one of them.
export const usesBreadboard = (parts: readonly PartInstance[], wires: readonly Wire[]) =>
  parts.some((p) => !onBench(p.at)) || wires.some((w) => BOARD_REF.test(w.from) || BOARD_REF.test(w.to));
export const LOOSE_LEG_Y = 2.4; // how high a leg's lower end is above the table: where a wire plugs in
// the breadboard hole a loose part's drawing is built around (the models are made for holes and moved onto the table)
export const looseAnchor = (type: PartType): BoardPlacement => ({ col: 15, row: type === 'button' ? 'e' : 'c' });

// where each leg is, from the first leg (mm; x to the right, z towards the viewer)
export function loosePins(type: PartType, params: Record<string, string | number>): Record<string, [number, number, number]> {
  const sh = shapeOf(type, params), a = looseAnchor(type), i0 = STRIP_ROWS.indexOf(a.row);
  if (!sh) return {};
  return Object.fromEntries(Object.entries(sh.legs).map(([pin, [dc, dr]]) => [pin, [dc * 2.54, LOOSE_LEG_Y, ROW[STRIP_ROWS[i0 + dr]] - ROW[a.row]] as [number, number, number]]));
}
// how far a loose part's body reaches beyond its outermost legs (mm): the bigger bodies (the traffic-light board, the TIP120,
// the desk lamp that comes with the light sensor, the force sensor's strip) need more room around them
const LOOSE_PAD: Partial<Record<PartType, number>> = { pot: 9, buzzer: 10, ldr: 16, npn: 12, traffic: 18, fsr: 20, button: 7, rgb: 7, tmp36: 7 };
// The room a part takes on the table, turned: a module's box, or the legs and body of a loose part.
export function partRect(p: Pick<PartInstance, 'type' | 'params'>, at: { x: number; z: number }, rot = 0): Rect {
  if (PART_DEFS[p.type].bench) return benchRect(p.type, at, rot);
  const pts = Object.values(loosePins(p.type, p.params)).map(([x, , z]) => rotatePoint(x, z, rot)), PAD = LOOSE_PAD[p.type] ?? 6;
  const x0 = Math.min(...pts.map((q) => q[0])) - PAD, x1 = Math.max(...pts.map((q) => q[0])) + PAD;
  const z0 = Math.min(...pts.map((q) => q[1])) - PAD, z1 = Math.max(...pts.map((q) => q[1])) + PAD;
  return { x: at.x + (x0 + x1) / 2, z: at.z + (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}
// where a new loose part goes first: in rows behind and in front of the modules
// (nearest to the UNO and the breadboard first)
export const LOOSE_SLOTS = [-115, 112, -145, 142, 172].flatMap((z) => [-158, -124, -90, -56, -22, 12, 46, 80, 114, 148].map((x) => ({ x, z })))
  .sort((a, b) => Math.hypot(a.x - 20, a.z) - Math.hypot(b.x - 20, b.z));
// The distance sensor looks along its own front, and the toy obstacle stands that far in front of it: a new one is turned to
// face the open right-hand side of the bench, so the obstacle never ends up on the UNO or the breadboard.
export const START_TURN: Partial<Record<PartType, number>> = { hcsr04: 270 };
export const FACING_SLOTS = [{ x: 150, z: 5 }, { x: 150, z: -70 }, { x: 150, z: 80 }];
