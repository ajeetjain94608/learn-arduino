// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compileSketch } from '../../src/build/compiler/pipeline';
import { BLINK } from '../../src/content/sketches/blink';
import { t } from '../../src/i18n/en';
import { nativeEnv } from './nativeEnv';
import { nativeAvailable } from './nativeToolchain.mjs';

describe.skipIf(!nativeAvailable())('the compile pipeline (native tools standing in for the WASM ones)', { timeout: 60_000 }, () => {
  it('compiles blink to exactly the shipped program', async () => {
    const r = await compileSketch(BLINK.code, nativeEnv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.program.hex).toBe(BLINK.program.hex);
    expect(r.program.lines).toEqual(BLINK.program.lines);
    expect(r.program.flashBytes).toBe(BLINK.program.flashBytes);
    expect(r.program.ramBytes).toBe(BLINK.program.ramBytes);
    expect(r.ms).toBeGreaterThan(0);
  });

  it('a missing semicolon comes back as a diagnostic on the sketch line, and no program', async () => {
    const r = await compileSketch(BLINK.code.replace('digitalWrite(13, HIGH);', 'digitalWrite(13, HIGH)'), nativeEnv);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ line: 7, severity: 'error', hint: t('compile.hint.semicolon') });
  });

  it('a sketch without loop() gets the friendly link error', async () => {
    const r = await compileSketch('void setup() {\n  pinMode(13, OUTPUT);\n}\n', nativeEnv);
    expect(r.ok).toBe(false);
    expect(r.diagnostics).toEqual([expect.objectContaining({ severity: 'error', hint: t('compile.hint.noLoop') })]);
  });

  it('warnings do not stop the program', async () => {
    const r = await compileSketch('void setup() {\n  byte b = 300;\n  Serial.begin(9600);\n  Serial.println(b);\n}\n\nvoid loop() {\n}\n', nativeEnv);
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([expect.objectContaining({ line: 2, severity: 'warning' })]);
  });
});
