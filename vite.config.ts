/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

// The written tutorials (/learn/…) are plain pages made by tools/learn/build.mjs when the site is built. While developing they are
// made too — once when the dev server starts and again whenever an article or the builder changes — and served from
// node_modules/.learn-dev, so the app's Tutorials button opens them here just as on the live site.
function learnPages(): Plugin {
  const out = path.resolve('node_modules/.learn-dev');
  const rebuild = async () => {
    const builder = './tools/learn/build.mjs'; // (plain JavaScript, loaded as it is)
    const { build } = (await import(/* @vite-ignore */ builder)) as { build(dir: string): unknown };
    build(out);
  };
  return {
    name: 'learn-pages',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.VITEST) return; // (unit tests don't need the pages)
      await rebuild().catch((e) => console.error('learn pages:', e));
      server.watcher.add([path.resolve('content/learn'), path.resolve('tools/learn')]);
      server.watcher.on('change', (f) => { if (/content[\\/]learn|tools[\\/]learn/.test(f)) rebuild().catch((e) => console.error('learn pages:', e)); });
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0]);
        if (!/^\/learn(\/|$)/.test(url)) return next();
        let file = path.join(out, url);
        if (!file.startsWith(out)) return next();
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
          if (!url.endsWith('/')) { res.statusCode = 301; res.setHeader('Location', `${url}/`); res.end(); return; }
          file = path.join(file, 'index.html');
        }
        if (!fs.existsSync(file)) { res.statusCode = 404; res.end('Not found'); return; }
        res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), learnPages()],
  worker: { format: 'es' },
  // the app always runs on its own port (5173 is often taken by other Vite projects).
  server: { port: 5180, strictPort: true, host: true },
  preview: { port: 5181, strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
