import { expect, test } from 'vitest';
import { statusText } from './Dock';

test('status says the board is resetting while it boots', () => {
  expect(statusText({ running: true, pinHigh: false, showCurrent: false, booting: true })).toBe('Resetting…');
  expect(statusText({ running: false, pinHigh: false, showCurrent: false, booting: true })).toBe('Resetting…');
  expect(statusText({ running: true, pinHigh: true, showCurrent: false, booting: false })).toBe('Pin 13 HIGH · LED on');
});

test('status says uploading while the sketch uploads', () => {
  expect(statusText({ running: true, pinHigh: false, showCurrent: false, booting: false, uploading: true })).toBe('Uploading…');
});

test('while the sketch compiles the status says so', () => {
  expect(statusText({ running: false, pinHigh: false, showCurrent: false, booting: false, compiling: true })).toBe('Compiling…');
});

test('says only "running" when the circuit is not about pin 13', () => {
  expect(statusText({ running: true, pinHigh: true, showCurrent: false, booting: false }, false)).toBe('Program running');
  expect(statusText({ running: false, pinHigh: false, showCurrent: false, booting: false }, false)).toBe('Program stopped');
});
