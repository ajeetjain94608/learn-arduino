// .ino → .cpp the way the Arduino tools do it: add `#include <Arduino.h>`, declare every function before the first
// function definition (so code can call functions defined further down), and keep `#line` directives so the
// compiler reports the learner's own line numbers.

export const SKETCH_FILE = 'sketch.ino';

const NOT_A_FUNCTION = /\b(if|else|for|while|switch|return|do|struct|class|enum|union|namespace|typedef|template|case|sizeof)\b|=/;
const DEFINITION = /^([A-Za-z_][\w\s*&:<>,]*?[\s*&])([A-Za-z_]\w*)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*(const\s*)?$/;

// Comments, string/char literals and preprocessor lines become spaces (newlines kept), so scanning for braces
// and definitions can't be fooled by text inside them; offsets stay identical to the source.
function mask(src: string): string {
  const out = src.split('');
  const blank = (from: number, to: number) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0, lineStart = true;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (lineStart && /\s/.test(c) && c !== '\n') { i++; continue; }
    if (lineStart && c === '#') { // directive, with backslash continuations
      let j = i;
      while (j < src.length && !(src[j] === '\n' && src[j - 1] !== '\\')) j++;
      blank(i, j); i = j; continue;
    }
    lineStart = c === '\n';
    if (c === '/' && n === '/') { const j = src.indexOf('\n', i); const end = j < 0 ? src.length : j; blank(i, end); i = end; continue; }
    if (c === '/' && n === '*') { const j = src.indexOf('*/', i + 2); const end = j < 0 ? src.length : j + 2; blank(i, end); i = end; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      blank(i, Math.min(j + 1, src.length)); i = j + 1; continue;
    }
    i++;
  }
  return out.join('');
}

// Default values in a parameter list (masked text between the parentheses at `open` and `close`): the ranges
// "= value" at the list's top level, as source offsets. A default may be given only once, so defaults move to
// the prototype and are blanked out of the definition.
function defaultRanges(m: string, open: number, close: number): [number, number][] {
  const out: [number, number][] = [];
  let depth = 0, eq = -1;
  for (let k = open + 1; k < close; k++) {
    const ch = m[k];
    if ('(<[{'.includes(ch)) depth++;
    else if (')>]}'.includes(ch)) depth--;
    else if (ch === '=' && depth === 0 && eq < 0) eq = k;
    else if (ch === ',' && depth === 0 && eq >= 0) { out.push([eq, k]); eq = -1; }
  }
  if (eq >= 0) out.push([eq, close]);
  return out;
}

// Offsets of the parameter list's parentheses in a definition header that ends just before `end` (its `{`).
function paramParens(m: string, from: number, end: number): [number, number] {
  let close = end - 1;
  while (close > from && m[close] !== ')') close--;
  let depth = 0;
  for (let k = close; k > from; k--) {
    if (m[k] === ')') depth++;
    else if (m[k] === '(' && --depth === 0) return [k, close];
  }
  return [from, close];
}

type Def = { name: string; prototype: string; line: number; start: number };

export function preprocessSketch(ino: string): { cpp: string; userLine(cppLine: number): number | null } {
  const src = ino.replace(/\r\n?/g, '\n');
  const m = mask(src);
  const chars = src.split(''); // the source, with definitions' default values blanked out
  const lineAt = (offset: number) => src.slice(0, offset).split('\n').length;

  const defs: Def[] = [];
  const declared = new Set<string>(['setup', 'loop']); // Arduino.h declares these
  let depth = 0, from = 0;
  for (let i = 0; i < m.length; i++) {
    const ch = m[i];
    if (ch === '{') {
      if (depth === 0) {
        const header = m.slice(from, i).replace(/\s+/g, ' ').trim();
        const d = header.match(DEFINITION);
        if (d && !NOT_A_FUNCTION.test(d[1]) && !NOT_A_FUNCTION.test(d[2])) {
          const start = from + (m.slice(from, i).length - m.slice(from, i).trimStart().length);
          const [open, close] = paramParens(m, from, i);
          const raw = src.slice(open + 1, close);
          const params = (raw.includes('//') ? d[3] : raw).replace(/\s+/g, ' ').trim(); // a // comment would swallow ");"
          for (const [a, b] of defaultRanges(m, open, close)) for (let k = a; k < b; k++) if (chars[k] !== '\n') chars[k] = ' ';
          defs.push({ name: d[2], line: lineAt(start), start, prototype: `${d[1].trim()} ${d[2]}(${params})${d[4] ? ' const' : ''};` });
        }
      }
      depth++;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) from = i + 1;
    } else if (ch === ';' && depth === 0) {
      const d = m.slice(from, i).replace(/\s+/g, ' ').trim().match(DEFINITION);
      if (d && !NOT_A_FUNCTION.test(d[1])) declared.add(d[2]);
      from = i + 1;
    }
  }

  const lines = chars.join('').split('\n');
  const head = ['#include <Arduino.h>', `#line 1 "${SKETCH_FILE}"`];
  const missing = defs.filter((d) => !declared.has(d.name));
  let body: string[];
  if (!missing.length) body = lines;
  else {
    const at = defs[0].line; // prototypes go right before the line of the first function definition
    const protos = missing.flatMap((d) => [`#line ${d.line} "${SKETCH_FILE}"`, d.prototype]);
    body = [...lines.slice(0, at - 1), ...protos, `#line ${at} "${SKETCH_FILE}"`, ...lines.slice(at - 1)];
  }
  const count = lines.length;
  return {
    cpp: [...head, ...body].join('\n'),
    userLine: (l) => (Number.isInteger(l) && l >= 1 && l <= count ? l : null),
  };
}
