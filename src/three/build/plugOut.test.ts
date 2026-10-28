// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { routeWires } from './wireRoute';

describe('a jumper on the leg of a part standing on the table', () => {
  const a = new THREE.Vector3(-50, 12, 0), b = new THREE.Vector3(100, 2.4, 100);
  it('lies flat on the table pointing away from the part, and never stands up through it', () => {
    const out = new THREE.Vector3(1, 0, 0);
    const r = routeWires([{ id: 'w', from: 'uno.D13', to: 'led1.K', a, b, outB: out }], []).get('w')!;
    expect(r.outs?.[1]).toEqual(out);
    // the first stretch from the leg runs along the table (same height as the leg), away from the part
    const near = r.points.filter((p) => p.distanceTo(b) < 11);
    expect(near.length).toBeGreaterThan(4);
    for (const p of near) { expect(p.y).toBeLessThan(b.y + 8); expect(p.x).toBeGreaterThanOrEqual(b.x - 0.01); }
  });
  it('an ordinary end still stands straight up', () => {
    const r = routeWires([{ id: 'w', from: 'uno.D13', to: 'led1.K', a, b }], []).get('w')!;
    expect(r.outs?.[1]).toBeNull();
    expect(r.points.some((p) => Math.abs(p.x - b.x) < 0.01 && Math.abs(p.z - b.z) < 0.01 && p.y > b.y + 8)).toBe(true);
  });
});
