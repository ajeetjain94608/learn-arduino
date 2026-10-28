import * as THREE from 'three';
import { HOUSING_H } from '../parts/jumperCurves';

// outA / outB: for an end on a part standing on the table (its legs are short and the body is right above them), the way the plug
// lies: flat on the table, pointing away from the part, so the jumper never stands up through the part
export type WireEnds = { id: string; from: string; to: string; a: THREE.Vector3; b: THREE.Vector3; outA?: THREE.Vector3 | null; outB?: THREE.Vector3 | null };
export type Obstacle = { box: THREE.Box3 };
// kind 'flat': a pre-cut jumper lying on the breadboard; 'arch': a Dupont jumper standing up out of its holes.
// `curve` is the wire's centre line (for the tube); `points` the whole wire, housings included, every ~1.5 mm.
export type Route = { kind: 'flat' | 'arch'; curve: THREE.Curve<THREE.Vector3>; points: THREE.Vector3[]; outs?: [THREE.Vector3 | null, THREE.Vector3 | null] };

const CLEAR = 2;          // mm between wires, and between a wire and a part
// The camera looks along -VIEW_DIR. A wire point "hides" a part if the ray from it away from the camera reaches the
// part within this distance: parts stay in front, wires pass behind them.
const AWAY = new THREE.Vector3(-85, -200, -190).normalize();
const HIDE_REACH = 60;
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
function archRoute(a: THREE.Vector3, b: THREE.Vector3, lift: number, bulge: number, steep = false, outA: THREE.Vector3 | null = null, outB: THREE.Vector3 | null = null): Route {
  const top = Math.max(a.y, b.y) + HOUSING_H + lift;
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
  dir.normalize();
  // positive `bulge` bows towards the back of the bench (away from the camera), negative towards the viewer
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  if (side.x + side.z > 0) side.negate();
  side.multiplyScalar(bulge);
  const at = (t: number, y: number, bow: number) => a.clone().lerp(b, t).setY(y).addScaledVector(side, bow);
  const rise = (p: THREE.Vector3) => (steep ? Math.max(p.y + HOUSING_H + 4, top - 5) : p.y + HOUSING_H + 4);
  const span = Math.hypot(b.x - a.x, b.z - a.z), edge = steep ? Math.min(0.15, 5 / Math.max(span, 1)) : 0.15;
  // an end's first stretch: straight up out of the plug, or — on a part standing on the table — along the table, away from the part, then up
  const sideways = (p: THREE.Vector3, out: THREE.Vector3) => [p.clone().addScaledVector(out, HOUSING_H - 0.5), p.clone().addScaledVector(out, HOUSING_H + 3).setY(p.y + 7)];
  const startA = outA ? sideways(a, outA) : [a.clone().setY(a.y + HOUSING_H - 0.5), a.clone().setY(rise(a))];
  const startB = outB ? sideways(b, outB) : [b.clone().setY(rise(b)), b.clone().setY(b.y + HOUSING_H - 0.5)];
  if (outB) startB.reverse();
  const curve = new THREE.CatmullRomCurve3([
    ...startA,
    at(edge, top - (steep ? 1 : 3), 0.6), at(0.5, top, 1), at(1 - edge, top - (steep ? 1 : 3), 0.6),
    ...startB,
  ], false, 'centripetal');
  const lie = (p: THREE.Vector3, out: THREE.Vector3) => Array.from({ length: 8 }, (_, i) => p.clone().addScaledVector(out, ((HOUSING_H - 0.5) * (i + 1)) / 8));
  const endA = outA ? lie(a, outA) : vertical(a, HOUSING_H - 0.5).slice(1), endB = outB ? lie(b, outB) : vertical(b, HOUSING_H - 0.5).slice(1);
  return { kind: 'arch', curve, points: [...endA, ...spaced(curve), ...endB], outs: [outA, outB] };
}

const isHole = (ref: string) => /^(bb|breadboard\d+)\./.test(ref);
const straight = (a: THREE.Vector3, b: THREE.Vector3) => Math.abs(a.x - b.x) < 0.1 || Math.abs(a.z - b.z) < 0.1;

// Lays out every wire so none touches another or passes through a part: shortest wires first, each taking the
// lowest arch (or flat path) that keeps CLEAR mm from everything already laid and does not hide a part from the camera.
// Same input, same layout. A wire that found no clear path goes first in the next round (up to 3 rounds); the round
// with fewest such wins. The whole layout may try at most MAX_TRIES candidate paths (a count, not a clock, so the same
// wires always route the same way): a wire that runs out takes the best path found so far, so a crowded build never
// freezes the page (and a wire never goes through a part: that rule is never given up).
const MAX_TRIES = 500;
export function routeWires(wires: WireEnds[], obstacles: Obstacle[]): Map<string, Route> {
  const budget = { left: MAX_TRIES };
  let order = [...wires].sort((x, y) => flatSpan(x.a, x.b) - flatSpan(y.a, y.b) || (x.id < y.id ? -1 : 1));
  let best: { out: Map<string, Route>; crowded: WireEnds[] } | null = null;
  for (let round = 0; round < 3; round++) {
    const r = routePass(order, wires, obstacles, budget);
    if (!best || r.crowded.length < best.crowded.length) best = r;
    if (!r.crowded.length || budget.left <= 0) break;
    order = [...r.crowded, ...order.filter((w) => !r.crowded.includes(w))];
  }
  routeWires.crowded += best!.crowded.length;
  return best!.out;
}

const BULGES = [0, 8, 18, 30, 44, -8]; // plan-view bow of the arch's apex: positive = towards the back of the bench
const LIFT_STEP = 5;

function routePass(order: WireEnds[], wires: WireEnds[], obstacles: Obstacle[], budget: { left: number }): { out: Map<string, Route>; crowded: WireEnds[] } {
  const out = new Map<string, Route>(), crowded: WireEnds[] = [];
  const ray = new THREE.Ray(), spot = new THREE.Vector3();
  const own = (w: WireEnds, p: THREE.Vector3) => Math.hypot(p.x - w.a.x, p.z - w.a.z) <= 4 || Math.hypot(p.x - w.b.x, p.z - w.b.z) <= 4; // next to its own plugs: allowed
  // HARD: a point inside a part (or touching it). SOFT: a point between the camera and a part, which would hide it.
  const hardHit = (w: WireEnds, r: Route) => r.points.some((p) => !own(w, p) && obstacles.some((o) => o.box.distanceToPoint(p) < (r.kind === 'flat' ? 0.3 : CLEAR)));
  const softHit = (w: WireEnds, r: Route) => r.kind === 'arch' && r.points.some((p) => {
    if (own(w, p)) return false;
    ray.set(p, AWAY);
    return obstacles.some((o) => ray.intersectBox(o.box, spot) !== null && spot.distanceTo(p) < HIDE_REACH);
  });
  // every laid wire's points in a grid of CLEAR-sized cells, so a candidate only checks its neighbourhood
  const grid = new Map<string, { p: THREE.Vector3; l: number }[]>(); // l: the wire's place in `order`
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const cell = (v: number) => Math.floor(v / CLEAR);
  // how many of the candidate's points come too close to a laid wire (0 = clear); `me`, `zones` belong to the wire being routed
  const conflicts = (r: Route, me: number, zones: THREE.Vector3[][], stopAt: number) => {
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

  order.forEach((w, me) => {
    const span = flatSpan(w.a, w.b);
    const zones = order.map((o) => sharedEnds([w.a, w.b], [o.a, o.b]));
    const candidates: (() => Route)[] = [];
    if (isHole(w.from) && isHole(w.to) && straight(w.a, w.b) && span <= FLAT_MAX && span > 0.1 && !endsUnder(w)) candidates.push(() => flatRoute(w.a, w.b));
    // the natural height for its length first, then higher, then lower (under the wires that cross it)
    const base = Math.min(30, Math.max(6, 4 + span * 0.12));
    const lifts = [...Array.from({ length: 8 }, (_, i) => base + i * LIFT_STEP), ...(base > 11 ? [base - LIFT_STEP] : [])];
    for (const bulge of BULGES) for (const lift of lifts) for (const steep of [false, true]) {
      candidates.push(() => archRoute(w.a, w.b, lift, bulge * Math.min(1, span / 30), steep, w.outA, w.outB));
    }
    let pick: Route | null = null, bestScore = Infinity, fallback: Route | null = null, lastSafe: Route | null = null;
    for (const make of candidates) {
      if (budget.left-- <= 0) break;
      const r = make();
      if (hardHit(w, r)) continue;          // never through a part
      lastSafe = r;
      const soft = softHit(w, r) ? 1 : 0;
      const n = conflicts(r, me, zones, soft ? bestScore : Math.min(bestScore, 1000));
      if (n === 0 && !soft) { pick = r; break; }
      const score = n + soft * 1000;
      if (score < bestScore) { bestScore = score; fallback = r; }
    }
    if (!pick) crowded.push(w);
    // no clear path: the least-bad one that avoids parts; if even that was not found (time ran out), a plain arch
    pick ??= fallback ?? lastSafe ?? archRoute(w.a, w.b, base, BULGES[1] * Math.min(1, span / 30), false, w.outA, w.outB);
    for (const p of pick.points) put(p, me);
    out.set(w.id, pick);
  });
  return { out, crowded };
}
routeWires.crowded = 0; // how many wires found no clear path (tests and tuning)
