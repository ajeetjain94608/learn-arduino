export const SLOW = 0.9;       // below this fraction of real time the board counts as slow…
export const SLOW_AFTER_S = 2; // …once it has been slow this long (a start-up stutter is not news)

// The speed shown to the learner: 1 (nothing to report) unless the board has run below SLOW for SLOW_AFTER_S;
// then the smoothed speed rounded to 0.05. A deliberate hold (tests) is not slowness.
export function shownSpeed(slowFor: number, speed: number, dt: number, holding: boolean): { slowFor: number; shown: number } {
  const next = !holding && speed < SLOW ? slowFor + dt : 0;
  return { slowFor: next, shown: next > SLOW_AFTER_S ? Math.round(speed * 20) / 20 : 1 };
}
