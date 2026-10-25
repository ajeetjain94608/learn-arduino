import { expect, test } from 'vitest';
import { placeTooltip } from './tooltipPlacement';

const viewport = { w: 366, h: 490 }, card = { w: 260, h: 64 };

test('a tapped part shows its card centred along the bottom of the 3D view, above the toolbar', () => {
  const p = placeTooltip({ mode: 'selected', at: { x: 340, y: 100 }, card, viewport, reserveBottom: 66 });
  expect(p.x).toBe((366 - 260) / 2);
  expect(p.y).toBe(490 - 66 - 10 - 64);
});

test('a hover card follows the pointer but never leaves the 3D view', () => {
  const nearRight = placeTooltip({ mode: 'hover', at: { x: 350, y: 470 }, card, viewport, reserveBottom: 66 });
  expect(nearRight.x + card.w).toBeLessThanOrEqual(366 - 10);
  expect(nearRight.y + card.h).toBeLessThanOrEqual(490 - 66 - 10);
  const middle = placeTooltip({ mode: 'hover', at: { x: 50, y: 100 }, card, viewport, reserveBottom: 66 });
  expect(middle).toEqual({ x: 64, y: 114 });
});

test('a card wider than the view is pinned to the left margin', () => {
  expect(placeTooltip({ mode: 'selected', at: null, card: { w: 400, h: 64 }, viewport, reserveBottom: 66 }).x).toBe(10);
});
