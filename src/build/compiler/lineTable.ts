import type { LineEntry } from './types';

// `readelf --debug-dump=decodedline` → the program's line table (see LineEntry). Rows look like
// "<file>  <line>  0x<addr> [view] [stmt]". The sketch's rows give their line; rows of any other file (core,
// inlined headers) give 0 = not the sketch. When several rows share an address the last one is the statement
// that runs there; consecutive entries with the same line are merged. Same rules as tools/avr/build-fixtures.mjs.
export function parseLineTable(decoded: string, sketchFile: string): LineEntry[] {
  const at = new Map<number, number>();
  for (const row of decoded.split(/\r?\n/)) {
    const m = row.match(/^(\S+)\s+(\d+)\s+0x([0-9a-f]+)/i);
    if (m) at.set(parseInt(m[3], 16), m[1].endsWith(sketchFile) ? Number(m[2]) : 0);
  }
  const out: LineEntry[] = [];
  for (const [addr, line] of [...at].sort((x, y) => x[0] - y[0])) if (out.at(-1)?.line !== line) out.push({ addr, line });
  return out;
}
