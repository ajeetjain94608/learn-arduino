import { describe, expect, it } from 'vitest';
import { BB_HOLES, bbInternalNets, UNO_PINS } from './board';
import { buildNets } from './nets';
import type { CircuitSpec, PartInstance } from './types';

const empty: CircuitSpec = { parts: [], wires: [] };
const noLegs = () => ({});

describe('nets', () => {
  it('holes in one five-hole strip share a net, the two sides of the gap don\'t', () => {
    const n = buildNets(empty, noLegs);
    expect(n.netOf('bb.12a')).toBe(n.netOf('bb.12e'));
    expect(n.netOf('bb.12f')).toBe(n.netOf('bb.12j'));
    expect(n.netOf('bb.12a')).not.toBe(n.netOf('bb.12f'));
    expect(n.netOf('bb.12a')).not.toBe(n.netOf('bb.13a'));
  });

  it('a wire joins its two ends', () => {
    const n = buildNets({ parts: [], wires: [{ id: 'w1', from: 'uno.D13', to: 'bb.10c', color: '#F28C16' }] }, noLegs);
    expect(n.netOf('uno.D13')).toBe(n.netOf('bb.10a'));
  });

  it('a rail runs the board\'s length (T+2 and T+29 share a net)', () => {
    const n = buildNets(empty, noLegs);
    expect(n.netOf('bb.T+2')).toBe(n.netOf('bb.T+29'));
    expect(n.netOf('bb.T+2')).not.toBe(n.netOf('bb.T-2'));
    expect(n.netOf('bb.B-3')).toBe(n.netOf('bb.B-28'));
  });

  it('a part leg joins its hole', () => {
    const led: PartInstance = { id: 'led1', type: 'led', params: {}, at: { col: 10, row: 'a' } };
    const n = buildNets({ parts: [led], wires: [] }, () => ({ A: 'bb.10a', K: 'bb.11a' }));
    expect(n.netOf('led1.A')).toBe(n.netOf('bb.10c'));
    expect(n.netOf('led1.K')).toBe(n.netOf('bb.11e'));
    expect(n.netOf('led1.A')).not.toBe(n.netOf('led1.K'));
  });

  it('unconnected UNO pins are each alone', () => {
    const n = buildNets(empty, noLegs);
    const nets = new Set(UNO_PINS.map((p) => n.netOf(`uno.${p}`)));
    expect(nets.size).toBe(UNO_PINS.length - 2); // …except the board's three GND sockets, which are one wire
    expect(n.netOf('uno.GND_P1')).toBe(n.netOf('uno.GND'));
    expect(n.netOf('uno.GND_P2')).toBe(n.netOf('uno.GND'));
    expect(UNO_PINS).toEqual(expect.arrayContaining(['D0', 'D13', 'A0', 'A5', '5V', '3V3', 'VIN', 'GND', 'AREF']));
  });

  it('the board has 300 strip holes and 4 rails of 24', () => {
    expect(BB_HOLES.filter((h) => /^\d+[a-j]$/.test(h))).toHaveLength(300);
    expect(BB_HOLES.filter((h) => /^[TB][+-]\d+$/.test(h))).toHaveLength(96);
    expect(bbInternalNets().filter((n) => n.length === 24)).toHaveLength(4);
  });
});

describe('more than one breadboard', () => {
  const boards = (...ids: string[]): CircuitSpec => ({ parts: ids.map((id, i) => ({ id, type: 'breadboard' as const, params: {}, at: { x: i * 100, z: 0 } })), wires: [] });
  it('each board has its own strips and rails, and no hole of one is joined to a hole of another', () => {
    const n = buildNets(boards('bb', 'breadboard2'), noLegs);
    expect(n.netOf('breadboard2.5a')).toBe(n.netOf('breadboard2.5e'));
    expect(n.netOf('breadboard2.T+3')).toBe(n.netOf('breadboard2.T+27'));
    expect(n.netOf('breadboard2.5a')).not.toBe(n.netOf('bb.5a'));
    expect(n.netOf('breadboard2.T+3')).not.toBe(n.netOf('bb.T+3'));
  });
  it('a wire joins a hole of one board to a hole of the other', () => {
    const spec = { ...boards('bb', 'breadboard2'), wires: [{ id: 'w', from: 'bb.5a', to: 'breadboard2.9f', color: '#000' }] };
    const n = buildNets(spec, noLegs);
    expect(n.netOf('bb.5c')).toBe(n.netOf('breadboard2.9h'));
  });
});
