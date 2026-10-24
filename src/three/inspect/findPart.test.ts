import { expect, test } from 'vitest';
import * as THREE from 'three';
import { findPart, makePart } from './findPart';

test('a mesh deep inside a part resolves to that part', () => {
  const board = new THREE.Group();
  const inner = makePart(board, 'ZU4', 'atmega328', new THREE.Vector3(10, 1.6, -3));
  const leg = new THREE.Mesh();
  const sub = new THREE.Group();
  sub.add(leg);
  inner.add(sub);
  const hit = findPart(leg);
  expect(hit?.partId).toBe('ZU4');
  expect(hit?.kind).toBe('atmega328');
  expect(hit?.pivot.position.toArray()).toEqual([10, 1.6, -3]);
});

test('things that are not parts (the PCB) resolve to nothing', () => {
  const board = new THREE.Group();
  const pcb = new THREE.Mesh();
  board.add(pcb);
  expect(findPart(pcb)).toBeNull();
});

test('a part keeps its children where they were in board coordinates', () => {
  const board = new THREE.Group();
  const inner = makePart(board, 'Y1', 'crystal', new THREE.Vector3(5, 0, 5));
  const m = new THREE.Mesh();
  m.position.set(7, 2, 1);
  inner.add(m);
  board.updateMatrixWorld(true);
  expect(m.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([7, 2, 1]);
});
