import { expect, test } from 'vitest';
import { BB, connectedHoles, holeLocal, railHoles } from './breadboardGeometry';

test('breadboard size', () => {
  expect(BB).toEqual({ L: 82, W: 55, H: 8.5 });
});

test('holes sit on the 0.1 inch grid', () => {
  const [x, y, z] = holeLocal(8, 'a');
  expect(x).toBeCloseTo(-19.05, 6);
  expect(y).toBe(8.5);
  expect(z).toBe(-14);
  expect(holeLocal(9, 'd')[0] - holeLocal(8, 'd')[0]).toBeCloseTo(2.54, 6);
  expect(holeLocal(1, 'j')[2]).toBe(14);
});

test('power rails have four rows of 24 holes, in groups of five', () => {
  const rails = railHoles();
  expect(rails).toHaveLength(4 * 24);
  const xs = new Set(rails.map(([x]) => x.toFixed(2)));
  expect(xs.has(holeLocal(7, 'a')[0].toFixed(2))).toBe(false); // gap after each group of five
  expect(xs.has(holeLocal(6, 'a')[0].toFixed(2))).toBe(true);
});

test('a hole is connected to its whole 5-hole column on its side of the channel', () => {
  expect(connectedHoles(8, 'c')).toEqual(['a', 'b', 'c', 'd', 'e'].map((row) => ({ col: 8, row })));
  expect(connectedHoles(3, 'h')).toEqual(['f', 'g', 'h', 'i', 'j'].map((row) => ({ col: 3, row })));
});
