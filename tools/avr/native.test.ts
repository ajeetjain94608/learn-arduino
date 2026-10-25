// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preprocessSketch } from '../../src/build/compiler/preprocess';
import { CPP_FLAGS, INCLUDES, MCU, nativeAvailable, nativeTools } from './nativeToolchain.mjs';

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
      expect(lines.every((l) => Number.isInteger(l.addr) && l.line >= 0), base).toBe(true);
      expect(lines.some((l) => l.line >= 1), `${base} has sketch lines`).toBe(true);
    }
  });
});

describe.skipIf(!nativeAvailable())('preprocessed sketches with the real compiler', () => {
  const compile = (ino: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'rq-pp-'));
    try {
      const f = join(dir, 'sketch.cpp');
      writeFileSync(f, preprocessSketch(ino).cpp);
      return spawnSync(nativeTools().gpp, [...CPP_FLAGS, ...MCU, ...INCLUDES, f, '-o', join(dir, 'sketch.o')], { encoding: 'utf8' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };

  it('a function defined after loop can be called', () => {
    expect(compile('void setup() { Serial.begin(9600); }\nvoid loop() { Serial.println(twice(3)); }\nint twice(int x) {\n  return x * 2;\n}\n').status).toBe(0);
  });

  it('default arguments work for calls before the definition', () => {
    const r = compile('void setup() { flash(); }\nvoid loop() {}\nvoid flash(int times = 3, int ms = 100) { delay(times * ms); }\n');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('errors name the sketch file and its own line numbers', () => {
    const r = compile('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH)\n  delay(1000);\n}\n');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/sketch\.ino:7:\d+: error: expected ';' before 'delay'/);
  });
});
