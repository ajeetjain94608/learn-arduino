import { afterEach, describe, expect, it, vi } from 'vitest';
import { playBurn } from './burnSound';
import { useSound } from './buzzerSound';

const node = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: '', buffer: null as unknown });
function fakeAudio() {
  const made = { oscillators: 0 };
  class Ctx {
    currentTime = 0; sampleRate = 8000; state = 'running'; destination = {};
    resume = vi.fn();
    createGain = () => node();
    createOscillator = () => { made.oscillators++; return node(); };
    createBuffer = (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) });
    createBufferSource = () => node();
  }
  vi.stubGlobal('AudioContext', Ctx);
  return made;
}

describe('the burn sound', () => {
  afterEach(() => { vi.unstubAllGlobals(); useSound.setState({ on: false }); });
  it('is silent while Sound is off', () => {
    const made = fakeAudio();
    useSound.setState({ on: false });
    playBurn();
    expect(made.oscillators).toBe(0);
  });
  it('plays a short buzz and crackle when Sound is on, and never throws without audio', () => {
    const made = fakeAudio();
    useSound.setState({ on: true });
    playBurn();
    expect(made.oscillators).toBe(1);
    vi.unstubAllGlobals();
    expect(() => playBurn()).not.toThrow();
  });
});
