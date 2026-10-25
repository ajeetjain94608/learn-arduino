// Uno pin numbers (0–13 digital, 14–19 = A0–A5) → ATmega328P port and bit.
export type Port = 'B' | 'C' | 'D';

export function unoPin(n: number): { port: Port; bit: number } {
  if (!Number.isInteger(n) || n < 0 || n > 19) throw new RangeError(`no Uno pin ${n}`);
  if (n < 8) return { port: 'D', bit: n };
  if (n < 14) return { port: 'B', bit: n - 8 };
  return { port: 'C', bit: n - 14 };
}
