import type { CompileResult, Compiler } from './types';

// DEVELOPMENT ONLY: asks the dev server to compile (tools/avr/devCompilePlugin.ts). Installed by main.tsx only
// when import.meta.env.DEV, until the WebAssembly compiler replaces it.
export const devCompiler: Compiler = {
  async compile(sketch) {
    const res = await fetch('/__dev/compile', { method: 'POST', body: sketch, headers: { 'Content-Type': 'text/plain' } });
    if (!res.ok) throw new Error(`The development compiler failed: ${await res.text()}`);
    return (await res.json()) as CompileResult;
  },
};
