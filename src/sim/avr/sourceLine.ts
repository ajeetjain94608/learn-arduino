import type { LineEntry } from '../../build/compiler/types';

// Line-table lookup: the entry with the greatest addr ≤ address (binary search); 0 / before the table = not sketch.
function lineAt(addr: number, table: LineEntry[]): number {
  let lo = 0, hi = table.length - 1, found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid].addr <= addr) { found = table[mid].line; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

// Which sketch line is running: the program counter's own line when it is in the sketch; otherwise the line that
// called into the core (e.g. the `delay(1000)` line while delay runs), found from the stack's return addresses.
// A return address points just past the call, which may already be the next line's first byte, so it is looked
// up 2 bytes earlier (inside the call instruction). Best effort: null when nothing maps to the sketch.
export function currentLine(pc: number, returns: number[], table: LineEntry[]): number | null {
  const own = lineAt(pc, table);
  if (own > 0) return own;
  for (const ret of returns) {
    const l = lineAt(ret - 2, table);
    if (l > 0) return l;
  }
  return null;
}
