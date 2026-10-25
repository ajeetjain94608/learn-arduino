// Precompiles the Arduino AVR core 1.8.7 for the Uno into public/avr/uno/core.a (npm run avr:core).
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { C_FLAGS, CORE_DIR, CPP_FLAGS, INCLUDES, MCU, nativeAvailable, nativeTools, S_FLAGS } from './nativeToolchain.mjs';

if (!nativeAvailable()) throw new Error('Native avr-gcc 7.3.0 / AVR core 1.8.7 not found (install the Arduino IDE or set AVR_GCC_DIR / AVR_CORE_DIR)');
const t = nativeTools();
const src = join(CORE_DIR, 'cores/arduino');
const out = 'public/avr/uno';
const tmp = mkdtempSync(join(tmpdir(), 'rq-core-'));
mkdirSync(out, { recursive: true });
rmSync(join(out, 'core.a'), { force: true });

const objects = [];
for (const f of readdirSync(src).sort()) {
  const ext = f.slice(f.lastIndexOf('.'));
  const flags = ext === '.c' ? C_FLAGS : ext === '.cpp' ? CPP_FLAGS : ext === '.S' ? S_FLAGS : null;
  if (!flags) continue;
  const obj = join(tmp, `${f}.o`);
  execFileSync(ext === '.cpp' ? t.gpp : t.gcc, [...flags, ...MCU, ...INCLUDES, join(src, f), '-o', obj], { stdio: 'inherit' });
  objects.push(obj);
}
// `avr-ar rcs` stores bare member names (main.cpp.o, wiring.c.o …)
execFileSync(t.ar, ['rcs', join(out, 'core.a'), ...objects], { stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });

mkdirSync(join(out, 'LICENSES'), { recursive: true });
for (const f of readdirSync('tools/avr/licenses')) copyFileSync(join('tools/avr/licenses', f), join(out, 'LICENSES', f));
console.log(`core.a: ${objects.length} objects`);
