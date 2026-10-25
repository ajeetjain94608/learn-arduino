// A minimal tar archive (ustar headers, GNU long-name records) for the compiler's sysroot: headers, libraries and
// the precompiled core, shipped as one file and unpacked into the WebAssembly tools' in-memory file system.

const BLOCK = 512;
const enc = new TextEncoder(), dec = new TextDecoder();

function header(name: string, size: number, type: string): Uint8Array {
  const h = new Uint8Array(BLOCK);
  const put = (s: string, at: number, len: number) => h.set(enc.encode(s).subarray(0, len), at);
  put(name, 0, 100);
  put('0000644\0', 100, 8);
  put('0000000\0', 108, 8);
  put('0000000\0', 116, 8);
  put(size.toString(8).padStart(11, '0') + '\0', 124, 12);
  put('00000000000\0', 136, 12);
  put(type, 156, 1);
  put('ustar\0' + '00', 257, 8);
  h.fill(0x20, 148, 156); // checksum is computed with its own field as spaces
  const sum = h.reduce((s, b) => s + b, 0);
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return h;
}
const padded = (n: number) => Math.ceil(n / BLOCK) * BLOCK;

export function makeTar(files: Record<string, Uint8Array>): Uint8Array {
  const parts: Uint8Array[] = [];
  const add = (name: string, data: Uint8Array, type = '0') => {
    parts.push(header(name, data.length, type));
    const body = new Uint8Array(padded(data.length));
    body.set(data);
    parts.push(body);
  };
  for (const [name, data] of Object.entries(files)) {
    if (enc.encode(name).length >= 100) add('././@LongLink', enc.encode(name + '\0'), 'L');
    add(name.slice(0, 99), data);
  }
  parts.push(new Uint8Array(BLOCK * 2));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export function readTar(tar: Uint8Array): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  let at = 0, longName: string | null = null;
  while (at + BLOCK <= tar.length) {
    const h = tar.subarray(at, at + BLOCK);
    if (h.every((b) => b === 0)) break;
    const str = (from: number, len: number) => dec.decode(h.subarray(from, from + len)).replace(/\0.*$/s, '');
    const stored = parseInt(str(148, 8).trim(), 8);
    const sum = h.reduce((s, b, i) => s + (i >= 148 && i < 156 ? 0x20 : b), 0);
    if (sum !== stored) throw new Error(`tar: bad header checksum at byte ${at}`);
    const size = parseInt(str(124, 12).trim() || '0', 8), type = str(156, 1) || '0';
    const data = tar.slice(at + BLOCK, at + BLOCK + size);
    at += BLOCK + padded(size);
    if (type === 'L') { longName = dec.decode(data).replace(/\0.*$/s, ''); continue; }
    if (type === '0') files[longName ?? str(0, 100)] = data;
    longName = null;
  }
  return files;
}
