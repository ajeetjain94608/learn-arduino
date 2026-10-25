import { expect, test } from 'vitest';
import { printsUpTo, printText, runStep, SETUP_S, UPLOAD_S, uploadLeds } from './programTimeline';
import { BLINK_SKETCH } from './CodeCard';

const lineOf = (needle: string) => BLINK_SKETCH.split('\n').findIndex((l) => l.includes(needle)) + 1;

test('the sketch prints to the serial monitor', () => {
  expect(BLINK_SKETCH).toContain('Serial.begin(9600);');
  expect(BLINK_SKETCH).toContain('Serial.println("LED on");');
});

test('uploading takes a couple of seconds with RX and TX flickering', () => {
  expect(UPLOAD_S).toBeCloseTo(2, 5);
  const samples = Array.from({ length: 40 }, (_, i) => uploadLeds(i * 0.05));
  expect(new Set(samples.map((s) => s.rx)).size).toBe(2);
  expect(new Set(samples.map((s) => s.tx)).size).toBe(2);
});

test('setup runs first, one line at a time', () => {
  expect(runStep(0.05).line).toBe(lineOf('pinMode(13, OUTPUT)'));
  expect(runStep(SETUP_S - 0.05).line).toBe(lineOf('Serial.begin'));
  expect(runStep(0.1).pinHigh).toBe(false);
});

test('then loop: HIGH, print, wait one second; LOW, print, wait one second', () => {
  const u = (s: number) => runStep(SETUP_S + s);
  expect(u(0.05)).toEqual({ line: lineOf('digitalWrite(13, HIGH)'), pinHigh: true });
  expect(u(0.18).line).toBe(lineOf('Serial.println("LED on")'));
  expect(u(0.6)).toEqual({ line: lineOf('delay(1000);'), pinHigh: true });
  expect(u(1.05)).toEqual({ line: lineOf('digitalWrite(13, LOW)'), pinHigh: false });
  expect(u(1.6).pinHigh).toBe(false);
  expect(u(2.05).line).toBe(lineOf('digitalWrite(13, HIGH)'));
});

test('prints happen once per println, alternating on/off', () => {
  expect(printsUpTo(SETUP_S + 0.1)).toBe(0);
  expect(printsUpTo(SETUP_S + 0.2)).toBe(1);
  expect(printsUpTo(SETUP_S + 1.2)).toBe(2);
  expect([0, 1, 2].map(printText)).toEqual(['LED on', 'LED off', 'LED on']);
});
