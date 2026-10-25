// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nativeAvailable, nativeTools } from './nativeToolchain.mjs';

const FIX = 'src/sim/avr/fixtures';

describe.skipIf(!nativeAvailable())('native AVR toolchain outputs', () => {
  it('core.a exists and contains main.cpp.o and wiring.c.o', () => {
    expect(existsSync('public/avr/uno/core.a')).toBe(true);
    const members = execFileSync(nativeTools().ar, ['t', 'public/avr/uno/core.a'], { encoding: 'utf8' }).split(/\r?\n/);
    expect(members).toContain('main.cpp.o');
    expect(members).toContain('wiring.c.o');
  });

  it('commands.json has cc1plus, as and ld with {IN} and {OUT}', () => {
    const c = JSON.parse(readFileSync('tools/avr/commands.json', 'utf8')) as Record<string, string[]>;
    for (const tool of ['cc1plus', 'as', 'ld']) {
      expect(c[tool], tool).toBeInstanceOf(Array);
      expect(c[tool].some((a) => a.includes('{IN}')), `${tool} {IN}`).toBe(true);
      expect(c[tool].some((a) => a.includes('{OUT}')), `${tool} {OUT}`).toBe(true);
    }
  });

  it('every fixture has a hex and a non-empty line table', () => {
    const sketches = readdirSync(FIX).filter((f) => f.endsWith('.ino'));
    expect(sketches.length).toBe(8);
    for (const ino of sketches) {
      const base = `${FIX}/${ino.replace(/\.ino$/, '')}`;
      expect(readFileSync(`${base}.hex`, 'utf8'), base).toMatch(/^:[0-9A-F]+/);
      const lines = JSON.parse(readFileSync(`${base}.lines.json`, 'utf8')) as { addr: number; line: number }[];
      expect(lines.length, base).toBeGreaterThan(0);
      expect(lines.every((l) => Number.isInteger(l.addr) && l.line >= 1), base).toBe(true);
    }
  });
});
