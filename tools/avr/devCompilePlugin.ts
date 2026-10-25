import type { Plugin } from 'vite';

// DEVELOPMENT ONLY (`vite` dev server): POST /__dev/compile with the sketch as text → the CompileResult as JSON,
// compiled by the native AVR toolchain through the same pipeline the WebAssembly compiler will use. Stands in
// until the WASM toolchain exists (Build plan B1, Task 7). Never part of a production build.
export function devCompilePlugin(): Plugin {
  return {
    name: 'rq-dev-compile',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/compile', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c: string) => { body += c; });
        req.on('end', async () => {
          try {
            const { compileSketch } = await server.ssrLoadModule('/src/build/compiler/pipeline.ts');
            const { nativeEnv } = await server.ssrLoadModule('/tools/avr/nativeEnv.ts');
            const result = await compileSketch(body, nativeEnv);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e instanceof Error ? e.message : e));
          }
        });
      });
    },
  };
}
