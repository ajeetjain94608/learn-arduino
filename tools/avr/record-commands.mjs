// Records the exact cc1plus / as / ld argument lists that avr-g++ runs (via `-###`), so the WASM toolchain — which
// has no gcc driver — runs the same steps. Paths become placeholders: {SYSROOT} toolchain root, {CORE} Arduino core
// root, {IN} / {OUT} the step's input and output, {CORE_A} the precompiled core archive.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { CORE_DIR, CPP_FLAGS, GCC_DIR, INCLUDES, LINK_FLAGS, MCU, nativeTools, SKETCH_FLAGS } from './nativeToolchain.mjs';

const t = nativeTools();
const dir = mkdtempSync(join(tmpdir(), 'rq-cmd-'));
for (const f of ['IN.cpp', 'IN.o', 'core.a']) writeFileSync(join(dir, f), '');

// gcc -### prints each subcommand on stderr as a line starting with a space, arguments quoted or bare.
function subcommands(args) {
  const text = spawnSync(t.gpp, ['-###', ...args], { cwd: dir, encoding: 'utf8' }).stderr;
  return text.split(/\r?\n/).filter((l) => l.startsWith(' ')).map((l) =>
    [...l.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((m) => (m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2])));
}
let compile, link;
try {
  compile = subcommands([...CPP_FLAGS, ...SKETCH_FLAGS, ...MCU, ...INCLUDES, 'IN.cpp', '-o', 'OUT.o']);
  link = subcommands([...LINK_FLAGS, 'IN.o', 'core.a', '-lm', '-o', 'OUT.elf']);
} finally { rmSync(dir, { recursive: true, force: true }); }

// Normalise a path-ish string: forward slashes, `..` resolved, lower-case for matching on Windows.
const canon = (s) => posix.normalize(s.replace(/\\/g, '/'));
const key = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
const roots = [[canon(GCC_DIR), '{SYSROOT}'], [canon(CORE_DIR), '{CORE}']];
function generic(arg, extra) {
  let s = canon(arg);
  for (const [from, to] of [...extra, ...roots]) {
    const i = key(s).indexOf(key(from));
    if (i >= 0) s = s.slice(0, i) + to + s.slice(i + from.length);
  }
  return s;
}

const cc1 = compile.find((c) => /cc1plus(\.exe)?$/i.test(c[0]));
const as = compile.find((c) => /\/as(\.exe)?$/i.test(canon(c[0])));
const ld = link.find((c) => /(collect2|\/ld)(\.exe)?$/i.test(canon(c[0])));
if (!cc1 || !as || !ld) throw new Error(`could not find all steps:\n${JSON.stringify({ compile, link }, null, 1)}`);
const asm = canon(cc1[cc1.indexOf('-o') + 1]);

const out = {
  cc1plus: cc1.slice(1).map((a) => (canon(a) === asm ? '{OUT}' : a === 'IN.cpp' ? '{IN}' : generic(a, []))),
  as: as.slice(1).map((a) => (canon(a) === asm ? '{IN}' : a === 'OUT.o' ? '{OUT}' : generic(a, []))),
  // collect2 passes everything through to ld; plugin options belong to LTO, which the WASM build doesn't have
  ld: ld.slice(1).filter((a) => !/^-plugin|liblto_plugin|^-fresolution|^-plugin-opt/.test(a))
    .map((a) => (a === 'IN.o' ? '{IN}' : a === 'OUT.elf' ? '{OUT}' : a === 'core.a' ? '{CORE_A}' : generic(a, []))),
};
writeFileSync('src/build/compiler/commands.json', JSON.stringify(out, null, 2) + '\n');
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
