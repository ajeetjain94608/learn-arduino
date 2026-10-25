// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileSketch, type ToolName } from '../../src/build/compiler/pipeline';
import { readTar } from '../../src/build/compiler/tar';
import { createWasmEnv, type LoadedTool, type ToolFactory } from '../../src/build/compiler/wasmEnv';
import { BLINK } from '../../src/content/sketches/blink';
import { AvrRunner } from '../../src/sim/avr/AvrRunner';
import { parseIntelHex } from '../../src/sim/avr/hex';
import { runSim } from '../../src/sim/avr/testing';

const DIR = 'public/avr/toolchain';
const built = existsSync(`${DIR}/cc1plus.wasm`) && existsSync('public/avr/uno/sysroot.tar');

const cache = new Map<ToolName, Promise<LoadedTool>>();
const load = (tool: ToolName) => {
  if (!cache.has(tool)) cache.set(tool, (async () => ({
    factory: (await import(pathToFileURL(resolve(`${DIR}/${tool}.mjs`)).href)).default as ToolFactory,
    module: await WebAssembly.compile(readFileSync(`${DIR}/${tool}.wasm`)),
  }))());
  return cache.get(tool)!;
};

describe.skipIf(!built)('the WebAssembly toolchain', { timeout: 300_000 }, () => {
  const env = () => createWasmEnv(load, readTar(readFileSync('public/avr/uno/sysroot.tar')));

  it('compiles blink to a program that blinks', async () => {
    const r = await compileSketch(BLINK.code, env());
    if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
    const chip = new AvrRunner(parseIntelHex(r.program.hex));
    const edges: number[] = [];
    let last = chip.pin(13).high;
    for (let ms = 0; ms < 3200; ms++) { runSim(chip, 1); if (chip.pin(13).high !== last) { last = !last; edges.push(chip.simMs); } }
    expect(edges.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < edges.length; i++) expect(Math.abs(edges[i] - edges[i - 1] - 1000)).toBeLessThanOrEqual(1);
    expect(r.program.lines).toEqual(BLINK.program.lines);
    console.log(`WASM compile of Blink: ${Math.round(r.ms)} ms`);
  });

  it("its program matches native avr-gcc's for blink (same size ±2%)", async () => {
    const r = await compileSketch(BLINK.code, env());
    if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
    if (r.program.hex !== BLINK.program.hex) console.log('note: WASM program differs from native byte-for-byte (binutils version)');
    expect(Math.abs(r.program.flashBytes - BLINK.program.flashBytes)).toBeLessThanOrEqual(BLINK.program.flashBytes * 0.02);
  });

  it('errors come back as diagnostics', async () => {
    const r = await compileSketch(BLINK.code.replace('digitalWrite(13, HIGH);', 'digitalWrite(13, HIGH)'), env());
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]).toMatchObject({ line: 7, severity: 'error' });
  });

  it('SOURCES.md lists every upstream tarball with a SHA-256', () => {
    const md = readFileSync(`${DIR}/SOURCES.md`, 'utf8');
    for (const f of ['gcc-7.3.0.tar.xz', 'binutils-2.42.tar.xz', 'gmp-6.2.1.tar.xz', 'mpfr-4.1.0.tar.xz', 'mpc-1.2.1.tar.gz', 'atmel-patches-gcc.7.3.0-arduino2.patch'])
      expect(md).toMatch(new RegExp(`${f.replace(/\./g, '\\.')} \\| \`[0-9a-f]{64}\``));
  });
});
