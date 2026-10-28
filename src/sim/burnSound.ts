import { useSound } from './buzzerSound';

// A short "zzt-pop" when something burns: a quick falling buzz and a crackle of noise, a fraction of a second, gentle.
// Only while Sound is on (it is off at first, like the buzzer), and only where the browser has audio.
let ctx: AudioContext | null = null;
export function playBurn(): void {
  if (!useSound.getState().on || typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime, out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.09, t0 + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    out.connect(ctx.destination);
    const buzz = ctx.createOscillator();                         // the "zzt": a sawtooth falling fast
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(1400, t0);
    buzz.frequency.exponentialRampToValueAtTime(90, t0 + 0.3);
    buzz.connect(out); buzz.start(t0); buzz.stop(t0 + 0.46);
    const len = Math.floor(ctx.sampleRate * 0.35), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.25 ? 1 : 0.15) * (1 - i / len); // crackle
    const crackle = ctx.createBufferSource(); crackle.buffer = buf;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    crackle.connect(g2); g2.connect(out); crackle.start(t0);
  } catch { /* no audio: no sound */ }
}
