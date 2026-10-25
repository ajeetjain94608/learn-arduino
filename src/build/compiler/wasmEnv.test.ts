// @vitest-environment node
import { expect, it } from 'vitest';
import { createWasmEnv, type ToolFactory } from './wasmEnv';

it('a tool whose WebAssembly cannot start fails the step instead of hanging', async () => {
  // a factory that, like Emscripten's, waits for instantiateWasm to hand it an instance
  const factory: ToolFactory = (opts) => new Promise((resolve) => {
    opts.instantiateWasm({}, () => resolve({ FS: {} as never, callMain: () => 0 }));
  });
  const env = createWasmEnv(async () => ({ factory, module: 'not a module' as unknown as WebAssembly.Module }), {});
  const outcome = await Promise.race([
    env.run('as', [], {}, []).then(() => 'resolved', (e: Error) => `rejected: ${e.message}`),
    new Promise((r) => setTimeout(() => r('hung'), 2000)),
  ]);
  expect(outcome).toMatch(/^rejected/);
});
