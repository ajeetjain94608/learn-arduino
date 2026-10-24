import { expect, test } from 'vitest';
import { boardToLocal, element, headerPin, outlineLoop, padsOf, PIN_TRACES, smdOf, UNO } from './layout';

test('board dimensions', () => {
  expect(UNO).toEqual({ L: 68.58, W: 53.34, T: 1.6 });
});

test('header pins sit on the real pads', () => {
  expect(headerPin('13')).toEqual({ x: 28.956, y: 50.8 });
  expect(headerPin('GND')).toEqual({ x: 26.416, y: 50.8 });
  expect(headerPin('SCL')).toEqual({ x: 18.796, y: 50.8 });
  expect(headerPin('0')).toEqual({ x: 63.5, y: 50.8 });
  expect(headerPin('5V')).toEqual({ x: 38.1, y: 2.54 });
  expect(headerPin('VIN')).toEqual({ x: 45.72, y: 2.54 });
  expect(headerPin('A0')).toEqual({ x: 50.8, y: 2.54 });
  expect(headerPin('A5')).toEqual({ x: 63.5, y: 2.54 });
});

test('elements come from the design file', () => {
  expect(element('Y1')).toMatchObject({ x: 18.923, y: 26.162, rot: 180, pkg: 'QS' });
  expect(element('U3').pkg).toBe('MLF32');
  expect(() => element('NOPE')).toThrow();
});

test('pads and smd pads are grouped by element', () => {
  expect(padsOf('IOH')).toHaveLength(10);
  expect(padsOf('ZU4')).toHaveLength(28);
  expect(smdOf('U5')).toHaveLength(8);
  expect(smdOf('C1')[0]).toEqual(expect.objectContaining({ x: expect.any(Number), dx: expect.any(Number), rot: expect.any(Number) }));
});

test('outline chains into one closed loop with the stepped right edge', () => {
  const loop = outlineLoop();
  expect(loop).toHaveLength(12);
  const has = (x: number, y: number) => loop.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
  expect(has(68.58, 37.846)).toBe(true);
  expect(has(64.516, 53.34)).toBe(true);
  expect(loop.filter((p) => p.arc)).toHaveLength(3);
  // the corner arc at the bottom-left bulges toward the true corner (0, 0)
  const bl = loop.find((p) => p.arc && Math.abs(p.x - 0) < 1e-6 && Math.abs(p.y - 1) < 1e-6) ?? loop.find((p) => p.arc && Math.abs(p.x - 1) < 1e-6 && Math.abs(p.y) < 1e-6);
  expect(bl?.arc).toEqual({ cx: 0, cy: 0 });
});

test('board coordinates map to scene millimetres', () => {
  expect(boardToLocal(0, 0)).toEqual([-34.29, 1.6, 26.67]);
  expect(boardToLocal(68.58, 53.34, 2)).toEqual([34.29, 3.6, -26.67]);
});

test('every digital pin has its full route, including bottom-layer copper', () => {
  expect(PIN_TRACES['13'].signal).toBe('SCK');
  expect(PIN_TRACES['13'].segs.some((s) => s[5] === 16)).toBe(true);
  for (let i = 0; i <= 13; i++) expect(PIN_TRACES[String(i)]?.segs.length).toBeGreaterThan(0);
});
