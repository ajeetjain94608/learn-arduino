// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AvrRunner } from './AvrRunner';
import { parseIntelHex } from './hex';
import { runSim } from './testing';

const fixture = (name: string) => new AvrRunner(parseIntelHex(readFileSync(`src/sim/avr/fixtures/${name}.hex`, 'utf8')));

describe('PWM duty', { timeout: 60_000 }, () => {
  it('fade: pin 9 duty ≈ 0.25 (±0.01) and pin 6 ≈ 0.75', () => {
    const r = fixture('fade');
    runSim(r, 20);
    expect(r.pwmDuty(9)).toBeCloseTo(0.25, 1);
    expect(Math.abs(r.pwmDuty(9)! - 0.25)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(r.pwmDuty(6)! - 0.75)).toBeLessThanOrEqual(0.01);
  });

  it('a pin with no PWM reports null', () => {
    const r = fixture('fade');
    runSim(r, 20);
    expect(r.pwmDuty(13)).toBeNull();
    expect(r.pwmDuty(10)).toBeNull(); // a PWM-capable pin that analogWrite never touched
    const b = fixture('blink');
    runSim(b, 20);
    expect(b.pwmDuty(9)).toBeNull();
  });
});
