import { expect, test } from 'vitest';
import { layoutCallout, separateCards } from './layoutCallout';

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

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('overlapping label cards are pushed apart vertically', () => {
  const placed = separateCards([
    { cx: 200, cy: 300, w: 140, h: 48 },
    { cx: 230, cy: 310, w: 140, h: 48 },
    { cx: 210, cy: 305, w: 140, h: 48 },
  ], { top: 56, bottom: 500 });
  const rects = placed.map((p) => ({ x: p.cx - 70, y: p.cy - 24, w: 140, h: 48 }));
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j]), `${i}-${j}`).toBe(false);
  for (const p of placed) { expect(p.cy - 24).toBeGreaterThanOrEqual(56); expect(p.cy + 24).toBeLessThanOrEqual(500); }
});

test('cards that do not overlap stay where they are', () => {
  const input = [{ cx: 100, cy: 100, w: 80, h: 40 }, { cx: 300, cy: 100, w: 80, h: 40 }];
  expect(separateCards(input, { top: 0, bottom: 400 }).map((p) => p.cy)).toEqual([100, 100]);
});
