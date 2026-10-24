import { expect, test } from 'vitest';
import { approach, LIFT } from './lift';

test('hover lifts a part a little and enlarges it slightly', () => {
  expect(LIFT.hover).toEqual({ y: 2.5, scale: 1.06 });
  expect(LIFT.selected).toEqual({ y: 2.5, scale: 1.06 });
  expect(LIFT.idle).toEqual({ y: 0, scale: 1 });
});

test('the lift eases smoothly to its target without overshooting', () => {
  let y = 0;
  const seen: number[] = [];
  for (let i = 0; i < 60; i++) { y = approach(y, 2.5, 1 / 60); seen.push(y); }
  for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  expect(Math.max(...seen)).toBeLessThanOrEqual(2.5);
  expect(2.5 - y).toBeLessThan(0.01);
});

test('a huge frame gap cannot jump past the target', () => {
  expect(approach(0, 2.5, 5)).toBe(2.5);
});
