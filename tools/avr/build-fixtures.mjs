// Compiles every src/sim/avr/fixtures/*.ino with the native toolchain (npm run avr:fixtures) into
// <name>.hex (Intel HEX) and <name>.lines.json — the line table: [{ addr, line }], byte addresses sorted, line =
// 1-based sketch line or 0 for code that is not the sketch's (see sketchLines). Fixtures are test programs for the simulated chip.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CORE_DIR, CPP_FLAGS, INCLUDES, LINK_FLAGS, MCU, nativeTools, SKETCH_FLAGS } from './nativeToolchain.mjs';

const t = nativeTools();
const FIX = 'src/sim/avr/fixtures';

// Minimal .ino → .cpp for fixtures (the app's real preprocessor arrives with the compiler); `#line 1` keeps
// the sketch's own line numbers in the debug info.
const toCpp = (ino, name) => `#include <Arduino.h>\n#line 1 "${name}.ino"\n${ino}`;

export function buildSketch(ino, name) {
  const dir = mkdtempSync(join(tmpdir(), 'rq-fix-'));
  try {
    const cpp = join(dir, `${name}.cpp`), obj = join(dir, `${name}.o`), elf = join(dir, `${name}.elf`), hex = join(dir, `${name}.hex`);
    writeFileSync(cpp, toCpp(ino, name));
    execFileSync(t.gpp, [...CPP_FLAGS, ...SKETCH_FLAGS, ...MCU, ...INCLUDES, cpp, '-o', obj], { stdio: 'inherit' });
    execFileSync(t.gcc, [...LINK_FLAGS, obj, 'public/avr/uno/core.a', '-lm', '-o', elf], { stdio: 'inherit' });
    execFileSync(t.objcopy, ['-O', 'ihex', '-R', '.eeprom', elf, hex]);
    const decoded = execFileSync(t.objdump, ['--dwarf=decodedline', elf], { encoding: 'utf8', maxBuffer: 64 << 20 });
    return { hex: readFileSync(hex, 'utf8'), lines: sketchLines(decoded, `${name}.ino`) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// objdump --dwarf=decodedline rows: "<file>  <line>  0x<addr> …". Every row is kept as an address → line entry:
// the sketch's own rows give their line, rows of any other file (core, inlined headers) give 0 = "not the sketch",
// so a lookup (greatest addr ≤ pc) also says whether the program is in the learner's code. When several rows share
// an address the last one is the statement that runs there. Consecutive entries with the same line are merged.
export function sketchLines(decoded, file) {
  const at = new Map();
  for (const row of decoded.split(/\r?\n/)) {
    const m = row.match(/^(\S+)\s+(\d+)\s+0x([0-9a-f]+)/i);
    if (!m) continue;
    at.set(parseInt(m[3], 16), m[1].endsWith(file) ? Number(m[2]) : 0);
  }
  const out = [];
  for (const [addr, line] of [...at].sort((x, y) => x[0] - y[0])) if (out.at(-1)?.line !== line) out.push({ addr, line });
  return out;
}

if (!process.argv.includes("--diagnostics") && process.argv[1]?.endsWith("build-fixtures.mjs")) {
  for (const f of readdirSync(FIX).filter((x) => x.endsWith('.ino')).sort()) {
    const name = f.replace(/\.ino$/, '');
    const { hex, lines } = buildSketch(readFileSync(join(FIX, f), 'utf8'), name);
    writeFileSync(join(FIX, `${name}.hex`), hex);
    writeFileSync(join(FIX, `${name}.lines.json`), JSON.stringify(lines) + '\n');
    console.log(`${name}: ${lines.length} line entries`);
  }
}

// --diagnostics: real compiler/linker error output for the diagnostics parser's tests
// (node --experimental-strip-types tools/avr/build-fixtures.mjs --diagnostics).
export const DIAGNOSTIC_CASES = {
  semicolon: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH)\n  delay(1000);\n}\n',
  undeclared: 'void setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n}\n',
  brace: 'void setup() {\n  pinMode(13, OUTPUT);\n\nvoid loop() {\n  delay(10);\n}\n',
  noloop: 'void setup() {\n  pinMode(13, OUTPUT);\n}\n',
  warning: 'void setup() {\n  byte b = 300;\n  Serial.begin(9600);\n  Serial.println(b);\n}\n\nvoid loop() {\n}\n',
  note: 'void blinkTimes(int n) {\n  delay(n);\n}\n\nvoid setup() {\n  blinkTimes();\n}\n\nvoid loop() {\n}\n',
};
if (process.argv.includes('--diagnostics')) {
  const { preprocessSketch } = await import('../../src/build/compiler/preprocess.ts');
  const out = 'src/build/compiler/fixtures';
  const { mkdirSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  mkdirSync(out, { recursive: true });
  for (const [name, ino] of Object.entries(DIAGNOSTIC_CASES)) {
    const dir = mkdtempSync(join(tmpdir(), 'rq-diag-'));
    try {
      const cpp = join(dir, 'sketch.cpp'), obj = join(dir, 'sketch.o');
      writeFileSync(cpp, preprocessSketch(ino).cpp);
      let r = spawnSync(t.gpp, [...CPP_FLAGS, ...SKETCH_FLAGS, ...MCU, ...INCLUDES, cpp, '-o', obj], { encoding: 'utf8', cwd: dir });
      let text = r.stderr;
      if (r.status === 0) text += spawnSync(t.gcc, [...LINK_FLAGS, obj, join(process.cwd(), 'public/avr/uno/core.a'), '-lm', '-o', join(dir, 'sketch.elf')], { encoding: 'utf8', cwd: dir }).stderr;
      // machine-specific paths → stable placeholders
      for (const [path, name] of [[dir, '{TMP}'], [process.cwd(), '{PROJECT}'], [CORE_DIR, '{CORE}']]) text = text.split(path).join(name).split(path.replace(/\\/g, '/')).join(name);
      writeFileSync(join(out, `${name}.txt`), text);
      console.log(`${name}: ${text.split('\n').length} lines`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
}
