import type { CPU } from 'avr8js';

// Timer compare outputs on the Uno: pin → timer control register A, compare register, COM bit shift.
// Timer 0 (pins 5, 6), timer 1 (9, 10; 16-bit compare register), timer 2 (3, 11).
const OUTPUTS: Record<number, { tccrA: number; ocr: number; wide?: boolean; com: number }> = {
  6: { tccrA: 0x44, ocr: 0x47, com: 6 }, 5: { tccrA: 0x44, ocr: 0x48, com: 4 },
  9: { tccrA: 0x80, ocr: 0x88, wide: true, com: 6 }, 10: { tccrA: 0x80, ocr: 0x8a, wide: true, com: 4 },
  11: { tccrA: 0xb0, ocr: 0xb3, com: 6 }, 3: { tccrA: 0xb0, ocr: 0xb4, com: 4 },
};

// Duty cycle 0–1 of the PWM wave on an Uno pin, or null when no timer output drives it. The Arduino core runs
// timer 0 in fast PWM (duty = (OCR+1)/256) and timers 1 and 2 in 8-bit phase-correct PWM (duty = OCR/255).
export function pwmDuty(cpu: CPU, pin: number): number | null {
  const o = OUTPUTS[pin];
  if (!o) return null;
  const tccrA = cpu.data[o.tccrA];
  const com = (tccrA >> o.com) & 3;
  if (com < 2) return null; // compare output disconnected: the pin is plain digital I/O
  const ocr = o.wide ? cpu.data[o.ocr] | (cpu.data[o.ocr + 1] << 8) : cpu.data[o.ocr];
  const fast = (tccrA & 3) === 3;
  const duty = Math.min(1, fast ? (ocr + 1) / 256 : ocr / 255);
  return com === 3 ? 1 - duty : duty;
}
