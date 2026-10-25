import { describe, expect, it } from 'vitest';
import { solve, type Element } from './solver';

// node 0 = ground in every test
describe('DC solver', () => {
  it('a 10k/10k divider from 5 V gives 2.5 V', () => {
    const els: Element[] = [{ kind: 'V', node: 1, volts: 5, ohms: 0.01 }, { kind: 'R', a: 1, b: 2, ohms: 10_000 }, { kind: 'R', a: 2, b: 0, ohms: 10_000 }];
    expect(solve(els, 3, 0).volts[2]).toBeCloseTo(2.5, 3);
  });

  it('red LED + 220 Ω from a 5 V pin (25 Ω) draws ≈ 12.7 mA (±0.3)', () => {
    const els: Element[] = [{ kind: 'V', node: 1, volts: 5, ohms: 25 }, { kind: 'D', a: 1, k: 2, vf: 1.9, ron: 15 }, { kind: 'R', a: 2, b: 0, ohms: 220 }];
    const r = solve(els, 3, 0);
    expect(Math.abs(r.current[1] - (5 - 1.9) / (25 + 220 + 15))).toBeLessThan(0.0003);
    expect(r.current[0]).toBeCloseTo(r.current[1], 6); // the pin supplies what the LED draws
  });

  it('a reversed LED stays off (≈ 0 A)', () => {
    const els: Element[] = [{ kind: 'V', node: 1, volts: 5, ohms: 25 }, { kind: 'D', a: 2, k: 1, vf: 1.9, ron: 15 }, { kind: 'R', a: 2, b: 0, ohms: 220 }];
    expect(Math.abs(solve(els, 3, 0).current[1])).toBeLessThan(1e-6);
  });

  it('blue LED (3.0 V) from 3.3 V through 220 Ω draws ≈ 1.2 mA', () => {
    const els: Element[] = [{ kind: 'V', node: 1, volts: 3.3, ohms: 1 }, { kind: 'R', a: 1, b: 2, ohms: 220 }, { kind: 'D', a: 2, k: 0, vf: 3.0, ron: 15 }];
    expect(solve(els, 3, 0).current[2]).toBeCloseTo(0.3 / 236, 4);
  });

  it('5 V straight into ground draws far over 1 A', () => {
    const els: Element[] = [{ kind: 'V', node: 1, volts: 5, ohms: 0.01 }, { kind: 'R', a: 1, b: 0, ohms: 0.001 }];
    expect(solve(els, 2, 0).current[0]).toBeGreaterThan(100);
  });

  it('a floating node reads 0 V', () => {
    const els: Element[] = [{ kind: 'V', node: 1, volts: 5, ohms: 25 }];
    expect(solve(els, 3, 0).volts[2]).toBeCloseTo(0, 6);
  });

  it('pull-up through 35 kΩ: open button reads 5 V, pressed to ground reads ≈ 0 V', () => {
    const pullup: Element = { kind: 'V', node: 1, volts: 5, ohms: 35_000 };
    expect(solve([pullup], 2, 0).volts[1]).toBeCloseTo(5, 2);
    expect(solve([pullup, { kind: 'R', a: 1, b: 0, ohms: 0.1 }], 2, 0).volts[1]).toBeLessThan(0.001);
  });
});
