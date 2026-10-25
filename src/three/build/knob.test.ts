import { expect, it } from 'vitest';
import { pointerAngle, turnKnob } from './partModels';

it('the pointer angle is measured from the top, clockwise', () => {
  expect(pointerAngle(0, -10)).toBeCloseTo(0);
  expect(pointerAngle(10, 0)).toBeCloseTo(90);
  expect(pointerAngle(-10, 0)).toBeCloseTo(-90);
});

it('the knob turns by how far the pointer goes round it, wherever you grab it (270° = the full range)', () => {
  expect(turnKnob(0.5, 0, 90)).toBeCloseTo(0.5 + 90 / 270);  // a quarter turn clockwise
  expect(turnKnob(0.5, -90, -180)).toBeCloseTo(0.5 - 90 / 270);
  expect(turnKnob(0.9, 170, -170)).toBeCloseTo(0.9 + 20 / 270); // crossing the bottom is a small step, not a jump
  expect(turnKnob(0.95, 0, 90)).toBe(1);                        // it stops at the ends
  expect(turnKnob(0.05, 0, -90)).toBe(0);
});
