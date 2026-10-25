// The number box's text → a value in range: junk or empty keeps the current value; out of range is clamped.
export function commitNumber(text: string, min: number, max: number, current: number): number {
  const s = text.trim();
  const v = s === '' ? NaN : Number(s);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : current;
}
