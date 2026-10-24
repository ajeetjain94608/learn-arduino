import { expect, test } from 'vitest';
import * as THREE from 'three';
import { buildPcbShape } from './pcb';

test('the PCB shape has the four mounting holes', () => {
  expect(buildPcbShape().holes).toHaveLength(4);
});

test('the PCB shape spans the full board', () => {
  const box = new THREE.Box2().setFromPoints(buildPcbShape().getPoints(24));
  expect(box.min.x).toBeCloseTo(0, 3);
  expect(box.min.y).toBeCloseTo(0, 3);
  expect(box.max.x).toBeCloseTo(68.58, 3);
  expect(box.max.y).toBeCloseTo(53.34, 3);
});
