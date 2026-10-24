// Typed access to uno-layout.json, extracted from the official UNO Rev3 design files
// (Arduino, CC BY-SA 4.0) by tools/extract-uno-layout.py.
// Board coordinates are EAGLE millimetres: x from the USB edge, y from the power-header edge.
import raw from './uno-layout.json';

export const UNO = { L: 68.58, W: 53.34, T: 1.6 } as const;

export type UnoElement = { name: string; pkg: string; value: string; x: number; y: number; rot: number; bottom: boolean };
export type Pad = { x: number; y: number; drill: number; diameter: number; shape: string; rot: number; element: string };
export type Smd = { x: number; y: number; dx: number; dy: number; rot: number; roundness: number; element: string };
export type Seg = [x1: number, y1: number, x2: number, y2: number, width: number, layer: number];
export type OutlineVertex = { x: number; y: number; arc?: { cx: number; cy: number } };

type Raw = {
  outline: [number, number, number, number, number][];
  holes: [number, number, number][];
  elements: UnoElement[];
  copper: [number, number, number, number, number][];
  vias: [number, number, number][];
  smd: [number, number, number, number, number, number, string][];
  pads: [number, number, number, number, string, number, string][];
  silk: [number, number, number, number, number][];
  silkCircles: [number, number, number, number][];
  texts: [number, number, number, number, string, string][];
  pinTraces: Record<string, { signal: string; segs: Seg[] }>;
};
export const LAYOUT = raw as unknown as Raw;

const ELEMENTS = new Map(LAYOUT.elements.map((e) => [e.name, e]));
export function element(name: string): UnoElement {
  const e = ELEMENTS.get(name);
  if (!e) throw new Error(`Unknown Uno element: ${name}`);
  return e;
}
export const topElements = (): UnoElement[] => LAYOUT.elements.filter((e) => !e.bottom);

const PADS: Pad[] = LAYOUT.pads.map(([x, y, drill, diameter, shape, rot, el]) => ({ x, y, drill, diameter, shape, rot, element: el }));
const SMDS: Smd[] = LAYOUT.smd.map(([x, y, dx, dy, rot, roundness, el]) => ({ x, y, dx, dy, rot, roundness, element: el }));
export const allPads = (): Pad[] => PADS;
export const allSmd = (): Smd[] => SMDS;
export const padsOf = (name: string): Pad[] => PADS.filter((p) => p.element === name);
export const smdOf = (name: string): Smd[] => SMDS.filter((p) => p.element === name);

// Header pin labels, left to right along each header's pad row.
const HEADER_LABELS: Record<string, string[]> = {
  IOH: ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '11', '10', '9', '8'],
  IOL: ['7', '6', '5', '4', '3', '2', '1', '0'],
  POWER: ['NC', 'IOREF', 'RESET', '3.3V', '5V', 'GND_P1', 'GND_P2', 'VIN'],
  AD: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
};
export type HeaderLabel = string;
const HEADER_PINS = new Map<string, { x: number; y: number }>();
for (const [el, labels] of Object.entries(HEADER_LABELS)) {
  [...padsOf(el)].sort((a, b) => a.x - b.x).forEach((p, i) => HEADER_PINS.set(labels[i], { x: p.x, y: p.y }));
}
export function headerPin(label: HeaderLabel): { x: number; y: number } {
  const p = HEADER_PINS.get(label);
  if (!p) throw new Error(`Unknown header pin: ${label}`);
  return p;
}
export const headerRow = (el: 'IOH' | 'IOL' | 'POWER' | 'AD') => [...padsOf(el)].sort((a, b) => a.x - b.x);

const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;

// Chains the outline segments into one ordered loop. `arc` on a vertex means the edge
// leaving it is a 90° corner arc, drawn as a quadratic curve through the outer corner.
export function outlineLoop(): OutlineVertex[] {
  const segs = LAYOUT.outline.map(([x1, y1, x2, y2, curve]) => ({ x1, y1, x2, y2, curve }));
  const loop: OutlineVertex[] = [];
  let cur = segs.shift()!;
  for (;;) {
    const v: OutlineVertex = { x: cur.x1, y: cur.y1 };
    if (cur.curve) {
      const c1 = { cx: cur.x1, cy: cur.y2 }, c2 = { cx: cur.x2, cy: cur.y1 };
      const d = (c: { cx: number; cy: number }) => (c.cx - UNO.L / 2) ** 2 + (c.cy - UNO.W / 2) ** 2;
      v.arc = d(c1) > d(c2) ? c1 : c2;
    }
    loop.push(v);
    const i = segs.findIndex((g) => (near(g.x1, cur.x2) && near(g.y1, cur.y2)) || (near(g.x2, cur.x2) && near(g.y2, cur.y2)));
    if (i < 0) break;
    const next = segs.splice(i, 1)[0];
    cur = near(next.x1, cur.x2) && near(next.y1, cur.y2) ? next : { x1: next.x2, y1: next.y2, x2: next.x1, y2: next.y1, curve: -next.curve };
  }
  return loop;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
export function boardToLocal(x: number, y: number, h = 0): [number, number, number] {
  return [r6(x - UNO.L / 2), r6(UNO.T + h), r6(UNO.W / 2 - y)];
}

export const PIN_TRACES = LAYOUT.pinTraces;
