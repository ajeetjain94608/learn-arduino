// Version of the compiler files the app downloads: a hash of the WebAssembly tools, their loaders and the sysroot.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

export function toolchainHash() {
  const h = createHash('sha256');
  const files = [
    ...readdirSync('public/avr/toolchain').filter((f) => /\.(mjs|wasm)$/.test(f)).sort().map((f) => `public/avr/toolchain/${f}`),
    'public/avr/uno/sysroot.tar',
  ];
  for (const f of files) h.update(f).update(readFileSync(f));
  return h.digest('hex').slice(0, 12);
}
