// Intel HEX (what avr-objcopy -O ihex writes) → a 32 KB ATmega328P flash image.
export class HexError extends Error {}

export const FLASH_BYTES = 0x8000;

export function parseIntelHex(hex: string): Uint8Array {
  const flash = new Uint8Array(FLASH_BYTES);
  let base = 0;
  for (const [i, raw] of hex.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] !== ':' || line.length < 11 || line.length % 2 === 0) throw new HexError(`line ${i + 1}: not a HEX record`);
    const bytes = Uint8Array.from(line.slice(1).match(/../g)!, (b) => parseInt(b, 16));
    if (bytes.some(Number.isNaN)) throw new HexError(`line ${i + 1}: not hexadecimal`);
    if (bytes.reduce((s, b) => s + b, 0) & 0xff) throw new HexError(`line ${i + 1}: bad checksum`);
    const [len, hi, lo, type] = bytes;
    if (bytes.length !== len + 5) throw new HexError(`line ${i + 1}: wrong length`);
    const data = bytes.subarray(4, 4 + len);
    if (type === 0) {
      const at = base + ((hi << 8) | lo);
      if (at + len > FLASH_BYTES) throw new HexError(`line ${i + 1}: program does not fit in 32 KB`);
      flash.set(data, at);
    } else if (type === 1) break;
    else if (type === 2) base = ((data[0] << 8) | data[1]) << 4;
    else if (type === 4) base = ((data[0] << 8) | data[1]) << 16;
  }
  return flash;
}
