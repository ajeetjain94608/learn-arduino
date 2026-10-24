import { expect, test } from 'vitest';
import { layoutCallout } from './layoutCallout';

const base = { card: { w: 120, h: 40 }, viewport: { w: 1036, h: 647 }, top: 100, bottom: 84 };

test('places the card at the anchor plus its offset', () => {
  expect(layoutCallout({ ...base, anchor: { x: 500, y: 300 }, offset: [-80, -60] })).toEqual({ visible: true, cx: 420, cy: 240 });
});

test('keeps a card that would overflow the right edge on screen', () => {
  const r = layoutCallout({ ...base, anchor: { x: 1000, y: 300 }, offset: [100, 0] });
  expect(r.cx).toBe(1036 - 60 - 8);
});

test('keeps cards clear of the top bar and the bottom dock', () => {
  expect(layoutCallout({ ...base, anchor: { x: 500, y: 120 }, offset: [0, -100] }).cy).toBe(100 + 20 + 8);
  expect(layoutCallout({ ...base, anchor: { x: 500, y: 560 }, offset: [0, 100] }).cy).toBe(647 - 84 - 20 - 8);
});

test('hides callouts whose anchor is off screen or under the bars', () => {
  expect(layoutCallout({ ...base, anchor: { x: 500, y: 50 }, offset: [0, 0] }).visible).toBe(false);
  expect(layoutCallout({ ...base, anchor: { x: -5, y: 300 }, offset: [0, 0] }).visible).toBe(false);
  expect(layoutCallout({ ...base, anchor: { x: 500, y: 600 }, offset: [0, 0] }).visible).toBe(false);
});

test('shrinks offsets on small screens', () => {
  const r = layoutCallout({ ...base, viewport: { w: 390, h: 844 }, anchor: { x: 200, y: 400 }, offset: [-62, 62] });
  expect(r.cx).toBeCloseTo(200 - 62 * (390 / 620), 6);
  expect(r.cy).toBeCloseTo(400 + 62 * (390 / 620), 6);
});
