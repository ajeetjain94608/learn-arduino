// How far a part rises (mm) and grows when it is hovered or selected — like lifting it off the board to look at it.
export const LIFT = {
  hover: { y: 2.5, scale: 1.06 },
  selected: { y: 2.5, scale: 1.06 },
  idle: { y: 0, scale: 1 },
} as const;

// Exponential ease toward a target; frame-rate independent and never overshoots.
export function approach(current: number, target: number, dt: number, rate = 14): number {
  return current + (target - current) * Math.min(1, dt * rate);
}
