// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLineTable } from './lineTable';

describe('parseLineTable', () => {
  it('reads readelf --debug-dump=decodedline into the same table the fixtures use', () => {
    // blink.decodedline.txt: native avr-readelf output for the blink fixture, compiled with the fixture flags
    const table = parseLineTable(readFileSync('src/build/compiler/fixtures/blink.decodedline.txt', 'utf8'), 'blink.ino');
    expect(table).toEqual(JSON.parse(readFileSync('src/sim/avr/fixtures/blink.lines.json', 'utf8')));
  });

  it('accepts newer binutils rows with View and Stmt columns', () => {
    const text = 'File name   Line number   Starting address   View   Stmt\nsketch.ino   3   0x100   x\nsketch.ino   4   0x10a   x\nwiring.c   12   0x200   x\n';
    expect(parseLineTable(text, 'sketch.ino')).toEqual([{ addr: 0x100, line: 3 }, { addr: 0x10a, line: 4 }, { addr: 0x200, line: 0 }]);
  });
});
