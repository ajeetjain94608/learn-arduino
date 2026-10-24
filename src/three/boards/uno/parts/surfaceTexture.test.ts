import { expect, test } from 'vitest';
import { recordingContext } from '../../../../test/recordingContext';
import { LAYOUT, PIN_TRACES } from '../layout';
import { drawSurface } from './surfaceTexture';

const texts = (calls: { name: string; args: unknown[] }[]) => calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));

test('draws every top copper trace and every bottom-layer pin route', () => {
  const { ctx, calls } = recordingContext();
  drawSurface(ctx, 10);
  const bottom = Object.values(PIN_TRACES).flatMap((p) => p.segs).filter((s) => s[5] === 16).length;
  expect(LAYOUT.copper.length).toBe(501);
  expect(calls.filter((c) => c.name === 'stroke').length).toBeGreaterThanOrEqual(501 + bottom);
});

test('labels PWM pins with ~ and carries our own board mark', () => {
  const { ctx, calls } = recordingContext();
  drawSurface(ctx, 10);
  const t = texts(calls);
  expect(t).toContain('~11');
  expect(t).toContain('~3');
  expect(t).toContain('13');
  expect(t).toContain('MAKER BOARD · R3');
  expect(t).toContain('DIGITAL (PWM~)');
});

test('never prints the Arduino trademark on the board', () => {
  const { ctx, calls } = recordingContext();
  drawSurface(ctx, 10);
  expect(texts(calls).some((s) => /arduino/i.test(s))).toBe(false);
});
