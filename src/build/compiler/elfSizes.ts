// Program size from a linked AVR ELF file (32-bit little-endian): flash = .text + .data (initial values are
// stored in flash), RAM = .data + .bss — what avr-size reports.
export function elfSizes(elf: Uint8Array): { flashBytes: number; ramBytes: number } {
  const v = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  if (v.getUint32(0) !== 0x7f454c46) throw new Error('not an ELF file');
  const shoff = v.getUint32(0x20, true), shentsize = v.getUint16(0x2e, true), shnum = v.getUint16(0x30, true), shstrndx = v.getUint16(0x32, true);
  const header = (i: number) => shoff + i * shentsize;
  const strtab = v.getUint32(header(shstrndx) + 16, true);
  const name = (off: number) => { let s = ''; for (let k = strtab + off; elf[k]; k++) s += String.fromCharCode(elf[k]); return s; };
  const size: Record<string, number> = {};
  for (let i = 0; i < shnum; i++) size[name(v.getUint32(header(i), true))] = v.getUint32(header(i) + 20, true);
  const [text, data, bss] = ['.text', '.data', '.bss'].map((s) => size[s] ?? 0);
  return { flashBytes: text + data, ramBytes: data + bss };
}
