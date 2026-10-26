import { describe, expect, it } from 'vitest';
import { ASSEMBLY, ASSEMBLY_DONE, assemblyPlan } from './assembly';

describe('the build-up plan for any project', () => {
  it('for the Blink circuit (2 parts, 2 wires) it is the same shape as the original timeline', () => {
    const p = assemblyPlan(2, 2);
    expect(p.breadboard).toEqual(ASSEMBLY.breadboard);
    expect(p.parts[0][0]).toBeCloseTo(ASSEMBLY.led[0], 1);
    expect(p.parts[1][0]).toBeCloseTo(ASSEMBLY.resistor[0], 1);
    expect(p.wires[0][0]).toBeCloseTo(ASSEMBLY.signal[0], 1);
    expect(p.done).toBeCloseTo(ASSEMBLY_DONE, 0);
  });
  it('parts drop one after another, then each wire draws itself, and everything is done at the end', () => {
    const p = assemblyPlan(6, 12);
    for (let i = 1; i < p.parts.length; i++) expect(p.parts[i][0]).toBeGreaterThan(p.parts[i - 1][0]);
    expect(p.wires[0][0]).toBeGreaterThanOrEqual(p.parts[5][0]);
    for (let j = 1; j < p.wires.length; j++) expect(p.wires[j][0]).toBeGreaterThan(p.wires[j - 1][0]);
    const last = p.wires[11];
    expect(p.done).toBeGreaterThanOrEqual(last[0] + last[1]);
  });
  it('a big project does not take forever: a build is over within about four seconds', () => {
    expect(assemblyPlan(12, 30).done).toBeLessThan(4.2);
    expect(assemblyPlan(0, 0).done).toBeGreaterThan(0.5);
  });
});
