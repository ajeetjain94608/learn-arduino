import { describe, expect, it } from 'vitest';
import { evaluate, type PinDrive } from './evaluate';
import type { CircuitSpec, PartInstance, Wire } from './types';

const pins = (over: Record<number, Partial<PinDrive>> = {}): PinDrive[] =>
  Array.from({ length: 20 }, (_, n) => ({ mode: 'input', high: false, duty: null, ...over[n] }));
const w = (from: string, to: string, i = 0): Wire => ({ id: `w${i}${from}${to}`, from, to, color: '#000' });
const led: PartInstance = { id: 'led1', type: 'led', params: { color: 'red' }, at: { col: 10, row: 'a' } }; // A 10a, K 11a
const r220: PartInstance = { id: 'r1', type: 'resistor', params: { ohms: 220 }, at: { col: 11, row: 'b' } }; // 11b–15b
const blink: CircuitSpec = { parts: [led, r220], wires: [w('uno.D13', 'bb.10c'), w('bb.15c', 'uno.GND')] };
const HIGH13 = pins({ 13: { mode: 'output', high: true } });

describe('evaluating a circuit', () => {
  it('LED + 220 Ω on D13: lit at HIGH (≈0.63), dark at LOW', () => {
    expect(evaluate(blink, HIGH13, {}, new Set()).parts.led1.brightness).toBeCloseTo((5 - 1.9) / 260 / 0.02, 2);
    expect(evaluate(blink, pins({ 13: { mode: 'output', high: false } }), {}, new Set()).parts.led1.brightness).toBe(0);
  });

  it('LED with no resistor burns, the pin survives', () => {
    const spec: CircuitSpec = { parts: [led], wires: [w('uno.D13', 'bb.10c'), w('bb.11c', 'uno.GND')] };
    const r = evaluate(spec, HIGH13, {}, new Set());
    expect(r.newBurns).toEqual([{ id: 'led1', reason: 'led-overcurrent' }]);
    expect(r.parts.led1).toMatchObject({ burnt: true, brightness: 0 });
    expect(r.board.burntPins).toEqual([]);
  });

  it('D13 wired straight to GND burns the pin', () => {
    const r = evaluate({ parts: [], wires: [w('uno.D13', 'uno.GND')] }, HIGH13, {}, new Set());
    expect(r.newBurns).toEqual([{ id: 'uno.D13', reason: 'pin-overcurrent' }]);
    expect(r.board.burntPins).toEqual([13]);
  });

  it('5V wired to GND shorts the board', () => {
    const r = evaluate({ parts: [], wires: [w('uno.5V', 'uno.GND')] }, pins(), {}, new Set());
    expect(r.board.shorted).toBe(true);
    expect(r.newBurns).toEqual([{ id: 'uno', reason: 'short', supply: '5V' }]);
  });

  it('button with a 10k pull-down: pin 2 reads 5 V pressed, 0 V released', () => {
    const spec: CircuitSpec = {
      parts: [
        { id: 'b1', type: 'button', params: {}, at: { col: 20, row: 'e' } }, // columns 20 and 22
        { id: 'r10k', type: 'resistor', params: { ohms: 10000 }, at: { col: 22, row: 'c' } }, // 22c–26c
      ],
      wires: [w('uno.5V', 'bb.20a'), w('uno.D2', 'bb.22a'), w('bb.26a', 'uno.GND')],
    };
    expect(evaluate(spec, pins(), { b1: { pressed: 1 } }, new Set()).pinVolts[2]).toBeGreaterThan(4.9);
    expect(evaluate(spec, pins(), { b1: { pressed: 0 } }, new Set()).pinVolts[2]).toBeLessThan(0.01);
  });

  it('pot wiper on A0 reads position × 5 V', () => {
    const spec: CircuitSpec = {
      parts: [{ id: 'p1', type: 'pot', params: {}, at: { col: 5, row: 'a' } }], // 1 5a, W 7a, 2 9a
      wires: [w('uno.5V', 'bb.5c'), w('bb.7c', 'uno.A0'), w('bb.9c', 'uno.GND')],
    };
    for (const pos of [0, 0.3, 1]) expect(evaluate(spec, pins(), { p1: { position: pos } }, new Set()).pinVolts[14]).toBeCloseTo(pos * 5, 2);
  });

  it('PWM duty 0.25 dims the LED to a quarter', () => {
    const full = evaluate(blink, HIGH13, {}, new Set()).parts.led1.brightness!;
    const pwm = evaluate(blink, pins({ 13: { mode: 'output', high: true, duty: 0.25 } }), {}, new Set()).parts.led1.brightness!;
    expect(pwm).toBeCloseTo(full * 0.25, 3);
  });

  it('a burnt LED stays dark even with a resistor added', () => {
    const r = evaluate(blink, HIGH13, {}, new Set(['led1']));
    expect(r.parts.led1).toMatchObject({ burnt: true, brightness: 0 });
    expect(r.newBurns).toEqual([]);
  });
});

describe('B3: a short says which supply', () => {
  it('3.3 V wired to GND is a short of the 3.3 V supply', () => {
    const r = evaluate({ parts: [], wires: [{ id: 'w', from: 'uno.3V3', to: 'uno.GND', color: '#000' }] }, Array.from({ length: 20 }, () => ({ mode: 'input' as const, high: false, duty: null })), {}, new Set());
    expect(r.newBurns).toEqual([{ id: 'uno', reason: 'short', supply: '3V3' }]);
  });
});
