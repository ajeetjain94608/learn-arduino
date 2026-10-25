import { expect, test } from 'vitest';
import { UPLOAD_S, uploadLeds } from './programTimeline';
import { BLINK_SKETCH } from './CodeCard';


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
