import { expect, test } from 'vitest';
import { clampZoom, fitOrtho, orbitAround, VIEWS, VIEW_DIR } from './cameraViews';

test('landscape screens are fitted by height', () => {
  expect(fitOrtho(16 / 9)).toEqual({ halfH: 64, halfW: 64 * (16 / 9) });
});

test('portrait screens are fitted by width so the whole circuit stays visible', () => {
  const { halfH, halfW } = fitOrtho(390 / 844);
  expect(halfH).toBeCloseTo(205.59, 2);
  expect(halfW).toBeCloseTo(95, 5);
});

test('view presets match the approved spike framing', () => {
  expect(VIEW_DIR).toEqual([85, 200, 190]);
  expect(VIEWS.board).toEqual({ target: [-37, 3, 4], zoom: 1.55 });
  expect(VIEWS.circuit).toEqual({ target: [4, 0, 5], zoom: 1.0 });
});

test('rotating about the target keeps the distance and height', () => {
  const p = orbitAround([10, 50, 0], [0, 0, 0], Math.PI / 2);
  expect(p[0]).toBeCloseTo(0, 6);
  expect(p[1]).toBe(50);
  expect(p[2]).toBeCloseTo(-10, 6);
});

test('zoom steps stay within the allowed range', () => {
  expect(clampZoom(1 * 1.25)).toBeCloseTo(1.25, 6);
  expect(clampZoom(6.5 * 1.25)).toBe(7);
  expect(clampZoom(0.75 / 1.25)).toBe(0.7);
});
