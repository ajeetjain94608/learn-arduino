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
