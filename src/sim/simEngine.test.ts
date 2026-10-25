// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LineEntry } from '../build/compiler/types';
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
