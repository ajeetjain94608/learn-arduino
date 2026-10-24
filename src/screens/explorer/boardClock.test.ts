import { expect, test } from 'vitest';
import { BOOT_S, bootLed, blinkPin } from './boardClock';

test('after a reset the board spends a short time booting before the program starts', () => {
  expect(BOOT_S).toBeCloseTo(0.8, 5);
});

test('while booting, the L LED flashes three times quickly (like the Uno bootloader)', () => {
  const samples = Array.from({ length: 80 }, (_, i) => bootLed(i / 100));
  const flashes = samples.filter((on, i) => on && !samples[i - 1]).length;
  expect(flashes).toBe(3);
  expect(bootLed(0.05)).toBe(false);
  expect(bootLed(0.15)).toBe(true);
});

test('the blink program starts HIGH and toggles every second', () => {
  expect(blinkPin(0)).toBe(true);
  expect(blinkPin(0.99)).toBe(true);
  expect(blinkPin(1.01)).toBe(false);
  expect(blinkPin(2.5)).toBe(true);
});
