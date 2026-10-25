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
