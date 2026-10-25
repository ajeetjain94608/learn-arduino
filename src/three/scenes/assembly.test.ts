import { describe, expect, it } from 'vitest';
import { ASSEMBLY, ASSEMBLY_DONE, dropOffset, slotProgress } from './assembly';

describe('circuit assembly schedule', () => {
  it('builds in order: breadboard, LED, resistor, signal wire, ground wire', () => {
    const order = (['breadboard', 'led', 'resistor', 'signal', 'ground'] as const).map((k) => ASSEMBLY[k][0]);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const [start, dur] of Object.values(ASSEMBLY)) expect(start + dur).toBeLessThanOrEqual(ASSEMBLY_DONE);
  });

  it('progress runs 0 → 1 across a slot and clamps outside it', () => {
    expect(slotProgress(-1, [0.5, 1])).toBe(0);
    expect(slotProgress(0.5, [0.5, 1])).toBe(0);
    expect(slotProgress(1, [0.5, 1])).toBeCloseTo(0.5);
    expect(slotProgress(9, [0.5, 1])).toBe(1);
  });

  it('a dropping part starts high, lands exactly, and never sinks far below its spot', () => {
    expect(dropOffset(0)).toBe(1);
    expect(dropOffset(1)).toBe(0);
    for (let p = 0; p <= 1; p += 0.01) expect(dropOffset(p)).toBeGreaterThan(-0.12); // small settle, not a dive
  });
});
