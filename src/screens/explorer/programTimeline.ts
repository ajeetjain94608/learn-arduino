// What the demo board is doing at each moment of the blink sketch (TEMPORARY until Stage 2's simulator).
// Lines refer to BLINK_SKETCH. Real instructions take microseconds; each gets a short visible moment
// so learners can follow along, while the two delay(1000) lines keep the LED's real 1 s on / 1 s off timing.

export const UPLOAD_S = 2.0; // "Uploading…": the sketch is sent over USB; RX/TX flicker
export const SETUP_S = 0.5;  // setup(): pinMode, Serial.begin
const STEP_S = 0.12;         // visible moment for a quick instruction

// RX/TX flicker while uploading (deterministic so it looks the same every time).
export function uploadLeds(t: number): { rx: boolean; tx: boolean } {
  if (t < 0 || t >= UPLOAD_S) return { rx: false, tx: false };
  return { rx: Math.floor(t * 18) % 2 === 0, tx: Math.floor(t * 23 + 1) % 3 === 0 };
}

// t: seconds since the sketch started (after upload or reset).
export function runStep(t: number): { line: number; pinHigh: boolean } {
  if (t < SETUP_S) return { line: t < SETUP_S / 2 ? 2 : 3, pinHigh: false };
  const c = (t - SETUP_S) % 2;
  if (c < 1) return { line: c < STEP_S ? 7 : c < 2 * STEP_S ? 8 : 9, pinHigh: true };
  const d = c - 1;
  return { line: d < STEP_S ? 10 : d < 2 * STEP_S ? 11 : 12, pinHigh: false };
}

// Serial.println happens at the start of each half-cycle's second step.
export function printsUpTo(t: number): number {
  const u = t - SETUP_S - STEP_S;
  return u < 0 ? 0 : Math.floor(u) + 1;
}
export const printText = (k: number) => (k % 2 === 0 ? 'LED on' : 'LED off');

// The TX LED blinks briefly each time something is printed.
export function txBlink(t: number): boolean {
  const u = t - SETUP_S - STEP_S;
  return u >= 0 && u % 1 < 0.06;
}
