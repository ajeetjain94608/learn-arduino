// Timing of the simulated board until Stage 2's simulator replaces it.

// After a reset the Uno runs its bootloader for a moment before the sketch starts.
export const BOOT_S = 0.8;

// The bootloader flashes the L LED three times quickly: on for 0.1 s at 0.1, 0.3 and 0.5 s.
export function bootLed(t: number): boolean {
  return t >= 0.1 && t < 0.6 && Math.floor((t - 0.1) / 0.1) % 2 === 0;
}

// The blink sketch: digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000);
export function blinkPin(t: number): boolean {
  return Math.floor(t) % 2 === 0;
}
