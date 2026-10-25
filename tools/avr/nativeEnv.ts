// A ToolEnv backed by the native AVR toolchain (tests only): runs each tool in a temporary folder that holds
// the step's input files, and returns the requested output files.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ToolEnv, ToolName } from '../../src/build/compiler/pipeline';
import { CORE_DIR, GCC_DIR } from './nativeToolchain.mjs';

const exe = process.platform === 'win32' ? '.exe' : '';
const TOOLS: Record<ToolName, string> = {
  cc1plus: join(GCC_DIR, `libexec/gcc/avr/7.3.0/cc1plus${exe}`),
  as: join(GCC_DIR, `avr/bin/as${exe}`),
  ld: join(GCC_DIR, `avr/bin/ld${exe}`),
  objcopy: join(GCC_DIR, `bin/avr-objcopy${exe}`),
  readelf: join(GCC_DIR, `bin/avr-readelf${exe}`),
};
const slashes = (p: string) => p.split('\\').join('/');

export const nativeEnv: ToolEnv = {
  roots: { SYSROOT: slashes(GCC_DIR), CORE: slashes(CORE_DIR), CORE_A: slashes(resolve('public/avr/uno/core.a')) },
  async run(tool, args, inputs, outputs) {
    const dir = mkdtempSync(join(tmpdir(), `rq-${tool}-`));
    try {
      for (const [name, bytes] of Object.entries(inputs)) writeFileSync(join(dir, name), bytes);
      const r = spawnSync(TOOLS[tool], args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20 });
      const files: Record<string, Uint8Array> = {};
      if (r.status === 0) for (const name of outputs) files[name] = readFileSync(join(dir, name));
      // a tool that could not even start reports why (e.g. not found)
      return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr || (r.error ? `${tool}: ${r.error.message}` : ''), files };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  },
};
