import commands from './commands.json';
import { parseDiagnostics } from './diagnostics';
import { elfSizes } from './elfSizes';
import { parseLineTable } from './lineTable';
import { preprocessSketch, SKETCH_FILE } from './preprocess';
import type { CompileResult } from './types';

export type ToolName = 'cc1plus' | 'as' | 'ld' | 'objcopy' | 'readelf';
export type ToolRun = { code: number; stdout: string; stderr: string; files: Record<string, Uint8Array> };

// Where the tools run: the WebAssembly toolchain in a worker (the app), or native tools (tests). `roots` are
// the paths the recorded command lines' placeholders stand for in that environment.
export interface ToolEnv {
  roots: { SYSROOT: string; CORE: string; CORE_A: string; LIBS: string };
  run(tool: ToolName, args: string[], inputs: Record<string, Uint8Array>, outputs: string[]): Promise<ToolRun>;
}

const fill = (args: string[], env: ToolEnv, io: { IN: string; OUT: string }) =>
  args.map((a) => a.replace('{SYSROOT}', env.roots.SYSROOT).replace('{CORE_A}', env.roots.CORE_A).replace('{CORE}', env.roots.CORE).replace('{LIBS}', env.roots.LIBS)
    .replace('{IN}', io.IN).replace('{OUT}', io.OUT));
const text = (b: Uint8Array) => new TextDecoder().decode(b);

// Sketch → program, the same steps the gcc driver runs for the Arduino tools (recorded in commands.json):
// preprocess, cc1plus (C++ → assembly), as (→ object), ld (with the precompiled core → ELF), objcopy (→ Intel HEX),
// readelf (line table). The first failing step's messages come back as diagnostics on the sketch's lines.
export async function compileSketch(sketch: string, env: ToolEnv): Promise<CompileResult> {
  const t0 = performance.now();
  const { cpp, userLine } = preprocessSketch(sketch);
  const fail = (stderr: string): CompileResult => {
    const diagnostics = parseDiagnostics(stderr, userLine, sketch);
    if (!diagnostics.some((d) => d.severity === 'error')) diagnostics.push({ line: 1, col: 1, severity: 'error', message: stderr.trim() || 'The compiler stopped without saying why.' });
    return { ok: false, diagnostics, ms: performance.now() - t0 };
  };

  const cc = await env.run('cc1plus', fill(commands.cc1plus, env, { IN: 'sketch.cpp', OUT: 'sketch.s' }), { 'sketch.cpp': new TextEncoder().encode(cpp) }, ['sketch.s']);
  if (cc.code !== 0) return fail(cc.stderr);
  const asm = await env.run('as', fill(commands.as, env, { IN: 'sketch.s', OUT: 'sketch.o' }), { 'sketch.s': cc.files['sketch.s'] }, ['sketch.o']);
  if (asm.code !== 0) return fail(cc.stderr + asm.stderr);
  const ld = await env.run('ld', fill(commands.ld, env, { IN: 'sketch.o', OUT: 'sketch.elf' }), { 'sketch.o': asm.files['sketch.o'] }, ['sketch.elf']);
  if (ld.code !== 0) return fail(cc.stderr + ld.stderr);
  const elf = ld.files['sketch.elf'];
  const hex = await env.run('objcopy', ['-O', 'ihex', '-R', '.eeprom', 'sketch.elf', 'sketch.hex'], { 'sketch.elf': elf }, ['sketch.hex']);
  const lines = await env.run('readelf', ['--debug-dump=decodedline', 'sketch.elf'], { 'sketch.elf': elf }, []);
  if (hex.code !== 0 || lines.code !== 0) return fail(hex.stderr + lines.stderr);

  return {
    ok: true,
    program: { hex: text(hex.files['sketch.hex']), lines: parseLineTable(lines.stdout, SKETCH_FILE), ...elfSizes(elf) },
    diagnostics: parseDiagnostics(cc.stderr, userLine, sketch), // warnings
    ms: performance.now() - t0,
  };
}
