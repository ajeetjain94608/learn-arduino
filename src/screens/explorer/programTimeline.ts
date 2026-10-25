// The upload animation (Run): the sketch is sent over USB for a couple of seconds while RX and TX flicker.
export const UPLOAD_S = 2.0;

// RX/TX flicker while uploading (deterministic so it looks the same every time).
export function uploadLeds(t: number): { rx: boolean; tx: boolean } {
  if (t < 0 || t >= UPLOAD_S) return { rx: false, tx: false };
  return { rx: Math.floor(t * 18) % 2 === 0, tx: Math.floor(t * 23 + 1) % 3 === 0 };
}
