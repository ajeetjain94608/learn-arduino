// A stand-in for CanvasRenderingContext2D that records method calls, so drawing code
// can be tested in jsdom (which has no 2D canvas).
export type Call = { name: string; args: unknown[] };

export function recordingContext(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => { calls.push({ name: String(prop), args }); };
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
