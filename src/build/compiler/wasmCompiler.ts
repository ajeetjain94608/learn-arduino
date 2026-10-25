import type { CompileResult, Compiler } from './types';

export type WorkerLike = {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  postMessage(m: { id: number; sketch: string }): void;
  terminate(): void;
};

const TIMEOUT_MS = 120_000; // a compile still running after this is stuck (e.g. out of memory on a phone)

// A Compiler backed by a compile worker. One compile at a time: a new compile, Stop (cancel) or a timeout ends the
// one in progress by terminating its worker — the next compile starts a fresh one (the toolchain stays cached).
export function createWorkerCompiler(makeWorker: () => WorkerLike, timeoutMs = TIMEOUT_MS): Compiler {
  let worker: WorkerLike | null = null;
  let nextId = 0;
  let current: { id: number; resolve(r: CompileResult): void; reject(e: Error): void; timer: ReturnType<typeof setTimeout> } | null = null;

  const finish = () => { if (current) clearTimeout(current.timer); current = null; };
  const abort = (why: string) => {
    const c = current;
    finish();
    worker?.terminate();
    worker = null;
    c?.reject(new Error(why));
  };
  const getWorker = () => {
    if (worker) return worker;
    const w = makeWorker();
    w.onmessage = (e: MessageEvent<{ id: number; result?: CompileResult; error?: string }>) => {
      const c = current;
      if (!c || e.data.id !== c.id) return;
      finish();
      if (e.data.result) c.resolve(e.data.result);
      else c.reject(new Error(e.data.error ?? 'The compiler stopped unexpectedly.'));
    };
    w.onerror = (e) => abort(e.message || 'The compiler stopped unexpectedly.');
    return (worker = w);
  };

  return {
    compile(sketch) {
      if (current) abort('Compile stopped.');
      return new Promise<CompileResult>((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => abort('The compiler took too long and was stopped. Try again.'), timeoutMs);
        current = { id, resolve, reject, timer };
        getWorker().postMessage({ id, sketch });
      });
    },
    cancel() { if (current) abort('Compile stopped.'); },
  };
}

// The app's compiler: GCC as WebAssembly in a Web Worker (compile.worker.ts), started on first use.
export const wasmCompiler: Compiler = createWorkerCompiler(
  () => new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
);
