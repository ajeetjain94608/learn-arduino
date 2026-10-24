import { expect, test } from 'vitest';
import * as THREE from 'three';
import { HOUSING_H, jumperCurves } from './jumperCurves';

const a = new THREE.Vector3(-42.8, 10.1, -24.1);
const b = new THREE.Vector3(30.95, 8.5, -6);

test('the electrical path starts in the first hole and ends in the second', () => {
  const { path } = jumperCurves(a, b, 22);
  expect(path[0].getPoint(0).distanceTo(a)).toBeLessThan(1e-9);
  expect(path[path.length - 1].getPoint(1).distanceTo(b)).toBeLessThan(1e-9);
});

test('the wire leaves each housing and arches to the requested height', () => {
  const { wire } = jumperCurves(a, b, 22);
  const top = Math.max(...wire.getSpacedPoints(400).map((p) => p.y));
  expect(HOUSING_H).toBe(14);
  expect(top).toBeGreaterThanOrEqual(Math.max(a.y, b.y) + 14 + 22 - 0.01);
  expect(top).toBeLessThan(Math.max(a.y, b.y) + 14 + 22 + 0.5);
  expect(wire.getPoint(0).y).toBeCloseTo(a.y + HOUSING_H - 0.5, 6);
});
