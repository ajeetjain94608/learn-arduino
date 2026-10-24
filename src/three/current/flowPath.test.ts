import { expect, test } from 'vitest';
import * as THREE from 'three';
import { boardToLocal } from '../boards/uno/layout';
import { holeLocal } from '../breadboard/breadboardGeometry';
import { BLINK, blinkWires } from '../scenes/blinkLayout';
import { buildLoop, electronPositions } from './flowPath';

const world = (local: [number, number, number], offset: [number, number, number]) => new THREE.Vector3(...local).add(new THREE.Vector3(...offset));

test('the signal wire runs from the pin 13 header to breadboard hole 8a', () => {
  const { signal } = blinkWires();
  const path = buildLoop(signal.path);
  expect(path.getPointAt(0).distanceTo(world(boardToLocal(28.956, 50.8, 8.5), BLINK.board))).toBeLessThan(1e-6);
  expect(path.getPointAt(1).distanceTo(world(holeLocal(8, 'a'), BLINK.breadboard))).toBeLessThan(1e-6);
});

test('the ground wire runs from breadboard hole 14a back to the GND header', () => {
  const { ground } = blinkWires();
  const path = buildLoop(ground.path);
  expect(path.getPointAt(0).distanceTo(world(holeLocal(14, 'a'), BLINK.breadboard))).toBeLessThan(1e-6);
  expect(path.getPointAt(1).distanceTo(world(boardToLocal(26.416, 50.8, 8.5), BLINK.board))).toBeLessThan(1e-6);
});

test('wire lengths are plausible for jumpers arching over the bench', () => {
  const { signal, ground } = blinkWires();
  for (const w of [signal, ground]) {
    const len = buildLoop(w.path).getLength();
    expect(len).toBeGreaterThan(80);
    expect(len).toBeLessThan(250);
  }
});

test('electrons are spaced evenly along a wire, starting at its start', () => {
  const path = buildLoop(blinkWires().signal.path);
  const out = new Float32Array(4 * 3);
  electronPositions(path, 4, 0, out);
  const pts = [0, 1, 2, 3].map((i) => new THREE.Vector3(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]));
  expect(pts[0].distanceTo(path.getPointAt(0))).toBeLessThan(1e-6);
  for (let i = 1; i < 4; i++) expect(pts[i].distanceTo(pts[i - 1])).toBeGreaterThan(5);
});

test('electrons move forward over time and wrap around', () => {
  const path = buildLoop(blinkWires().signal.path);
  const a = new Float32Array(3), b = new Float32Array(3);
  electronPositions(path, 1, 0.25, a);
  electronPositions(path, 1, 1.25, b);
  expect(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))).toBeLessThan(1e-6);
});
