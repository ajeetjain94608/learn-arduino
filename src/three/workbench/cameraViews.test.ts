import { expect, test } from 'vitest';
import { fitOrtho, VIEWS, VIEW_DIR } from './cameraViews';

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
