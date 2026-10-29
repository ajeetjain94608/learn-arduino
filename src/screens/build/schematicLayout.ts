// Lays out a circuit as a real schematic: the UNO as a block with the pins in use, every part as its symbol, joined by drawn
// wires — and power the way engineers draw it: a ground symbol under each pin on GND, a supply flag (+5V) on each pin on a supply.
// Pure geometry (no React): tested in schematicLayout.test.ts, drawn by Schematic.tsx.

export type Term = { pin: string; x: number; y: number; dx: number; dy: number }; // a pin's end on its symbol, and the way it points
export type Shape = { w: number; h: number; terms: Term[]; flippable: boolean; through: boolean }; // a symbol's size and pins (unflipped); through: a chain of parts goes on past it (two-sided parts; not a module box)
export type Pt = [number, number];
export type Placed = { id: string; x: number; y: number; flip: boolean; shape: Shape };
// side: on a module's pins (close together) the symbol points out sideways (-1 left, 1 right); 0 = the usual way (ground down, supply up)
export type Flag = { x: number; y: number; kind: 'gnd' | 'supply'; label: string; ref: string; side: number };
export type Layout = {
  width: number; height: number;
  uno: { x: number; y: number; w: number; h: number; pins: { pin: string; y: number; ref: string }[] };
  parts: Placed[];
  wires: { net: string; color: string | null; path: Pt[] }[];
  dots: Pt[];
  flags: Flag[];
  terminals: { ref: string; x: number; y: number; dx: number; dy: number; label: string }[];
};
export type Nets = { netOf(ref: string): number; nameOf(ref: string): string | null; colorOf(ref: string): string | null };

const SUPPLIES = ['5V', '3V3', 'VIN'];
const UNO_ORDER = ['5V', '3V3', 'VIN', ...Array.from({ length: 14 }, (_, i) => `D${i}`), ...Array.from({ length: 6 }, (_, i) => `A${i}`), 'AREF', 'GND'];
const PIN_GAP = 26, UNO_W = 96, STUB = 24, COL_GAP = 46, ROW_GAP = 34, MARGIN = 24, LEAD = 12;

// where a pin of a placed symbol is, in the drawing
function termAt(p: Placed, t: Term): Term {
  return p.flip ? { pin: t.pin, x: p.x + p.shape.w - t.x, y: p.y + t.y, dx: -t.dx, dy: t.dy } : { pin: t.pin, x: p.x + t.x, y: p.y + t.y, dx: t.dx, dy: t.dy };
}

// an orthogonal wire between two pin ends: straight out of each pin first, then across
type End = { x: number; y: number; dx: number; dy: number };
export function route(a: End, b: End, lane = 0): Pt[] {
  const a1: Pt = [a.x + a.dx * LEAD, a.y + a.dy * LEAD], b1: Pt = [b.x + b.dx * LEAD, b.y + b.dy * LEAD];
  const pts: Pt[] = [[a.x, a.y], a1];
  if (a1[1] !== b1[1] && a1[0] !== b1[0]) {
    if (a.dy !== 0) pts.push([b1[0], a1[1]]);            // out of a top/bottom pin: across first
    else { const mx = Math.round((a1[0] + b1[0]) / 2) + ((lane % 5) - 2) * 6; pts.push([mx, a1[1]], [mx, b1[1]]); } // each net its own lane: wires never run on top of each other
  }
  pts.push(b1, [b.x, b.y]);
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}

export function layoutSchematic(parts: { id: string; type: string; pins: string[] }[], shapeOf: (type: string) => Shape, nets: Nets): Layout {
  const ref = (id: string, pin: string) => `${id}.${pin}`;
  const isPower = (r: string) => { const n = nets.nameOf(r); return !!n && (n === 'GND' || SUPPLIES.includes(n)); };
  // the UNO pins that matter: those on a net with something else on it
  const unoPins = UNO_ORDER.filter((p) => nets.nameOf(`uno.${p}`) !== null);
  const pinY = (i: number) => MARGIN + 34 + i * PIN_GAP;
  const uno = { x: MARGIN, y: MARGIN, w: UNO_W, h: Math.max(80, 34 + unoPins.length * PIN_GAP + 10), pins: unoPins.map((p, i) => ({ pin: p, y: pinY(i), ref: `uno.${p}` })) };
  const unoEdge = uno.x + uno.w;

  // which parts are on each net
  const onNet = new Map<number, { id: string; pin: string }[]>();
  for (const p of parts) for (const pin of p.pins) { const n = nets.netOf(ref(p.id, pin)); (onNet.get(n) ?? onNet.set(n, []).get(n)!).push({ id: p.id, pin }); }

  // walk out from each UNO signal pin: the first part on its net goes in that pin's row, the next part along goes after it…
  const placedAt = new Map<string, { row: number; col: number; enter: string | null }>();
  let rows = 0;
  const rowOfPin = new Map<string, number>();
  const walk = (start: number, row: number) => {
    let frontier = [start], col = 0;
    const seen = new Set<number>([start]);
    while (frontier.length) {
      const next: number[] = [];
      for (const n of frontier) for (const { id, pin } of onNet.get(n) ?? []) {
        if (placedAt.has(id)) continue;
        placedAt.set(id, { row, col, enter: pin });
        const p = parts.find((x) => x.id === id)!;
        if (!shapeOf(p.type).through) continue; // a module ends the chain: what hangs off its other pins gets rows of its own
        for (const other of p.pins) {
          if (other === pin || isPower(ref(id, other))) continue;
          const m = nets.netOf(ref(id, other));
          if (!seen.has(m)) { seen.add(m); next.push(m); }
        }
      }
      frontier = next; col++;
    }
  };
  for (const p of unoPins) {
    if (p === 'GND' || SUPPLIES.includes(p)) continue;
    const before = placedAt.size;
    walk(nets.netOf(`uno.${p}`), rows);
    if (placedAt.size > before) { rowOfPin.set(p, rows); rows++; }
  }
  // parts reached only through power (a sensor between 5V and GND) or not wired at all: a row each, in order
  for (const p of parts) if (!placedAt.has(p.id)) {
    const before = placedAt.size;
    const firstSignal = p.pins.find((pin) => !isPower(ref(p.id, pin)) && nets.nameOf(ref(p.id, pin)));
    if (firstSignal) walk(nets.netOf(ref(p.id, firstSignal)), rows);
    if (!placedAt.has(p.id)) placedAt.set(p.id, { row: rows, col: 0, enter: null });
    if (placedAt.size > before || !firstSignal) rows++;
  }

  // two parts given the same spot: the later one moves down to a row of its own
  const taken = new Set<string>();
  const extraRows: number[] = [];
  for (const p of parts) {
    const at = placedAt.get(p.id)!;
    while (taken.has(`${at.row}:${at.col}`)) { at.row = rows + extraRows.length; extraRows.push(at.row); }
    taken.add(`${at.row}:${at.col}`);
  }
  const nRows = Math.max(1, ...[...placedAt.values()].map((a) => a.row + 1));
  const rowH = Array.from({ length: nRows }, (_, r) => Math.max(70, ...parts.filter((p) => placedAt.get(p.id)!.row === r).map((p) => shapeOf(p.type).h)) + ROW_GAP);
  const cols = Math.max(0, ...[...placedAt.values()].map((a) => a.col)) + 1;
  const colW = Array.from({ length: cols }, (_, c) => Math.max(120, ...parts.filter((p) => placedAt.get(p.id)!.col === c).map((p) => shapeOf(p.type).w)) + COL_GAP);
  const lanes = new Set(parts.flatMap((p) => p.pins.map((pin) => nets.netOf(ref(p.id, pin))))).size;
  const colX = (c: number) => unoEdge + STUB + 40 + Math.min(60, lanes * 4) + colW.slice(0, c).reduce((s, w) => s + w, 0);
  // a row sits level with its UNO pin when it can (rows below follow on)
  const rowTop: number[] = [];
  for (let r = 0; r < nRows; r++) {
    const pin = [...rowOfPin.entries()].find(([, row]) => row === r)?.[0];
    const want = pin ? pinY(unoPins.indexOf(pin)) - 40 : 0; // (a two-legged symbol's pins are 40 below its top)
    const after = r === 0 ? MARGIN : rowTop[r - 1] + rowH[r - 1];
    rowTop.push(Math.max(after, want));
  }

  const placed: Placed[] = parts.map((p) => {
    const at = placedAt.get(p.id)!, shape = shapeOf(p.type);
    const enterTerm = at.enter ? shape.terms.find((t) => t.pin === at.enter) : undefined;
    const flip = shape.flippable && !!enterTerm && enterTerm.dx > 0; // the pin the wire comes in on faces the UNO
    return { id: p.id, x: colX(at.col), y: rowTop[at.row], flip, shape };
  });

  // terminals: every UNO pin in use and every part pin
  const terminals: Layout['terminals'] = [
    ...uno.pins.map((u) => ({ ref: u.ref, x: unoEdge + STUB, y: u.y, dx: 1, dy: 0, label: u.pin })),
    ...placed.flatMap((p) => p.shape.terms.map((t) => { const at = termAt(p, t); return { ref: ref(p.id, t.pin), x: at.x, y: at.y, dx: at.dx, dy: at.dy, label: t.pin }; })),
  ];

  // power: a symbol on every pin on GND or a supply (the UNO's own power pins included)
  const flags: Flag[] = [];
  for (const t of terminals) {
    const name = nets.nameOf(t.ref);
    if (!name || !(name === 'GND' || SUPPLIES.includes(name))) continue;
    const end = { x: t.x + t.dx * LEAD, y: t.y + t.dy * LEAD };
    const onBox = !t.ref.startsWith('uno.') && !placed.find((p) => t.ref.startsWith(`${p.id}.`))?.shape.through;
    flags.push({ x: end.x, y: end.y, kind: name === 'GND' ? 'gnd' : 'supply', label: name === 'GND' ? 'GND' : `+${name}`, ref: t.ref, side: onBox ? t.dx : 0 });
  }

  // signal nets: a wire from each pin to the next along the net (left to right), with a dot where three or more meet
  const groups = new Map<number, typeof terminals>();
  for (const t of terminals) {
    const name = nets.nameOf(t.ref);
    if (!name || name === 'GND' || SUPPLIES.includes(name)) continue;
    const n = nets.netOf(t.ref);
    (groups.get(n) ?? groups.set(n, []).get(n)!).push(t);
  }
  // where a wire must not pass: the body of every part (its leads stick out of it)
  const bodies = new Map(placed.map((p) => [p.id, { x0: p.x + 22, x1: p.x + p.shape.w - 22, y0: p.y + 16, y1: p.y + p.shape.h - 10 }]));
  const owner = (r: string) => (r.startsWith('uno.') ? null : r.slice(0, r.indexOf('.')));
  const crosses = (pts: Pt[], skip: (string | null)[]) => pts.some((p, i) => {
    if (!i) return false;
    const [x0, y0] = pts[i - 1], [x1, y1] = p;
    return [...bodies].some(([id, r]) => !skip.includes(id) && Math.max(x0, x1) > r.x0 && Math.min(x0, x1) < r.x1 && Math.max(y0, y1) > r.y0 && Math.min(y0, y1) < r.y1);
  });
  const wires: Layout['wires'] = [], dots: Pt[] = [];
  let lane = 0;
  for (const g of groups.values()) {
    const list = [...g].sort((a, b) => a.x - b.x || a.y - b.y), k = lane++;
    for (let j = 1; j < list.length; j++) {
      const a = list[j - 1], b = list[j], skip = [owner(a.ref), owner(b.ref)];
      let path = route(a, b, k);
      if (crosses(path, skip)) { // around the parts: up into the gap above the far part, along it, down the lane in front of it
        const a1: Pt = [a.x + a.dx * LEAD + (a.dx > 0 ? (k % 5) * 5 : 0), a.y + a.dy * LEAD], b1: Pt = [b.x + b.dx * LEAD, b.y + b.dy * LEAD];
        const body = owner(b.ref) ? bodies.get(owner(b.ref)!)! : null;
        const chan = (body ? body.y0 - 20 : b1[1] - 24) - (k % 5) * 5;
        const laneX = b1[0] + (b.dx > 0 ? 1 : -1) * (4 + (k % 4) * 5);
        path = [[a.x, a.y], a1, [a1[0], chan], [laneX, chan], [laneX, b1[1]], b1, [b.x, b.y]];
      }
      wires.push({ net: nets.nameOf(a.ref)!, color: nets.colorOf(a.ref), path });
    }
    if (list.length > 2) for (const t of list.slice(1, -1)) dots.push([t.x + t.dx * LEAD, t.y + t.dy * LEAD]);
  }

  const right = Math.max(unoEdge + STUB + 60, ...placed.map((p) => p.x + p.shape.w)) + MARGIN;
  const bottom = Math.max(uno.y + uno.h, ...placed.map((p) => p.y + p.shape.h), ...flags.map((f) => f.y + 24)) + MARGIN;
  return { width: right, height: bottom, uno, parts: placed, wires, dots, flags, terminals };
}
