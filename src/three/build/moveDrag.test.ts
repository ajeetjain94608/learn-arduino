// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dragTarget, mayStartDrag } from './moveDrag';

describe('carrying a part across the bench', () => {
  it('the part keeps the spot you grabbed it by: it moves by how far the pointer moved', () => {
    // grabbed at (110, 40) while the part's centre is at (100, 50); the pointer goes 30 right and 20 back
    expect(dragTarget({ x: 100, z: 50 }, { x: 110, z: 40 }, { x: 140, z: 20 })).toEqual({ x: 130, z: 30 });
  });
  it('lands on whole millimetres', () => {
    expect(dragTarget({ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 10.4, z: -3.6 })).toEqual({ x: 10, z: -4 });
  });
  it('no move at all leaves it where it is', () => {
    expect(dragTarget({ x: 12, z: -7 }, { x: 55, z: 3 }, { x: 55, z: 3 })).toEqual({ x: 12, z: -7 });
  });
  it('a finger moves a part only once it is selected (before that it orbits and pinches the camera)', () => {
    expect(mayStartDrag('touch', false)).toBe(false);
    expect(mayStartDrag('touch', true)).toBe(true);
    expect(mayStartDrag('mouse', false)).toBe(true);
    expect(mayStartDrag('pen', false)).toBe(true);
  });
});

import { BENCH } from './pinPoints';
import { colX, ROW } from '../breadboard/breadboardGeometry';
import { holeAt, moveAnchor } from './moveDrag';

describe('which breadboard hole is under the pointer', () => {
  const world = (col: number, row: keyof typeof ROW) => ({ x: colX(col) + BENCH.breadboard[0], z: ROW[row] + BENCH.breadboard[2] });
  it('exactly on a hole, and a little off it, finds that hole', () => {
    for (const [col, row] of [[1, 'a'], [15, 'e'], [16, 'f'], [30, 'j'], [7, 'c']] as const) {
      const w = world(col, row);
      expect(holeAt(w.x, w.z)).toEqual({ col, row });
      expect(holeAt(w.x + 0.9, w.z - 0.8)).toEqual({ col, row });
    }
  });
  it('beyond the board it holds the nearest edge hole', () => {
    expect(holeAt(-500, -500)).toEqual({ col: 1, row: 'a' });
    expect(holeAt(500, 500)).toEqual({ col: 30, row: 'j' });
  });
  it('dragging moves the part by as many holes as the pointer moved, from where it was grabbed', () => {
    // grabbed at 10c while the part's first leg is at 8c; the pointer goes to 13d
    expect(moveAnchor({ col: 8, row: 'c' }, { col: 10, row: 'c' }, { col: 13, row: 'd' })).toEqual({ col: 11, row: 'd' });
    expect(moveAnchor({ col: 8, row: 'c' }, { col: 10, row: 'c' }, { col: 10, row: 'c' })).toEqual({ col: 8, row: 'c' });
  });
  it('and never off the board', () => {
    expect(moveAnchor({ col: 2, row: 'a' }, { col: 5, row: 'a' }, { col: 1, row: 'a' })).toEqual({ col: 1, row: 'a' }); // stops at the edge
    expect(moveAnchor({ col: 29, row: 'j' }, { col: 5, row: 'e' }, { col: 30, row: 'j' })).toEqual({ col: 30, row: 'j' });
  });
});
