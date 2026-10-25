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

describe('DC solver: NPN Darlington switch (TIP120)', () => {
  const tip120 = (b: number, c: number, e: number): Element => ({ kind: 'Q', b, c, e, vbe: 1.4, rbe: 50, ron: 2, ibOn: 1e-4 });
  // node 1: pin, 2: base, 3: 5 V rail, 4: collector (motor −); ground 0 is the emitter
  const circuit = (pinVolts: number): Element[] => [
    { kind: 'V', node: 1, volts: pinVolts, ohms: 25 }, { kind: 'R', a: 1, b: 2, ohms: 1000 },
    { kind: 'V', node: 3, volts: 5, ohms: 0.05 }, { kind: 'R', a: 3, b: 4, ohms: 10 }, // the motor
    tip120(2, 4, 0),
  ];
  it('a 5 V pin through 1 kΩ to the base switches a 10 Ω motor on (≈ 0.4 A)', () => {
    const r = solve(circuit(5), 5, 0);
    expect(r.current[4]).toBeGreaterThan(0.38);
    expect(r.current[4]).toBeLessThan(0.42);
    expect(r.current[3]).toBeCloseTo(r.current[4], 3);         // the motor's current goes through the transistor
    expect(r.current[0]).toBeCloseTo((5 - 1.4) / (25 + 1000 + 50), 4); // the pin only feeds the base
  });
  it('with the pin LOW the transistor is off', () => {
    expect(Math.abs(solve(circuit(0), 5, 0).current[4])).toBeLessThan(1e-6);
  });
});
