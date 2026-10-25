/// <reference lib="webworker" />
import type { LineEntry } from '../build/compiler/types';
import type { Burn } from '../circuit/evaluate';
import type { CircuitSpec } from '../circuit/types';
import { parseIntelHex } from './avr/hex';
import { SimEngine, type SimSnapshot } from './simEngine';

// The simulated chip's own thread: SimEngine runs non-stop here (a whole CPU core, unlike the page's frame budget)
// and a snapshot goes to the page about 60 times a second.
export type SimCommand =
  | { t: 'load'; gen: number; hex: string; lines: LineEntry[] }
  | { t: 'reset' } | { t: 'resume' } | { t: 'stop' }
  | { t: 'serial'; text: string }
  | { t: 'hold'; on: boolean }
  | { t: 'circuit'; spec: CircuitSpec | null }
  | { t: 'input'; partId: string; key: string; value: number }
  | { t: 'replace'; id: string }
  | { t: 'burns'; burns: Burn[] };
export type SimMessage = { gen: number; snap: SimSnapshot };

const engine = new SimEngine();
let gen = 0;
let lastPost = 0;
let scheduled = false;
const channel = new MessageChannel(); // an immediate "next turn" that still lets incoming commands run first
channel.port1.onmessage = () => loop();

function schedule(waitMs: number) {
  if (scheduled) return;
  scheduled = true;
  if (waitMs <= 0) channel.port2.postMessage(0);
  else setTimeout(() => { scheduled = false; loop(); }, waitMs);
}

function loop() {
  scheduled = false;
  const until = performance.now() + 14;
  let wait = 0;
  while (performance.now() < until) { wait = engine.step(performance.now(), 12); if (wait > 0) break; }
  const now = performance.now();
  if (now - lastPost >= 15) { lastPost = now; self.postMessage({ gen, snap: engine.snapshot() } satisfies SimMessage); }
  schedule(wait);
}

self.onmessage = (e: MessageEvent<SimCommand>) => {
  const m = e.data;
  if (m.t === 'load') { gen = m.gen; engine.load(parseIntelHex(m.hex), m.lines, performance.now()); }
  else if (m.t === 'reset') engine.reset();
  else if (m.t === 'resume') engine.resume(performance.now());
  else if (m.t === 'stop') engine.stop();
  else if (m.t === 'serial') engine.serialWrite(m.text);
  else if (m.t === 'hold') engine.setHold(m.on);
  else if (m.t === 'circuit') engine.setCircuit(m.spec);
  else if (m.t === 'input') engine.setInput(m.partId, m.key, m.value);
  else if (m.t === 'replace') engine.replace(m.id);
  else if (m.t === 'burns') engine.setBurns(m.burns);
  if (m.t === 'stop') self.postMessage({ gen, snap: engine.snapshot() } satisfies SimMessage);
  schedule(0);
};
