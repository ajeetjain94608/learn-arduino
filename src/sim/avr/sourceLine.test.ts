// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LineEntry } from '../../build/compiler/types';
import { AvrRunner } from './AvrRunner';
import { parseIntelHex } from './hex';
import { currentLine } from './sourceLine';

const load = (name: string) => ({
  runner: new AvrRunner(parseIntelHex(readFileSync(`src/sim/avr/fixtures/${name}.hex`, 'utf8'))),
  table: JSON.parse(readFileSync(`src/sim/avr/fixtures/${name}.lines.json`, 'utf8')) as LineEntry[],
});
const lineNow = ({ runner, table }: ReturnType<typeof load>) => currentLine(runner.pc, runner.returnAddresses(), table);

describe('the running source line', () => {
  it('blink: while in delay after HIGH, current line is the first delay(1000) line (9)', () => {
    const b = load('blink');
    b.runner.runFor(500, 1000);
    expect(b.runner.pin(13).high).toBe(true);
    expect(lineNow(b)).toBe(9);
  });

  it('during the LOW half it is line 12', () => {
    const b = load('blink');
    b.runner.runFor(1500, 1000);
    expect(b.runner.pin(13).high).toBe(false);
    expect(lineNow(b)).toBe(12);
  });

  it('pc outside sketch with no sketch return address gives null', () => {
    const table: LineEntry[] = [{ addr: 0x100, line: 3 }, { addr: 0x120, line: 0 }];
    expect(currentLine(0x200, [0x300], table)).toBeNull();
    expect(currentLine(0x80, [], table)).toBeNull(); // before any entry
    expect(currentLine(0x110, [], table)).toBe(3);
    expect(currentLine(0x200, [0x300, 0x112], table)).toBe(3); // called from line 3
  });

  it('a return address at the start of the next line still belongs to the calling line', () => {
    const table: LineEntry[] = [{ addr: 0x100, line: 9 }, { addr: 0x10c, line: 10 }, { addr: 0x120, line: 0 }];
    expect(currentLine(0x400, [0x10c], table)).toBe(9); // a call that is the last instruction of line 9 returns to 0x10c
  });
});
