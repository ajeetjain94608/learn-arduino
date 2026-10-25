import { afterEach, describe, expect, it, vi } from 'vitest';
import { TouchHold } from './touchHold';

describe('touch: a wire starts only after a still press-and-hold (quick drags orbit, two fingers pinch)', () => {
  afterEach(() => vi.useRealTimers());

  it('holding still for 300 ms starts the wire', () => {
    vi.useFakeTimers();
    const start = vi.fn();
    const h = new TouchHold(start);
    h.down(100, 100);
    h.move(103, 102); // a little wobble is fine
    vi.advanceTimersByTime(299);
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('moving away first means the finger is orbiting: no wire', () => {
    vi.useFakeTimers();
    const start = vi.fn();
    const h = new TouchHold(start);
    h.down(100, 100);
    h.move(120, 100);
    vi.advanceTimersByTime(500);
    expect(start).not.toHaveBeenCalled();
  });

  it('a second finger (pinch) or lifting early means no wire', () => {
    vi.useFakeTimers();
    const start = vi.fn();
    const a = new TouchHold(start); a.down(0, 0); a.second(); vi.advanceTimersByTime(500);
    const b = new TouchHold(start); b.down(0, 0); b.up(); vi.advanceTimersByTime(500);
    expect(start).not.toHaveBeenCalled();
  });
});
