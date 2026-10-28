import { describe, expect, it } from 'vitest';
import { checkWiring } from './check';
import type { CircuitSpec, Wire } from './types';

const w = (from: string, to: string): Wire => ({ id: `${from}-${to}`, from, to, color: '#000' });

describe('every supply and GND socket', () => {
  it('a supply wired to the power header GND is a short', () => {
    expect(checkWiring({ parts: [], wires: [w('uno.5V', 'uno.GND_P1')] })).toContainEqual({ kind: 'short', supply: '5V' });
    expect(checkWiring({ parts: [], wires: [w('uno.VIN', 'uno.GND_P2')] })).toContainEqual({ kind: 'short', supply: 'VIN' });
  });
  it('two supplies wired together clash', () => {
    expect(checkWiring({ parts: [], wires: [w('uno.5V', 'uno.3V3')] })).toContainEqual({ kind: 'clash', a: '5V', b: '3V3' });
  });
});
const spec = (wires: Wire[], parts: CircuitSpec['parts'] = []): CircuitSpec => ({ parts, wires });

describe('checking the wiring before Run', () => {
  it('5V to GND is a short', () => {
    expect(checkWiring(spec([w('uno.5V', 'bb.T+3'), w('bb.T+20', 'uno.GND')]))).toEqual([{ kind: 'short', supply: '5V' }]);
    expect(checkWiring(spec([w('uno.3V3', 'uno.GND')]))).toEqual([{ kind: 'short', supply: '3V3' }]);
  });

  it('D13 straight to GND warns', () => {
    expect(checkWiring(spec([w('uno.D13', 'bb.4c'), w('bb.4a', 'uno.GND')]))).toEqual([{ kind: 'pin', pin: 'D13', to: 'GND' }]);
    expect(checkWiring(spec([w('uno.A0', 'uno.5V')]))).toEqual([{ kind: 'pin', pin: 'A0', to: '5V' }]);
  });

  it('D13 → 220 Ω → GND is fine', () => {
    const r = { id: 'r1', type: 'resistor' as const, params: { ohms: 220 }, at: { col: 4, row: 'b' as const } }; // 4b–8b
    expect(checkWiring(spec([w('uno.D13', 'bb.4a'), w('bb.8a', 'uno.GND')], [r]))).toEqual([]);
  });
});
