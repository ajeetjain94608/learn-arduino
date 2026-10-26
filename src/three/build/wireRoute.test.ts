// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { minDistance, routeWires, type WireEnds } from './wireRoute';
import { pinWorld } from './pinPoints';

// a small seeded random so failures repeat
function rng(seed: number) { return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31); }
const ROWS = 'abcdefghij';
const UNO = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', '5V', 'GND', '3V3'];

function wire(id: string, from: string, to: string): WireEnds {
  return { id, from, to, a: pinWorld(from), b: pinWorld(to) };
}

describe('routeWires', () => {
  // a busy build: 14 wires, one per UNO socket except the supply pins, to holes anywhere on the breadboard
  it('no two routed wires come within 2 mm of each other, away from shared ends', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = rng(seed), used = new Set<string>(), wires: WireEnds[] = [];
      while (wires.length < 14) {
        const from = `uno.${UNO[Math.floor(r() * UNO.length)]}`;
        if (used.has(from) && !/GND|5V/.test(from)) continue;
        used.add(from);
        const to = `bb.${1 + Math.floor(r() * 30)}${ROWS[Math.floor(r() * 10)]}`;
        if (used.has(to)) continue;
        used.add(to);
        wires.push(wire(`w${wires.length}`, from, to));
      }
      routeWires.crowded = 0;
      const routes = routeWires(wires, []);
      expect(routeWires.crowded, `seed ${seed}: every wire found a clear path`).toBe(0);
      for (let i = 0; i < wires.length; i++) for (let j = i + 1; j < wires.length; j++) {
        const d = minDistance(routes.get(wires[i].id)!.points, routes.get(wires[j].id)!.points, [wires[i].a, wires[i].b], [wires[j].a, wires[j].b]);
        expect(d, `seed ${seed}: ${wires[i].from}→${wires[i].to} vs ${wires[j].from}→${wires[j].to}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('a short straight breadboard jumper lies flat on the board', () => {
    const r = routeWires([wire('w1', 'bb.T-5', 'bb.5a')], []).get('w1')!;
    expect(r.kind).toBe('flat');
    expect(Math.max(...r.points.map((p) => p.y))).toBeLessThan(pinWorld('bb.5a').y + 3);
  });

  it('a flat jumper is not used where a part sits over the path', () => {
    const blocked = new THREE.Box3(new THREE.Vector3(-1000, 0, -1000), new THREE.Vector3(1000, 30, 1000)); // everything
    const holeBox = (ref: string) => new THREE.Box3().setFromCenterAndSize(pinWorld(ref), new THREE.Vector3(2, 20, 2));
    const r = routeWires([wire('w1', 'bb.5a', 'bb.5e')], [{ box: holeBox('bb.5c') }]).get('w1')!;
    expect(r.kind).toBe('arch');
    expect(blocked.containsPoint(r.points[0])).toBe(true);
  });

  it('routes do not pass through part bodies', () => {
    const body = new THREE.Box3().setFromCenterAndSize(pinWorld('bb.15c').add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(12, 20, 12));
    const r = routeWires([wire('w1', 'uno.D13', 'bb.25c')], [{ box: body }]).get('w1')!;
    const inside = r.points.filter((p) => body.containsPoint(p));
    expect(inside).toEqual([]);
  });

  it('the same wire list always routes the same way', () => {
    const ws = [wire('w1', 'uno.D13', 'bb.8a'), wire('w2', 'uno.GND', 'bb.14a')];
    const a = routeWires(ws, []).get('w1')!.points, b = routeWires(ws, []).get('w1')!.points;
    expect(a.map((p) => p.toArray())).toEqual(b.map((p) => p.toArray()));
  });
});

describe('wires pass behind parts, as the camera sees them', () => {
  // the camera looks along -VIEW_DIR; a wire point "hides" a part if the ray from it away from the camera reaches the part
  const away = new THREE.Vector3(-85, -200, -190).normalize();
  const hides = (p: THREE.Vector3, body: THREE.Box3) => {
    const hit = new THREE.Ray(p, away).intersectBox(body, new THREE.Vector3());
    return !!hit && hit.distanceTo(p) < 60;
  };
  it('a wire from the UNO to a hole behind a tall part does not cross in front of it', () => {
    const hole = pinWorld('bb.20a');                       // the back row
    const body = new THREE.Box3().setFromCenterAndSize(pinWorld('bb.15c').add(new THREE.Vector3(0, 8, 0)), new THREE.Vector3(10, 16, 10));
    const w = wire('w1', 'uno.D9', 'bb.20a');
    const r = routeWires([w], [{ box: body }]).get('w1')!;
    const own = (p: THREE.Vector3) => Math.hypot(p.x - hole.x, p.z - hole.z) < 4 || Math.hypot(p.x - w.a.x, p.z - w.a.z) < 4;
    expect(r.points.filter((p) => !own(p) && hides(p, body))).toEqual([]);
  });
  it('wires bow towards the back of the bench, not towards the viewer', () => {
    const r = routeWires([wire('w1', 'uno.D13', 'bb.25g')], []).get('w1')!;
    const a = pinWorld('uno.D13'), b = pinWorld('bb.25g');
    const apex = r.points.reduce((m, p) => (p.y > m.y ? p : m));
    const chordZ = a.z + (apex.x - a.x) / (b.x - a.x) * (b.z - a.z);
    expect(apex.z).toBeLessThanOrEqual(chordZ + 0.5); // never in front of the straight line between its ends
  });
});

describe('wires never hide parts (random builds)', () => {
  const away = new THREE.Vector3(-85, -200, -190).normalize();
  const hides = (p: THREE.Vector3, body: THREE.Box3) => {
    const hit = new THREE.Ray(p, away).intersectBox(body, new THREE.Vector3());
    return !!hit && hit.distanceTo(p) < 60;
  };
  it('with 6 parts and 6 wires on the breadboard, no wire point sits between the camera and a part', () => {
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const r = rng(seed);
      const bodies = Array.from({ length: 6 }, (_, i) => {
        const c = pinWorld(`bb.${3 + i * 4}${'abcdefghij'[Math.floor(r() * 10)]}`);
        return new THREE.Box3().setFromCenterAndSize(c.add(new THREE.Vector3(0, 6, 0)), new THREE.Vector3(8, 12, 8));
      });
      const wires: WireEnds[] = [];
      const used = new Set<string>();
      while (wires.length < 6) {
        const from = `uno.${UNO[Math.floor(r() * 15)]}`;
        const to = `bb.${1 + Math.floor(r() * 30)}${'abcdefghij'[Math.floor(r() * 10)]}`;
        if (used.has(from) || used.has(to)) continue;
        // keep the hole clear of the part bodies
        if (bodies.some((b) => b.distanceToPoint(pinWorld(to)) < 3)) continue;
        used.add(from); used.add(to);
        wires.push(wire(`w${wires.length}`, from, to));
      }
      const routes = routeWires(wires, bodies.map((box) => ({ box })));
      for (const w of wires) {
        const near = (p: THREE.Vector3) => Math.hypot(p.x - w.b.x, p.z - w.b.z) < 4 || Math.hypot(p.x - w.a.x, p.z - w.a.z) < 4;
        const bad = routes.get(w.id)!.points.filter((p) => !near(p) && bodies.some((b) => hides(p, b)));
        expect(bad.length, `seed ${seed}: ${w.from} → ${w.to} hides a part`).toBe(0);
      }
    }
  });
});
