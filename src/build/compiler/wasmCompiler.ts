import type { CompileResult, Compiler } from './types';

// The app's compiler: GCC as WebAssembly in a Web Worker (compile.worker.ts). The worker starts on first use.
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve(r: CompileResult): void; reject(e: Error): void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; result?: CompileResult; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.result) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error ?? 'The compiler stopped unexpectedly.'));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'The compiler stopped unexpectedly.'));
    pending.clear();
    worker?.terminate();
    worker = null; // a fresh worker next time
  };
  return worker;
}

export const wasmCompiler: Compiler = {
  compile(sketch) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, sketch });
    });
  },
};
