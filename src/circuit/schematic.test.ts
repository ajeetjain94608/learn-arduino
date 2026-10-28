import { describe, expect, it } from 'vitest';
import { jumperPoint, schematicNets } from './schematic';
import type { CircuitSpec, PartInstance } from './types';

const led: PartInstance = { id: 'led1', type: 'led', params: { color: 'red' }, at: { col: 10, row: 'a' } };               // A 10a, K 11a
const res: PartInstance = { id: 'resistor1', type: 'resistor', params: { ohms: 220 }, at: { col: 11, row: 'b' } };       // 1 11b … 2 15b
const board: PartInstance = { id: 'bb', type: 'breadboard', params: {}, at: { x: 50, z: 8 } };
const w = (from: string, to: string) => ({ id: `${from}-${to}`, from, to, color: '#2563EB' });
const spec: CircuitSpec = { parts: [board, led, res], wires: [w('uno.D13', 'bb.10c'), w('bb.15c', 'uno.GND_P1')] };
const refs = ['uno.D13', 'uno.GND', 'led1.A', 'led1.K', 'resistor1.1', 'resistor1.2'];

describe('the schematic\'s nets', () => {
  const n = schematicNets(spec, refs);
  it('pins joined by wires and breadboard strips share a net, named after the UNO pin', () => {
    expect(n.netOf('led1.A')).toBe(n.netOf('uno.D13'));
    expect(n.nameOf('led1.A')).toBe('D13');
    expect(n.nameOf('resistor1.2')).toBe('GND');                   // through the other GND socket too
    expect(n.colorOf('led1.A')).toBe('#2563EB');
  });
  it('a net between parts only is called N1, N2…, and a pin alone has no name', () => {
    expect(n.nameOf('led1.K')).toBe('N1');
    expect(n.nameOf('resistor1.1')).toBe('N1');
    const alone = schematicNets({ parts: [board, led], wires: [] }, ['led1.A', 'led1.K']);
    expect(alone.nameOf('led1.A')).toBeNull();
  });
});

describe('where a jumper goes to join a pin', () => {
  it('a leg in a breadboard takes it in a free hole of its strip; a pin on the table takes it directly', () => {
    expect(jumperPoint(led, 'A', new Set(['bb.10a']))).toBe('bb.10b');
    expect(jumperPoint(led, 'A', new Set(['bb.10a', 'bb.10b', 'bb.10c', 'bb.10d', 'bb.10e']))).toBeNull();
    const loose: PartInstance = { ...led, id: 'led2', at: { x: 0, z: 100 } };
    expect(jumperPoint(loose, 'K', new Set())).toBe('led2.K');
    expect(jumperPoint(loose, 'K', new Set(['led2.K']))).toBeNull();
  });
});
