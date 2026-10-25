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
