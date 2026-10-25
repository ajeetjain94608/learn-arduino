// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AvrRunner } from './AvrRunner';
import { HexError, parseIntelHex } from './hex';
import { runSim } from './testing';

const fixture = (name: string) => new AvrRunner(parseIntelHex(readFileSync(`src/sim/avr/fixtures/${name}.hex`, 'utf8')));

// Run in 1 ms steps, calling `each` after every step (generous budget: correctness, not speed).
function runSteps(r: AvrRunner, ms: number, each?: () => void) {
  for (let i = 0; i < ms; i++) { runSim(r, 1); each?.(); }
}

describe('AvrRunner', { timeout: 60_000 }, () => {
  it('blink toggles D13 every 1000 ms (±1 ms)', () => {
    const r = fixture('blink');
    const edges: number[] = [];
    let last = r.pin(13).high;
    runSteps(r, 4200, () => { const h = r.pin(13).high; if (h !== last) { edges.push(r.simMs); last = h; } });
    expect(edges.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < edges.length; i++) expect(Math.abs(edges[i] - edges[i - 1] - 1000)).toBeLessThanOrEqual(1);
    expect(r.pin(13).mode).toBe('output');
  });

  it('blink prints "LED on" then "LED off"', () => {
    const r = fixture('blink');
    runSteps(r, 1500);
    expect(r.takeSerial()).toBe('LED on\r\nLED off\r\n');
    expect(r.lastTxSimMs).toBeGreaterThan(1000);
  });

  it('button: D13 follows the inverse of D2', () => {
    const r = fixture('button');
    runSteps(r, 5);
    expect(r.pin(2).mode).toBe('input-pullup');
    expect(r.pin(13).high).toBe(false); // pulled up, not pressed
    r.setInput(2, false);
    runSteps(r, 2);
    expect(r.pin(13).high).toBe(true);
    r.setInput(2, null); // released: floating, the pull-up wins
    runSteps(r, 2);
    expect(r.pin(13).high).toBe(false);
  });

  it('analog: prints 512 for 2.5 V on A0 (±2)', () => {
    const r = fixture('analog');
    r.setAnalog(0, 2.5);
    runSteps(r, 250);
    const values = r.takeSerial().trim().split(/\r\n/).map(Number);
    expect(values.length).toBeGreaterThanOrEqual(2);
    for (const v of values) expect(Math.abs(v - 512)).toBeLessThanOrEqual(2);
  });

  it('echo uppercases what is sent', () => {
    const r = fixture('echo');
    runSteps(r, 5);
    r.serialWrite('hi');
    runSteps(r, 20);
    expect(r.takeSerial()).toBe('HI');
  });

  it('reset restarts setup (serial prints "hello" again)', () => {
    const r = fixture('serial');
    runSteps(r, 50);
    expect(r.takeSerial()).toBe('hello\r\n');
    r.reset();
    expect(r.simMs).toBe(0);
    runSteps(r, 50);
    expect(r.takeSerial()).toBe('hello\r\n');
  });

  it('runFor respects the wall-clock budget', () => {
    const r = fixture('busy');
    const t0 = performance.now();
    const advanced = r.runFor(10_000, 8);
    expect(performance.now() - t0).toBeLessThan(50);
    expect(advanced).toBeLessThan(10_000);
    expect(advanced).toBeGreaterThan(0);
    expect(r.simMs).toBeCloseTo(advanced, 6);
  });

  it('serial flood is delivered in batches', () => {
    const r = fixture('flood');
    runSteps(r, 1000);
    const text = r.takeSerial();
    expect(text.length).toBeGreaterThan(1000);
    expect(text.startsWith('x\r\n')).toBe(true);
    expect(r.takeSerial()).toBe(''); // taken
  });

  it('parseIntelHex rejects a bad checksum', () => {
    expect(() => parseIntelHex(':0100000000FE\n:00000001FF\n')).toThrow(HexError);
    expect(parseIntelHex(':0100000055AA\n:00000001FF\n')[0]).toBe(0x55);
  });
});
