import type { ToolEnv, ToolName } from './pipeline';

// An Emscripten module built by tools/avr-wasm/build.sh (MODULARIZE + EXPORT_ES6, INVOKE_RUN=0, EXIT_RUNTIME=1).
type EmFS = {
  mkdirTree(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  chdir(path: string): void;
};
type EmModule = { FS: EmFS; callMain(args: string[]): number | undefined };
export type ToolFactory = (opts: {
  thisProgram: string;
  print(s: string): void;
  printErr(s: string): void;
  instantiateWasm(imports: WebAssembly.Imports, done: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void): object;
}) => Promise<EmModule>;
export type LoadedTool = { factory: ToolFactory; module: WebAssembly.Module };

// Which parts of the sysroot each tool reads (cc1plus: headers; ld: libraries and the core). Keys of `sysroot`
// are archive paths: sysroot/…, core/…, core.a.
const NEEDS: Partial<Record<ToolName, (path: string) => boolean>> = {
  cc1plus: (p) => p.startsWith('core/') || p.startsWith('sysroot/lib/gcc/avr/7.3.0/include') || p.startsWith('sysroot/avr/include/'),
  ld: (p) => p === 'core.a' || p.endsWith('.a') || p.endsWith('.o') || p.includes('/ldscripts/'),
};

// Runs the WebAssembly toolchain in memory: every run gets a fresh instance (the tools exit after main), with the
// sysroot files it needs, the step's inputs in /work, and its outputs read back.
export function createWasmEnv(load: (tool: ToolName) => Promise<LoadedTool>, sysroot: Record<string, Uint8Array>): ToolEnv {
  return {
    roots: { SYSROOT: '/sysroot', CORE: '/core', CORE_A: '/core.a' },
    async run(tool, args, inputs, outputs) {
      const { factory, module } = await load(tool);
      let stdout = '', stderr = '';
      const em = await factory({
        // where the tool "lives": ld finds its default linker scripts relative to it (../avr/lib/ldscripts)
        thisProgram: `/sysroot/bin/${tool}`,
        print: (s) => { stdout += s + '\n'; },
        printErr: (s) => { stderr += s + '\n'; },
        instantiateWasm: (imports, done) => { WebAssembly.instantiate(module, imports).then((i) => done(i, module)); return {}; },
      });
      const write = (path: string, data: Uint8Array) => {
        em.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')) || '/');
        em.FS.writeFile(path, data);
      };
      const need = NEEDS[tool];
      if (need) for (const [p, data] of Object.entries(sysroot)) if (need(p)) write(`/${p}`, data);
      write(`/sysroot/bin/${tool}`, new Uint8Array(0)); // so that path resolves
      em.FS.mkdirTree('/work');
      em.FS.chdir('/work');
      for (const [name, data] of Object.entries(inputs)) write(`/work/${name}`, data);

      let code: number;
      try { code = em.callMain(args) ?? 0; } catch (e) { code = (e as { status?: number }).status ?? 1; if (!(e as { status?: number }).status && !(e instanceof Error && /exit/i.test(e.message))) stderr += String(e) + '\n'; }
      const files: Record<string, Uint8Array> = {};
      if (code === 0) for (const name of outputs) files[name] = em.FS.readFile(`/work/${name}`);
      return { code, stdout, stderr, files };
    },
  };
}
