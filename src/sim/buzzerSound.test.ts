import { describe, expect, it } from 'vitest';
import { ToneOut, type AudioLike } from './buzzerSound';

// a stand-in for Web Audio that records what was asked of it
function fakeAudio() {
  const log: string[] = [];
  const param = (name: string) => ({ value: 0, setTargetAtTime(v: number) { log.push(`${name}→${v}`); this.value = v; } });
  const osc = { type: '', frequency: param('freq'), connect() {}, start() { log.push('start'); } };
  const gain = { gain: param('gain'), connect() {} };
  const ctx: AudioLike = { currentTime: 0, state: 'running', destination: {}, resume: async () => {}, createOscillator: () => osc, createGain: () => gain };
  return { ctx, log, osc, gain };
}

describe('the buzzer sound', () => {
  it('plays the note the buzzer is making, and goes quiet when it stops', () => {
    const a = fakeAudio();
    const out = new ToneOut(() => a.ctx);
    out.play(440);
    expect(a.osc.type).toBe('square');            // a piezo sounds like a square wave
    expect(a.osc.frequency.value).toBe(440);
    expect(a.gain.gain.value).toBeGreaterThan(0);
    out.play(0);
    expect(a.gain.gain.value).toBe(0);
    expect(a.log.filter((x) => x === 'start')).toHaveLength(1); // one oscillator, reused
  });
  it('makes no sound object until there is something to play', () => {
    let made = 0;
    const out = new ToneOut(() => { made++; return fakeAudio().ctx; });
    out.play(0);
    expect(made).toBe(0);
  });
});
