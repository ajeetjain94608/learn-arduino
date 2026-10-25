// Compiles every src/sim/avr/fixtures/*.ino with the native toolchain (npm run avr:fixtures) into
// <name>.hex (Intel HEX) and <name>.lines.json — the sketch's line table: [{ addr, line }], byte addresses,
// 1-based sketch lines, sorted by address. Fixtures are test programs for the simulated chip.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CPP_FLAGS, INCLUDES, LINK_FLAGS, MCU, nativeTools } from './nativeToolchain.mjs';

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
    execFileSync(t.gpp, [...CPP_FLAGS, ...MCU, ...INCLUDES, cpp, '-o', obj], { stdio: 'inherit' });
    execFileSync(t.gcc, [...LINK_FLAGS, obj, 'public/avr/uno/core.a', '-lm', '-o', elf], { stdio: 'inherit' });
    execFileSync(t.objcopy, ['-O', 'ihex', '-R', '.eeprom', elf, hex]);
    const decoded = execFileSync(t.objdump, ['--dwarf=decodedline', elf], { encoding: 'utf8', maxBuffer: 64 << 20 });
    return { hex: readFileSync(hex, 'utf8'), lines: sketchLines(decoded, `${name}.ino`) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// objdump --dwarf=decodedline rows: "<file>  <line>  0x<addr> …"; keep rows of the sketch file only.
export function sketchLines(decoded, file) {
  const seen = new Map();
  for (const row of decoded.split(/\r?\n/)) {
    const m = row.match(/^(\S+)\s+(\d+)\s+0x([0-9a-f]+)/i);
    if (!m || !m[1].endsWith(file)) continue;
    const addr = parseInt(m[3], 16), line = Number(m[2]);
    if (!seen.has(addr)) seen.set(addr, line);
  }
  return [...seen].map(([addr, line]) => ({ addr, line })).sort((a, b) => a.addr - b.addr);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('build-fixtures.mjs')) {
  for (const f of readdirSync(FIX).filter((x) => x.endsWith('.ino')).sort()) {
    const name = f.replace(/\.ino$/, '');
    const { hex, lines } = buildSketch(readFileSync(join(FIX, f), 'utf8'), name);
    writeFileSync(join(FIX, `${name}.hex`), hex);
    writeFileSync(join(FIX, `${name}.lines.json`), JSON.stringify(lines) + '\n');
    console.log(`${name}: ${lines.length} line entries`);
  }
}
