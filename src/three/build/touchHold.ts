export const HOLD_MS = 300; // press and hold this long, still, to start a wire with a finger
const SLOP_PX = 8;          // finger wobble allowed while holding

// On touch screens a quick drag must orbit the camera and two fingers must pinch, so a wire starts only after a
// still press-and-hold on a pin or hole. Moving away, a second finger, or lifting early cancels.
export class TouchHold {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private x = 0;
  private y = 0;
  constructor(private readonly onStart: () => void, private readonly holdMs = HOLD_MS) {}
  down(x: number, y: number) { this.x = x; this.y = y; this.cancel(); this.timer = setTimeout(() => { this.timer = null; this.onStart(); }, this.holdMs); }
  move(x: number, y: number) { if ((x - this.x) ** 2 + (y - this.y) ** 2 > SLOP_PX * SLOP_PX) this.cancel(); }
  second() { this.cancel(); }
  up() { this.cancel(); }
  get waiting() { return this.timer !== null; }
  private cancel() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
}
