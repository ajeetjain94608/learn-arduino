// The schematic sheet's geometry, the way an EDA schematic editor works: symbols stand where they are put (on a 10-unit grid)
// and turn in quarter turns; wires drawn on the sheet keep their corners; any connection the circuit has that no drawn wire
// shows is routed automatically (right-angled); a ground or supply flag goes on the power pins; a dot marks where wires join.
// Pure (no React): tested in schematicSheet.test.ts, drawn by Schematic.tsx.
import { route, type Nets, type Pt } from './schematicLayout';

export const GRID = 10;
export const snap = (v: number) => Math.round(v / GRID) * GRID;
export type SymTerm = { pin: string; x: number; y: number; dx: number; dy: number }; // a pin's end (in the symbol), the way it points
export type Sym = { w: number; h: number; terms: SymTerm[] };
export type Pos = { x: number; y: number; rot: number };
export type Placed = { id: string; pos: Pos; sym: Sym };
export type Terminal = { ref: string; id: string; pin: string; x: number; y: number; dx: number; dy: number };
export type DrawnWire = { id: string; wire: string; from: string; to: string; pts: Pt[] };
export type Flag = { x: number; y: number; dx: number; dy: number; kind: 'gnd' | 'supply'; label: string; ref: string };

const SUPPLIES = ['5V', '3V3', 'VIN'];
export const isPowerNet = (name: string | null) => !!name && (name === 'GND' || SUPPLIES.includes(name));

// a point of a symbol, turned (clockwise, in quarter turns) about the symbol's middle
export function turn(x: number, y: number, sym: Sym, rot: number): Pt {
  const cx = sym.w / 2, cy = sym.h / 2;
  let dx = x - cx, dy = y - cy;
  for (let k = 0; k < (((rot / 90) % 4) + 4) % 4; k++) [dx, dy] = [-dy, dx];
  return [cx + dx + 0, cy + dy + 0];
}
const turnDir = (dx: number, dy: number, rot: number): Pt => { let a = dx, b = dy; for (let k = 0; k < (((rot / 90) % 4) + 4) % 4; k++) [a, b] = [-b, a]; return [a + 0, b + 0]; }; // (+ 0: no −0)

export function terminals(p: Placed): Terminal[] {
  return p.sym.terms.map((t) => {
    const [x, y] = turn(t.x, t.y, p.sym, p.pos.rot), [dx, dy] = turnDir(t.dx, t.dy, p.pos.rot);
    return { ref: `${p.id}.${t.pin}`, id: p.id, pin: t.pin, x: p.pos.x + x, y: p.pos.y + y, dx, dy };
  });
}
// the area a placed symbol covers (its turned box)
export function boxOf(p: Placed): { x0: number; y0: number; x1: number; y1: number } {
  const quarter = (((p.pos.rot / 90) % 2) + 2) % 2 === 1;
  const w = quarter ? p.sym.h : p.sym.w, h = quarter ? p.sym.w : p.sym.h;
  const cx = p.pos.x + p.sym.w / 2, cy = p.pos.y + p.sym.h / 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

// where a symbol goes when nobody has put it anywhere yet: in a column by how far along its chain it is from the UNO
// (`order`: 0 next to the UNO, 1 after that…), level with the UNO pin it is wired to; never on top of another symbol
export function defaultPlaces(items: { id: string; sym: Sym; order: number; unoPin?: { y: number }; enter?: SymTerm }[], uno: Placed, taken: Placed[]): Map<string, Pos> {
  const out = new Map<string, Pos>();
  const unoRight = boxOf(uno).x1;
  const placed = [...taken];
  for (const it of items) {
    const x = snap(unoRight + 90 + it.order * 200);
    const enterRight = it.enter && it.enter.dx > 0; // its wire comes in on its right: turn it round so that pin faces the UNO
    const rot = enterRight ? 180 : 0;
    const ty = it.unoPin && it.enter ? it.unoPin.y - (enterRight ? it.sym.h - it.enter.y : it.enter.y) : uno.pos.y + 20;
    let y = snap(ty);
    const fits = (yy: number) => { const b = boxOf({ id: it.id, pos: { x, y: yy, rot }, sym: it.sym }); return !placed.some((o) => { const c = boxOf(o); return b.x0 < c.x1 + 10 && b.x1 > c.x0 - 10 && b.y0 < c.y1 + 10 && b.y1 > c.y0 - 10; }); };
    while (!fits(y)) y += GRID * 2;
    const pos = { x, y, rot };
    out.set(it.id, pos); placed.push({ id: it.id, pos, sym: it.sym });
  }
  return out;
}

// right angles: a straight line from a to b gets an elbow where it would run diagonally
export function orthogonal(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (q && q[0] !== p[0] && q[1] !== p[1]) out.push([p[0], q[1]]);
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  return out;
}

export type SheetWire = { path: Pt[]; net: string | null; drawn?: DrawnWire };
// every wire on the sheet: the drawn ones as drawn (their ends follow the pins), then whatever the circuit joins that they do not
// show, routed automatically — except power, which gets a flag on each pin that has no drawn wire
export function sheetWires(terms: Terminal[], nets: Nets, drawn: DrawnWire[]): { wires: SheetWire[]; flags: Flag[]; dots: Pt[] } {
  const at = new Map(terms.map((t) => [t.ref, t]));
  const parent = new Map<string, string>();
  const find = (r: string): string => { const p = parent.get(r); if (!p || p === r) return r; const q = find(p); parent.set(r, q); return q; };
  const join = (a: string, b: string) => parent.set(find(a), find(b));
  const wires: SheetWire[] = [], ends = new Map<string, number>();
  const end = (p: Pt) => ends.set(`${p[0]},${p[1]}`, (ends.get(`${p[0]},${p[1]}`) ?? 0) + 1);
  const wired = new Set<string>();
  for (const d of drawn) {
    const a = at.get(d.from), b = at.get(d.to);
    if (!a || !b || nets.netOf(d.from) !== nets.netOf(d.to)) continue; // (its pins are gone, or the circuit no longer joins them)
    const path = orthogonal([[a.x, a.y], ...d.pts, [b.x, b.y]]);
    wires.push({ path, net: nets.nameOf(d.from), drawn: d });
    join(d.from, d.to); wired.add(d.from); wired.add(d.to);
    end(path[0]); end(path[path.length - 1]);
  }
  const flags: Flag[] = [];
  const byNet = new Map<number, Terminal[]>();
  for (const t of terms) {
    const name = nets.nameOf(t.ref);
    if (!name) continue;
    if (isPowerNet(name)) {
      if (!wired.has(t.ref)) flags.push({ x: t.x, y: t.y, dx: t.dx, dy: t.dy, kind: name === 'GND' ? 'gnd' : 'supply', label: name === 'GND' ? 'GND' : `+${name}`, ref: t.ref });
      continue;
    }
    const n = nets.netOf(t.ref);
    (byNet.get(n) ?? byNet.set(n, []).get(n)!).push(t);
  }
  let lane = 0;
  for (const [, list] of byNet) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.x - b.x || a.y - b.y), k = lane++;
    for (let i = 1; i < sorted.length; i++) {
      // join each pin to the nearest one before it that is not joined to it yet
      const b = sorted[i];
      const a = sorted.slice(0, i).filter((x) => find(x.ref) !== find(b.ref)).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
      if (!a) continue;
      const path = route(a, b, k);
      wires.push({ path, net: nets.nameOf(a.ref) });
      join(a.ref, b.ref);
      end(path[0]); end(path[path.length - 1]);
    }
  }
  const dots: Pt[] = [...ends].filter(([, c]) => c >= 2).map(([k]) => k.split(',').map(Number) as Pt); // two wires on one pin: three conductors meet
  return { wires, flags, dots };
}
