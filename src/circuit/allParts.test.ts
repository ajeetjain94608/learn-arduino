import { describe, expect, it } from 'vitest';
import { evaluate, unoLinks, type PinDrive } from './evaluate';
import { PART_DEFS, partPoints } from './parts';
import type { CircuitSpec, PartInstance, Wire } from './types';

// every UNO pin an input unless given: n → drive
const pins = (over: Record<number, Partial<PinDrive>> = {}): PinDrive[] =>
  Array.from({ length: 20 }, (_, n) => ({ mode: 'input' as const, high: false, duty: null, ...over[n] }));
const out = (high: boolean, duty: number | null = null): Partial<PinDrive> => ({ mode: 'output', high, duty });
let k = 0;
const w = (from: string, to: string): Wire => ({ id: `w${k++}`, from, to, color: '#000' });
const part = (id: string, type: PartInstance['type'], at: PartInstance['at'], params: PartInstance['params'] = {}): PartInstance => ({ id, type, params, at });
const run = (spec: CircuitSpec, drive = pins(), inputs = {}) => evaluate(spec, drive, inputs, new Set());
const A0 = 14;
const reading = (volts: number) => Math.round((volts / 5) * 1023);

describe('every part has pins, a place and its inputs', () => {
  it('breadboard parts have a footprint; bench modules have header pins instead', () => {
    for (const [type, def] of Object.entries(PART_DEFS)) {
      if (def.bench) expect(Object.keys(def.bench.pins).sort(), type).toEqual([...def.pins].sort());
      else expect(Object.keys(def.footprint({ col: 10, row: type === 'button' ? 'e' : 'b' }, {}) ?? {}).sort(), type).toEqual([...def.pins].sort());
    }
  });
  it("a bench module's pins are connection points; a breadboard part's legs are holes", () => {
    expect(partPoints(part('hc1', 'hcsr04', { x: 0, z: 60 }))).toEqual(['hc1.VCC', 'hc1.TRIG', 'hc1.ECHO', 'hc1.GND']);
    expect(partPoints(part('led1', 'led', { col: 3, row: 'a' }))).toEqual([]);
  });
});

describe('simple parts', () => {
  it('RGB LED (common cathode) without resistors burns', () => {
    const spec: CircuitSpec = { parts: [part('rgb1', 'rgb', { col: 10, row: 'a' })], // R 10a, K 11a, G 12a, B 13a
      wires: [w('uno.D9', 'bb.10c'), w('uno.D10', 'bb.12c'), w('uno.D11', 'bb.13c'), w('bb.11c', 'uno.GND')] };
    const r = run(spec, pins({ 9: out(true), 11: out(true) }));
    expect(r.newBurns.map((b) => b.id)).toEqual(['rgb1']);
    expect(r.parts.rgb1.burnt).toBe(true);
  });

  it('RGB LED with 220 Ω resistors: red full, green off, blue full', () => {
    const spec: CircuitSpec = {
      parts: [part('rgb1', 'rgb', { col: 10, row: 'a' }), part('ra', 'resistor', { col: 10, row: 'c' }, { ohms: 220 }),
        part('rb', 'resistor', { col: 12, row: 'd' }, { ohms: 220 }), part('rc', 'resistor', { col: 13, row: 'e' }, { ohms: 220 })],
      wires: [w('uno.D9', 'bb.14a'), w('uno.D10', 'bb.16a'), w('uno.D11', 'bb.17a'), w('bb.11b', 'uno.GND')],
    };
    const r = run(spec, pins({ 9: out(true), 10: out(false), 11: out(true) }));
    const rgb = r.parts.rgb1.rgb!;
    expect(rgb[0]).toBeGreaterThan(0.5);
    expect(rgb[1]).toBe(0);
    expect(rgb[2]).toBeGreaterThan(0.3);
    expect(r.newBurns).toEqual([]);
  });

  it('LDR + 10 kΩ divider: A0 reads about 512 at 10 lux, higher in brighter light', () => {
    const spec = (lux: number) => ({
      spec: { parts: [part('ldr1', 'ldr', { col: 5, row: 'a' }), part('r1', 'resistor', { col: 7, row: 'c' }, { ohms: 10000 })],
        wires: [w('uno.5V', 'bb.5c'), w('bb.7b', 'uno.A0'), w('bb.11d', 'uno.GND')] },
      inputs: { ldr1: { lux } },
    });
    const at = (lux: number) => { const s = spec(lux); return reading(run(s.spec, pins(), s.inputs).pinVolts[A0]); };
    expect(Math.abs(at(10) - 512)).toBeLessThanOrEqual(3);
    expect(at(300)).toBeGreaterThan(900);
    expect(at(1)).toBeLessThan(200);
  });

  it('TMP36: 0.5 V at 0 °C and 10 mV more each degree — and nothing without power', () => {
    const tmp = part('t1', 'tmp36', { col: 8, row: 'a' }); // VS 8a, OUT 9a, GND 10a
    const powered: CircuitSpec = { parts: [tmp], wires: [w('uno.5V', 'bb.8c'), w('bb.9c', 'uno.A0'), w('bb.10c', 'uno.GND')] };
    expect(run(powered, pins(), { t1: { celsius: 25 } }).pinVolts[A0]).toBeCloseTo(0.75, 2);
    expect(run(powered, pins(), { t1: { celsius: 0 } }).pinVolts[A0]).toBeCloseTo(0.5, 2);
    const unpowered: CircuitSpec = { parts: [tmp], wires: [w('bb.9c', 'uno.A0'), w('bb.10c', 'uno.GND')] };
    expect(run(unpowered, pins(), { t1: { celsius: 25 } }).pinVolts[A0]).toBeCloseTo(0, 2);
    expect(run(unpowered, pins(), { t1: { celsius: 25 } }).parts.t1.powered).toBe(false);
  });

  it('FSR + 10 kΩ pull-down: harder presses read higher', () => {
    const spec: CircuitSpec = { parts: [part('f1', 'fsr', { col: 4, row: 'a' }), part('r1', 'resistor', { col: 5, row: 'c' }, { ohms: 10000 })],
      wires: [w('uno.5V', 'bb.4c'), w('bb.5b', 'uno.A0'), w('bb.9d', 'uno.GND')] };
    const at = (grams: number) => reading(run(spec, pins(), { f1: { grams } }).pinVolts[A0]);
    expect(at(0)).toBeLessThanOrEqual(2);
    expect(Math.abs(at(100) - 512)).toBeLessThanOrEqual(5);
    expect(at(1000)).toBeGreaterThan(900);
  });

  it('a diode conducts one way only', () => {
    const fwd: CircuitSpec = { parts: [part('d1', 'diode', { col: 3, row: 'a' }), part('r1', 'resistor', { col: 7, row: 'c' }, { ohms: 1000 })],
      wires: [w('uno.5V', 'bb.3c'), w('bb.11d', 'uno.GND')] };
    expect(run(fwd).parts.d1.current).toBeCloseTo((5 - 0.7) / 1000, 3);
    const rev: CircuitSpec = { ...fwd, wires: [w('uno.GND', 'bb.3c'), w('bb.11d', 'uno.5V')] };
    expect(run(rev).parts.d1.current).toBeCloseTo(0, 6);
  });

  it('traffic-light module: its own resistors, one pin per colour', () => {
    const spec: CircuitSpec = { parts: [part('tl', 'traffic', { col: 20, row: 'a' })], // R 20a, Y 21a, G 22a, GND 23a
      wires: [w('uno.D4', 'bb.20c'), w('uno.D3', 'bb.21c'), w('uno.D2', 'bb.22c'), w('bb.23c', 'uno.GND')] };
    const r = run(spec, pins({ 4: out(true), 3: out(false), 2: out(true) }));
    expect(r.parts.tl.lights).toEqual({ R: expect.any(Number), Y: 0, G: expect.any(Number) });
    expect(r.parts.tl.lights!.R).toBeGreaterThan(0.5);
    expect(r.newBurns).toEqual([]);
  });
});

describe('motors and modules on the bench', () => {
  const motor = part('m1', 'motor', { x: 120, z: 0 });
  const tip = part('q1', 'npn', { col: 20, row: 'a' });        // B 20a, C 21a, E 22a
  const base = part('rb', 'resistor', { col: 16, row: 'b' }, { ohms: 1000 }); // 16b … 20b
  const motorCircuit: CircuitSpec = { parts: [motor, tip, base], wires: [
    w('uno.D6', 'bb.16c'), w('uno.5V', 'm1.+'), w('m1.-', 'bb.21c'), w('bb.22c', 'uno.GND'),
  ] };

  it('a DC motor through a TIP120: full speed with the pin HIGH, stopped LOW, half with analogWrite 128', () => {
    expect(run(motorCircuit, pins({ 6: out(true) })).parts.m1.speed).toBeGreaterThan(0.9);
    expect(run(motorCircuit, pins({ 6: out(false) })).parts.m1.speed).toBe(0);
    expect(run(motorCircuit, pins({ 6: out(true, 128 / 255) })).parts.m1.speed).toBeCloseTo(0.5, 1);
  });

  it('a motor straight on a pin burns the pin (a pin cannot power a motor)', () => {
    const r = run({ parts: [motor], wires: [w('uno.D6', 'm1.+'), w('m1.-', 'uno.GND')] }, pins({ 6: out(true) }));
    expect(r.newBurns).toEqual([{ id: 'uno.D6', reason: 'pin-overcurrent' }]);
  });

  it('a module works only with its VCC on 5 V and its GND on ground', () => {
    const hc = part('hc1', 'hcsr04', { x: 0, z: 70 });
    const both = run({ parts: [hc], wires: [w('uno.5V', 'hc1.VCC'), w('hc1.GND', 'uno.GND')] });
    expect(both.parts.hc1.powered).toBe(true);
    expect(run({ parts: [hc], wires: [w('uno.5V', 'hc1.VCC')] }).parts.hc1.powered).toBe(false);
    expect(run({ parts: [hc], wires: [w('uno.3V3', 'hc1.VCC'), w('hc1.GND', 'uno.GND')] }).parts.hc1.powered).toBe(false);
  });

  it('soil sensor: about 520 when dry and 260 in water', () => {
    const soil = part('s1', 'soil', { x: 120, z: 60 });
    const spec: CircuitSpec = { parts: [soil], wires: [w('uno.5V', 's1.VCC'), w('s1.GND', 'uno.GND'), w('s1.AOUT', 'uno.A0')] };
    expect(Math.abs(reading(run(spec, pins(), { s1: { moisture: 0 } }).pinVolts[A0]) - 520)).toBeLessThanOrEqual(3);
    expect(Math.abs(reading(run(spec, pins(), { s1: { moisture: 100 } }).pinVolts[A0]) - 260)).toBeLessThanOrEqual(3);
  });

  it('unoLinks: which UNO pin each module pin is wired to (directly or through the breadboard)', () => {
    const spec: CircuitSpec = { parts: [part('hc1', 'hcsr04', { x: 0, z: 70 })],
      wires: [w('uno.D9', 'hc1.TRIG'), w('hc1.ECHO', 'bb.30a'), w('bb.30e', 'uno.D10')] };
    expect(unoLinks(spec).hc1).toEqual({ VCC: null, TRIG: 9, ECHO: 10, GND: null });
  });
});

describe('wire voltages (for the live wire tags)', () => {
  it('every wire reports the voltage of its net', () => {
    const spec: CircuitSpec = { parts: [], wires: [{ id: 'a', from: 'uno.5V', to: 'bb.3c', color: '#000' }, { id: 'b', from: 'uno.D13', to: 'bb.8a', color: '#000' }, { id: 'c', from: 'bb.9d', to: 'uno.GND', color: '#000' }] };
    const r = run(spec, pins({ 13: out(true) }));
    expect(r.wireVolts.a).toBeCloseTo(5, 1);
    expect(r.wireVolts.b).toBeCloseTo(5, 1);
    expect(r.wireVolts.c).toBeCloseTo(0, 3);
  });
});

describe('review: modules that really run from 3.3 V', () => {
  it('the soil sensor works from the 3.3 V pin (its supply droops a little under load)', () => {
    const soil = part('s1', 'soil', { x: 120, z: -72 });
    const spec: CircuitSpec = { parts: [soil], wires: [w('uno.3V3', 's1.VCC'), w('s1.GND', 'uno.GND'), w('s1.AOUT', 'uno.A0')] };
    const r = run(spec, pins(), { s1: { moisture: 0 } });
    expect(r.parts.s1.powered).toBe(true);
    expect(reading(r.pinVolts[A0])).toBeGreaterThan(400);
  });
  it('the OLED and the TMP36 also run from 3.3 V', () => {
    const spec: CircuitSpec = { parts: [part('o1', 'oled', { x: 0, z: -72 }), part('t1', 'tmp36', { col: 4, row: 'c' })],
      wires: [w('uno.3V3', 'o1.VCC'), w('o1.GND', 'uno.GND'), w('uno.3V3', 'bb.4a'), w('bb.6a', 'uno.GND')] };
    const r = run(spec);
    expect(r.parts.o1.powered).toBe(true);
    expect(r.parts.t1.powered).toBe(true);
  });
});
