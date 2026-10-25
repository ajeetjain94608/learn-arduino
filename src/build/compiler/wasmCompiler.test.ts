import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLINK } from '../../content/sketches/blink';
import type { CompileResult } from './types';
import { createWorkerCompiler, type WorkerLike } from './wasmCompiler';

class FakeWorker implements WorkerLike {
  static made: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  posted: { id: number; sketch: string }[] = [];
  terminated = false;
  constructor() { FakeWorker.made.push(this); }
  postMessage(m: { id: number; sketch: string }) { this.posted.push(m); }
  terminate() { this.terminated = true; }
  answer(result: CompileResult) { const { id } = this.posted.at(-1)!; this.onmessage?.({ data: { id, result } } as MessageEvent); }
}
const ok: CompileResult = { ok: true, program: BLINK.program, diagnostics: [], ms: 1 };

describe('the worker-backed compiler', () => {
  afterEach(() => { FakeWorker.made = []; vi.useRealTimers(); });

  it("resolves with the worker's answer", async () => {
    const c = createWorkerCompiler(() => new FakeWorker());
    const p = c.compile('void setup(){} void loop(){}');
    FakeWorker.made[0].answer(ok);
    await expect(p).resolves.toBe(ok);
  });

  it('cancel stops the worker and rejects the compile; the next compile gets a fresh worker', async () => {
    const c = createWorkerCompiler(() => new FakeWorker());
    const p = c.compile('a');
    c.cancel!();
    await expect(p).rejects.toThrow(/stopped/i);
    expect(FakeWorker.made[0].terminated).toBe(true);
    const q = c.compile('b');
    expect(FakeWorker.made).toHaveLength(2);
    FakeWorker.made[1].answer(ok);
    await expect(q).resolves.toBe(ok);
  });

  it('a compile that never answers times out instead of hanging', async () => {
    vi.useFakeTimers();
    const c = createWorkerCompiler(() => new FakeWorker(), 5000);
    const p = c.compile('a');
    const caught = p.catch((e: Error) => e);
    vi.advanceTimersByTime(5001);
    expect(String(await caught)).toMatch(/too long/i);
    expect(FakeWorker.made[0].terminated).toBe(true);
  });

  it('a second compile replaces the first (never two at once)', async () => {
    const c = createWorkerCompiler(() => new FakeWorker());
    const p = c.compile('a').catch((e: Error) => e);
    c.compile('b');
    expect(String(await p)).toMatch(/stopped/i);
    expect(FakeWorker.made[0].terminated).toBe(true);
  });
});
