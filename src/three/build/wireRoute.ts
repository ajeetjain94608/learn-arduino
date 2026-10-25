import * as THREE from 'three';
import { HOUSING_H } from '../parts/jumperCurves';

export type WireEnds = { id: string; from: string; to: string; a: THREE.Vector3; b: THREE.Vector3 };
export type Obstacle = { box: THREE.Box3 };
// kind 'flat': a pre-cut jumper lying on the breadboard; 'arch': a Dupont jumper standing up out of its holes.
// `curve` is the wire's centre line (for the tube); `points` the whole wire, housings included, every ~1.5 mm.
export type Route = { kind: 'flat' | 'arch'; curve: THREE.Curve<THREE.Vector3>; points: THREE.Vector3[] };

const CLEAR = 2;          // mm between wires, and between a wire and a part
const FLAT_LIFT = 1.4;    // a flat jumper's centre above the board
const FLAT_MAX = 26;      // longest flat jumper (10 holes)
const SHARED = HOUSING_H + 8; // near an end two wires share (one UNO socket), they may touch

const flatSpan = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(b.x - a.x, b.z - a.z);

// Ends two wires have at the same or a neighbouring socket.
function sharedEnds(endsP: THREE.Vector3[], endsQ: THREE.Vector3[]): THREE.Vector3[] {
  const near = (e: THREE.Vector3, others: THREE.Vector3[]) => others.some((f) => e.distanceTo(f) < 3);
  return [...endsP.filter((e) => near(e, endsQ)), ...endsQ.filter((e) => near(e, endsP))];
}

// The closest two wires come, ignoring the stretch next to an end they share (or a neighbouring socket).
export function minDistance(p: THREE.Vector3[], q: THREE.Vector3[], endsP: THREE.Vector3[], endsQ: THREE.Vector3[]): number {
  // plugs in the same or neighbouring sockets (2.54 mm pitch) sit side by side, as real Dupont housings do
  const shared = sharedEnds(endsP, endsQ);
  const far = (v: THREE.Vector3) => shared.every((s) => v.distanceTo(s) > SHARED);
  const pp = p.filter(far), qq = q.filter(far);
  if (!pp.length || !qq.length) return Infinity;
  const bp = new THREE.Box3().setFromPoints(pp).expandByScalar(CLEAR + 1), bq = new THREE.Box3().setFromPoints(qq);
  if (!bp.intersectsBox(bq)) return Infinity;
  let best = Infinity;
  for (const u of pp) {
    if (!bq.distanceToPoint(u)) { for (const v of qq) best = Math.min(best, u.distanceTo(v)); continue; }
    if (bq.distanceToPoint(u) < best) for (const v of qq) best = Math.min(best, u.distanceTo(v));
  }
  return best;
}

// about every 1.2 mm: a Catmull-Rom curve gives each control-point segment an equal share of t, so each segment
// is sampled in proportion to its own length (cheaper than measuring the whole curve's arc length)
function spaced(curve: THREE.CatmullRomCurve3): THREE.Vector3[] {
  const pts = curve.points, segs = pts.length - 1, out: THREE.Vector3[] = [pts[0].clone()];
  for (let i = 0; i < segs; i++) {
    const n = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i + 1]) / 1.2));
    for (let k = 1; k <= n; k++) out.push(curve.getPoint((i + k / n) / segs));
  }
  return out;
}

function vertical(from: THREE.Vector3, h: number): THREE.Vector3[] {
  const n = Math.ceil(h / 1.5);
  return Array.from({ length: n + 1 }, (_, i) => from.clone().setY(from.y + (h * i) / n));
}

function flatRoute(a: THREE.Vector3, b: THREE.Vector3): Route {
  const up = (p: THREE.Vector3, h: number) => p.clone().setY(p.y + h);
  const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize().multiplyScalar(0.7);
  const curve = new THREE.CatmullRomCurve3([a.clone(), up(a, FLAT_LIFT * 0.6), up(a, FLAT_LIFT).add(d), up(b, FLAT_LIFT).sub(d), up(b, FLAT_LIFT * 0.6), b.clone()], false, 'centripetal');
  return { kind: 'flat', curve, points: spaced(curve).filter((p) => p.y > Math.min(a.y, b.y) + 0.5) };
}

// An arch `lift` mm above the taller housing, bowed sideways by `bulge` mm (in plan view). A steep arch climbs
// almost straight up out of its plugs before it travels, so it clears the neighbouring plugs and the wires leaving them.
function archRoute(a: THREE.Vector3, b: THREE.Vector3, lift: number, bulge: number, steep = false): Route {
  const top = Math.max(a.y, b.y) + HOUSING_H + lift;
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
  dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(bulge);
  const at = (t: number, y: number, bow: number) => a.clone().lerp(b, t).setY(y).addScaledVector(side, bow);
  const rise = (p: THREE.Vector3) => (steep ? Math.max(p.y + HOUSING_H + 4, top - 5) : p.y + HOUSING_H + 4);
  const span = Math.hypot(b.x - a.x, b.z - a.z), edge = steep ? Math.min(0.15, 5 / Math.max(span, 1)) : 0.15;
  const curve = new THREE.CatmullRomCurve3([
    a.clone().setY(a.y + HOUSING_H - 0.5), a.clone().setY(rise(a)),
    at(edge, top - (steep ? 1 : 3), 0.6), at(0.5, top, 1), at(1 - edge, top - (steep ? 1 : 3), 0.6),
    b.clone().setY(rise(b)), b.clone().setY(b.y + HOUSING_H - 0.5),
  ], false, 'centripetal');
  return { kind: 'arch', curve, points: [...vertical(a, HOUSING_H - 0.5).slice(1), ...spaced(curve), ...vertical(b, HOUSING_H - 0.5).slice(1)] };
}

const isHole = (ref: string) => ref.startsWith('bb.');
const straight = (a: THREE.Vector3, b: THREE.Vector3) => Math.abs(a.x - b.x) < 0.1 || Math.abs(a.z - b.z) < 0.1;

// Lays out every wire so none touches another or passes through a part: shortest wires first, each taking the
// lowest arch (or flat path) that keeps CLEAR mm from everything already laid. Same input, same layout.
// A wire that found no clear path goes first in the next round (up to 4 rounds); the round with fewest such wins.
export function routeWires(wires: WireEnds[], obstacles: Obstacle[]): Map<string, Route> {
  let order = [...wires].sort((x, y) => flatSpan(x.a, x.b) - flatSpan(y.a, y.b) || (x.id < y.id ? -1 : 1));
  let best: { out: Map<string, Route>; crowded: WireEnds[] } | null = null;
  for (let round = 0; round < 4; round++) {
    const r = routePass(order, wires, obstacles);
    if (!best || r.crowded.length < best.crowded.length) best = r;
    if (!r.crowded.length) break;
    order = [...r.crowded, ...order.filter((w) => !r.crowded.includes(w))];
  }
  routeWires.crowded += best!.crowded.length;
  return best!.out;
}

function routePass(order: WireEnds[], wires: WireEnds[], obstacles: Obstacle[]): { out: Map<string, Route>; crowded: WireEnds[] } {
  const out = new Map<string, Route>(), crowded: WireEnds[] = [];

  const hitsParts = (w: WireEnds, r: Route) => r.points.some((p) =>
    [w.a, w.b].every((e) => Math.hypot(p.x - e.x, p.z - e.z) > 1.6) // a part may sit right next to the wire's own hole
    && obstacles.some((o) => o.box.distanceToPoint(p) < (r.kind === 'flat' ? 0.3 : CLEAR)));
  // every laid wire's points in a grid of CLEAR-sized cells, so a candidate only checks its neighbourhood
  const grid = new Map<string, { p: THREE.Vector3; l: number }[]>(); // l: the wire's place in `order`
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const cell = (v: number) => Math.floor(v / CLEAR);
  // how many of the candidate's points come too close to a laid wire (0 = clear)
  const conflicts = (w: WireEnds, r: Route, stopAt: number) => {
    const me = order.indexOf(w);
    const zones = order.map((o) => sharedEnds([w.a, w.b], [o.a, o.b]));
    let n = 0;
    for (const p of r.points) {
      const cx = cell(p.x), cy = cell(p.y), cz = cell(p.z);
      let hit = false;
      for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) for (let dz = -1; dz <= 1 && !hit; dz++) {
        for (const q of grid.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
          if (q.l === me || p.distanceTo(q.p) >= CLEAR) continue;
          const z = zones[q.l];
          if (z.some((e) => p.distanceTo(e) <= SHARED) || z.some((e) => q.p.distanceTo(e) <= SHARED)) continue;
          hit = true; break;
        }
      }
      if (hit && ++n >= stopAt) return n;
    }
    return n;
  };
  // other wires' plugs on the holes a flat jumper would lie across
  const endsUnder = (w: WireEnds) => wires.some((o) => o !== w && [o.a, o.b].some((e) =>
    [w.a, w.b].every((x) => x.distanceTo(e) > 0.1) && new THREE.Line3(w.a, w.b).closestPointToPoint(e, true, new THREE.Vector3()).distanceTo(e) < 1.3));

  const put = (p: THREE.Vector3, l: number) => { const k = key(cell(p.x), cell(p.y), cell(p.z)); (grid.get(k) ?? grid.set(k, []).get(k)!).push({ p, l }); };
  // every plug stands where it stands whatever path its wire takes: all of them are obstacles from the start
  order.forEach((w, l) => { for (const e of [w.a, w.b]) for (const p of vertical(e, HOUSING_H - 0.5).slice(1)) put(p, l); });

  for (const w of order) {
    const span = flatSpan(w.a, w.b);
    const candidates: (() => Route)[] = [];
    if (isHole(w.from) && isHole(w.to) && straight(w.a, w.b) && span <= FLAT_MAX && span > 0.1 && !endsUnder(w)) candidates.push(() => flatRoute(w.a, w.b));
    // the natural height for its length first, then higher, then lower (under the wires that cross it)
    const base = Math.min(30, Math.max(6, 4 + span * 0.12));
    const lifts = [...Array.from({ length: 16 }, (_, i) => base + i * 3.5), ...Array.from({ length: Math.floor((base - 6) / 3.5) }, (_, i) => base - (i + 1) * 3.5)];
    for (const lift of lifts) for (const steep of [false, true]) for (const bulge of [0, 6, -6, 12, -12]) {
      candidates.push(() => archRoute(w.a, w.b, lift, bulge * Math.min(1, span / 30), steep));
    }
    let pick: Route | null = null, fewest = Infinity, fallback: Route | null = null;
    for (const make of candidates) {
      const r = make();
      if (hitsParts(w, r)) continue;
      const n = conflicts(w, r, fewest);
      if (n === 0) { pick = r; break; }
      if (n < fewest) { fewest = n; fallback = r; }
    }
    if (!pick) crowded.push(w);
    pick ??= fallback ?? candidates[candidates.length - 1]();
    for (const p of pick.points) put(p, order.indexOf(w));
    out.set(w.id, pick);
  }
  return { out, crowded };
}
routeWires.crowded = 0; // how many wires found no clear path (tests and tuning)
