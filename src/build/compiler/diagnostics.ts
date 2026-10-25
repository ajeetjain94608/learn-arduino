import { t, type StringKey } from '../../i18n/en';
import { SKETCH_FILE } from './preprocess';
import type { Diagnostic } from './types';

// "fatal error" is how GCC reports a missing #include file
const COMPILER_LINE = /^(.*?):(\d+):(\d+): (?:fatal )?(error|warning|note): (.*)$/;

// Plain-language hints for the mistakes beginners make most.
const HINTS: [RegExp, StringKey][] = [
  [/\.h: No such file or directory/, 'compile.hint.noLibrary'],
  [/expected ';' before/, 'compile.hint.semicolon'],
  [/was not declared in this scope/, 'compile.hint.undeclared'],
  [/expected '}' at end of input|a function-definition is not allowed here/, 'compile.hint.brace'],
];

// GCC/ld output → diagnostics on the learner's sketch. `userLine` maps the compiled file's line numbers to the
// sketch's (preprocessSketch). With the sketch `source`, a missing semicolon is pointed at the end of the line
// that lacks it (GCC reports the next statement).
export function parseDiagnostics(stderr: string, userLine: (l: number) => number | null, source?: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const srcLines = source?.replace(/\r\n?/g, '\n').split('\n');
  const linkError = (hint: StringKey, message: string) => { if (!out.some((d) => d.hint === t(hint))) out.push({ line: 1, col: 1, severity: 'error', message, hint: t(hint) }); };

  for (const raw of stderr.split(/\r?\n/)) {
    const m = raw.match(COMPILER_LINE);
    if (m) {
      const [, file, l, c, severity, message] = m;
      if (!file.endsWith(SKETCH_FILE)) continue; // inside a library header: the sketch line comes with it
      const line = userLine(Number(l));
      if (line === null) continue;
      if (severity === 'note') {
        const last = out.at(-1);
        if (last) (last.notes ??= []).push({ line, message });
        continue;
      }
      const d: Diagnostic = { line, col: Number(c), severity: severity as Diagnostic['severity'], message };
      const hint = HINTS.find(([re]) => re.test(message));
      if (hint) d.hint = t(hint[1]);
      if (srcLines && /expected ';' before/.test(message)) {
        let prev = line - 1; // the statement before the reported one is the one missing its ';'
        while (prev >= 1 && !srcLines[prev - 1]?.trim()) prev--;
        if (prev >= 1) { d.line = prev; d.col = srcLines[prev - 1].replace(/\s+$/, '').length + 1; }
      }
      out.push(d);
      continue;
    }
    const undef = raw.match(/undefined reference to `(\w+)'/);
    if (undef?.[1] === 'loop') linkError('compile.hint.noLoop', raw.slice(raw.indexOf('undefined reference')));
    else if (undef?.[1] === 'setup') linkError('compile.hint.noSetup', raw.slice(raw.indexOf('undefined reference')));
    else if (undef) out.push({ line: 1, col: 1, severity: 'error', message: `'${undef[1]}' is used but never defined` });
    else if (/region `text' overflowed/.test(raw)) linkError('compile.hint.tooBig', raw.slice(raw.indexOf('region')));
  }
  return out;
}
