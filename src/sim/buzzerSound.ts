import { useEffect } from 'react';
import { create } from 'zustand';
import { liveDevices } from './liveDevices';

// The just-enough part of Web Audio the buzzer uses (a fake stands in for it in tests).
type Param = { value: number; setTargetAtTime(v: number, at: number, tc: number): void };
export type AudioLike = {
  currentTime: number; state: string; destination: unknown; resume(): Promise<void>;
  createOscillator(): { type: string; frequency: Param; connect(n: unknown): void; start(): void };
  createGain(): { gain: Param; connect(n: unknown): void };
};

const VOLUME = 0.06; // a piezo is small: keep it gentle

// One square-wave voice playing whatever note the buzzer makes; made the first time there is a note to play.
export class ToneOut {
  private voice: { ctx: AudioLike; osc: ReturnType<AudioLike['createOscillator']>; gain: ReturnType<AudioLike['createGain']> } | null = null;
  constructor(private makeContext: () => AudioLike) {}
  play(hz: number) {
    if (!this.voice && hz <= 0) return;
    if (!this.voice) {
      const ctx = this.makeContext();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square';
      gain.gain.value = 0;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      this.voice = { ctx, osc, gain };
    }
    const { ctx, osc, gain } = this.voice;
    if (ctx.state === 'suspended') void ctx.resume();
    if (hz > 0) osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.002);
    gain.gain.setTargetAtTime(hz > 0 ? VOLUME : 0, ctx.currentTime, 0.008);
  }
}

// Sound on or off (off at first: no surprise noise in a classroom), remembered on the device.
const KEY = 'rq-sound';
const saved = (() => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } })();
export const useSound = create<{ on: boolean; toggle(): void }>((set, get) => ({
  on: saved,
  toggle: () => { const on = !get().on; set({ on }); try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* blocked */ } },
}));

// Plays the buzzers of the circuit while sound is on (the highest note if several sound at once).
export function BuzzerSound() {
  const on = useSound((s) => s.on);
  useEffect(() => {
    if (!on || typeof AudioContext === 'undefined') return;
    const out = new ToneOut(() => new AudioContext() as unknown as AudioLike);
    let raf = 0;
    const tick = () => {
      const hz = Math.max(0, ...Object.values(liveDevices.states).map((d) => d.hz ?? 0));
      out.play(hz);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); out.play(0); };
  }, [on]);
  return null;
}
