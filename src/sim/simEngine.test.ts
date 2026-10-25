// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LineEntry } from '../build/compiler/types';
import type { CircuitSpec, PartInstance, Wire } from '../circuit/types';
import { parseIntelHex } from './avr/hex';
import { MAX_DEBT_MS, SimEngine } from './simEngine';

const prog = (name: string) => ({
  flash: parseIntelHex(readFileSync(`src/sim/avr/fixtures/${name}.hex`, 'utf8')),
  lines: JSON.parse(readFileSync(`src/sim/avr/fixtures/${name}.lines.json`, 'utf8')) as LineEntry[],
});
// drive the engine like the worker does, with a fake clock: one step per 16 ms frame of "wall" time
function play(e: SimEngine, from: number, ms: number, budget = 1e9) {
  let now = from;
  for (; now < from + ms; now += 16) e.step(now, budget);
  return now;
}

describe('SimEngine: the chip on its own thread', { timeout: 60_000 }, () => {
  it('keeps pace with real time: after 1 s of wall time the chip has run about 1 s, never more', () => {
    const e = new SimEngine();
    const { flash, lines } = prog('blink');
    e.load(flash, lines, 0);
    play(e, 0, 1000);
    const s = e.snapshot();
    expect(s.simMs).toBeGreaterThan(1000 - 32);
    expect(s.simMs).toBeLessThanOrEqual(1000);
    expect(s.speed).toBe(1);
  });

  it('collects what the program prints and follows pin 13 and the running line', () => {
    const e = new SimEngine();
    const { flash, lines } = prog('blink');
    e.load(flash, lines, 0);
    play(e, 0, 500);
    const s = e.snapshot();
    expect(s.serial).toBe('LED on\r\n');
    expect(s.pin13).toBe(true);
    expect(s.line).toBe(9);
    expect(e.snapshot().serial).toBe(''); // taken
  });

  it('reset pauses the chip until resume (the bootloader runs first)', () => {
    const e = new SimEngine();
    const { flash, lines } = prog('serial');
    e.load(flash, lines, 0);
    play(e, 0, 200);
    e.snapshot();
    e.reset();
    expect(e.snapshot().simMs).toBe(0);
    play(e, 200, 500);
    expect(e.snapshot().simMs).toBe(0);
    e.resume(700);
    play(e, 700, 200);
    expect(e.snapshot().serial).toBe('hello\r\n');
  });

  it('after a slow stretch it does not race to catch up', () => {
    const e = new SimEngine();
    const { flash, lines } = prog('busy');
    e.load(flash, lines, 0);
    const now = play(e, 0, 1000, 0.5); // a slow device: the chip falls far behind
    const before = e.snapshot();
    expect(before.speed).toBeLessThan(0.9);
    expect(before.simMs).toBeLessThan(900);
    e.step(now, 1e9); // now plenty of time: it catches up at most MAX_DEBT_MS, not the whole backlog
    expect(e.snapshot().simMs - before.simMs).toBeLessThanOrEqual(MAX_DEBT_MS + 16);
  });

  it('text sent to the board arrives', () => {
    const e = new SimEngine();
    const { flash, lines } = prog('echo');
    e.load(flash, lines, 0);
    play(e, 0, 20);
    e.serialWrite('hi');
    play(e, 20, 50);
    expect(e.snapshot().serial).toBe('HI');
  });

  it('hold (tests) freezes once pin 13 is HIGH and its line is printed', () => {
    const e = new SimEngine();
    const { flash, lines } = prog('blink');
    e.setHold(true);
    e.load(flash, lines, 0);
    play(e, 0, 3000);
    const s = e.snapshot();
    expect(s.pin13).toBe(true);
    expect(s.serial).toBe('LED on\r\n');
    expect(s.simMs).toBeLessThan(1000);
    expect(s.speed).toBe(1);
  });

  it('stop drops the program', () => {
    const e = new SimEngine();
    const { flash, lines } = prog('blink');
    e.load(flash, lines, 0);
    play(e, 0, 100);
    e.stop();
    expect(e.snapshot().running).toBe(false);
  });
});

describe('SimEngine with a circuit', { timeout: 60_000 }, () => {
  const w = (from: string, to: string): Wire => ({ id: `${from}-${to}`, from, to, color: '#000' });
  const led: PartInstance = { id: 'led1', type: 'led', params: { color: 'red' }, at: { col: 10, row: 'a' } };
  const r220: PartInstance = { id: 'r1', type: 'resistor', params: { ohms: 220 }, at: { col: 11, row: 'b' } };
  const blinkCircuit: CircuitSpec = { parts: [led, r220], wires: [w('uno.D13', 'bb.10c'), w('bb.15c', 'uno.GND')] };

  it("with LED + 220 Ω on D13, the LED's brightness follows blink", () => {
    const e = new SimEngine();
    e.setCircuit(blinkCircuit);
    const { flash, lines } = prog('blink');
    e.load(flash, lines, 0);
    play(e, 0, 500);
    expect(e.snapshot().circuit!.parts.led1.brightness).toBeCloseTo(0.6, 1);
    play(e, 500, 1000);
    expect(e.snapshot().circuit!.parts.led1.brightness).toBe(0);
  });

  it("the button fixture sees the circuit's button (wired between D2 and GND)", () => {
    const e = new SimEngine();
    e.setCircuit({ parts: [{ id: 'b1', type: 'button', params: {}, at: { col: 20, row: 'e' } }], wires: [w('uno.D2', 'bb.20a'), w('bb.22a', 'uno.GND')] });
    const { flash, lines } = prog('button');
    e.load(flash, lines, 0);
    play(e, 0, 50);
    expect(e.snapshot().pin13).toBe(false); // pull-up: not pressed reads HIGH, D13 = !HIGH
    e.setInput('b1', 'pressed', 1);
    play(e, 50, 50);
    expect(e.snapshot().pin13).toBe(true);
  });

  it('the analog fixture prints the pot position × 1023 (±2)', () => {
    const e = new SimEngine();
    e.setCircuit({ parts: [{ id: 'p1', type: 'pot', params: {}, at: { col: 5, row: 'a' } }], wires: [w('uno.5V', 'bb.5c'), w('bb.7c', 'uno.A0'), w('bb.9c', 'uno.GND')] });
    e.setInput('p1', 'position', 0.25);
    const { flash, lines } = prog('analog');
    e.load(flash, lines, 0);
    play(e, 0, 250);
    const values = e.snapshot().serial.trim().split(/\r\n/).map(Number);
    expect(values.length).toBeGreaterThanOrEqual(2);
    for (const v of values) expect(Math.abs(v - 0.25 * 1023)).toBeLessThanOrEqual(2);
  });

  it('wiring 5V to GND stops the program with a short', () => {
    const e = new SimEngine();
    e.setCircuit({ parts: [], wires: [w('uno.5V', 'uno.GND')] });
    const { flash, lines } = prog('blink');
    e.load(flash, lines, 0);
    play(e, 0, 100);
    const s = e.snapshot();
    expect(s.running).toBe(false);
    expect(s.circuit!.board.shorted).toBe(true);
  });

  it('replace clears the burn', () => {
    const e = new SimEngine();
    e.setCircuit({ parts: [led], wires: [w('uno.D13', 'bb.10c'), w('bb.11c', 'uno.GND')] }); // no resistor
    const { flash, lines } = prog('blink');
    e.load(flash, lines, 0);
    play(e, 0, 300);
    expect(e.snapshot().circuit!.parts.led1.burnt).toBe(true);
    e.setCircuit(blinkCircuit); // the learner adds the resistor…
    e.replace('led1');          // …and replaces the LED
    play(e, 300, 400);
    expect(e.snapshot().circuit!.parts.led1.burnt).toBeFalsy();
    expect(e.snapshot().circuit!.burns).toEqual([]);
  });
});
