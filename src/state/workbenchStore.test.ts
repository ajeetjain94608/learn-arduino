import { beforeEach, describe, expect, it } from 'vitest';
import { setCompiler } from '../build/compiler/compiler';
import type { CompileResult, Compiler } from '../build/compiler/types';
import { BLINK } from '../content/sketches/blink';
import { useWorkbenchStore } from './workbenchStore';

const s = () => useWorkbenchStore.getState();

describe('workbench store: program and serial', () => {
  beforeEach(() => { s().clearSerial(); s().setRunning(false); });

  it('starts with the shipped Blink program', () => {
    expect(s().program).toBe(BLINK.program);
  });

  it('serial text joins partial lines and drops carriage returns', () => {
    s().appendSerialText('LED o');
    s().appendSerialText('n\r\nLED off\r\nHI');
    expect(s().serial).toEqual(['LED on', 'LED off', 'HI']);
    s().appendSerialText('!\n');
    expect(s().serial).toEqual(['LED on', 'LED off', 'HI!']);
    s().appendSerialText('next\n');
    expect(s().serial.at(-1)).toBe('next');
  });

  it('keeps only the last 200 lines', () => {
    s().appendSerialText('x\n'.repeat(450));
    expect(s().serial).toHaveLength(200);
  });

  it('text sent to the board waits in a queue until the board takes it', () => {
    s().serialSend('hi');
    s().serialSend('there');
    expect(s().takeSerialInput()).toBe('hi\nthere\n');
    expect(s().takeSerialInput()).toBe('');
  });

  it('loadProgram runs another program: upload first', () => {
    const p = { ...BLINK.program, hex: ':00000001FF\n' };
    s().loadProgram(p);
    expect(s().program).toBe(p);
    expect(s().uploading).toBe(true);
    expect(s().running).toBe(true);
    s().loadProgram(BLINK.program);
  });
});

describe('workbench store: Run compiles changed code', () => {
  type Pending = { sketch: string; resolve(r: CompileResult): void };
  let pending: Pending[] = [];
  const fake: Compiler = { compile: (sketch) => new Promise((resolve) => pending.push({ sketch, resolve })) };
  const ok = (hex: string): CompileResult => ({ ok: true, program: { ...BLINK.program, hex }, diagnostics: [], ms: 5 });

  beforeEach(() => { pending = []; setCompiler(fake); s().setRunning(false); s().setCode(BLINK.code); s().loadProgram(BLINK.program); s().setRunning(false); });

  it('unchanged project code runs instantly without compiling', () => {
    s().upload();
    expect(pending).toHaveLength(0);
    expect(s().program).toBe(BLINK.program);
    expect(s().uploading).toBe(true);
  });

  it('changed code compiles first, then uploads the new program', async () => {
    s().setCode(BLINK.code.replace('delay(1000)', 'delay(200)'));
    s().upload();
    expect(s().compiling).toBe(true);
    expect(s().uploading).toBe(false);
    expect(pending[0].sketch).toContain('delay(200)');
    pending[0].resolve(ok(':NEW'));
    await Promise.resolve();
    expect(s().compiling).toBe(false);
    expect(s().program.hex).toBe(':NEW');
    expect(s().uploading).toBe(true);
  });

  it('errors are shown and nothing runs', async () => {
    s().setCode('void setup() {}');
    s().upload();
    const d = { line: 1, col: 1, severity: 'error' as const, message: 'boom' };
    pending[0].resolve({ ok: false, diagnostics: [d], ms: 5 });
    await Promise.resolve();
    expect(s().diagnostics).toEqual([d]);
    expect(s().running).toBe(false);
    expect(s().uploading).toBe(false);
  });

  it('stale compile results are ignored', async () => {
    s().setCode('void setup() {} void loop() {} // one');
    s().upload();
    s().setCode('void setup() {} void loop() {} // two');
    s().upload();
    pending[1].resolve(ok(':TWO'));
    await Promise.resolve();
    pending[0].resolve(ok(':ONE')); // the older compile finishes last
    await Promise.resolve();
    expect(s().program.hex).toBe(':TWO');
  });

  it('Stop during compile means nothing runs', async () => {
    s().setCode('void setup() {} void loop() {} // three');
    s().upload();
    s().setRunning(false);
    expect(s().compiling).toBe(false);
    pending[0].resolve(ok(':THREE'));
    await Promise.resolve();
    expect(s().running).toBe(false);
    expect(s().uploading).toBe(false);
    expect(s().program.hex).not.toBe(':THREE');
  });

  it('a compiler failure becomes an error message, not a crash', async () => {
    setCompiler({ compile: () => Promise.reject(new Error('toolchain missing')) });
    s().setCode('void setup() {} void loop() {} // four');
    s().upload();
    await new Promise((r) => setTimeout(r, 0));
    expect(s().compiling).toBe(false);
    expect(s().diagnostics[0]).toMatchObject({ severity: 'error', message: expect.stringContaining('toolchain missing') });
  });
});

describe('review fixes: store', () => {
  let pending: { resolve(r: CompileResult): void }[] = [];
  const cancels: number[] = [];
  const fake: Compiler = { compile: () => new Promise((resolve) => pending.push({ resolve })), cancel: () => { cancels.push(1); } };
  beforeEach(() => { setCompiler(fake); s().setRunning(false); s().clearSerial(); pending = []; cancels.length = 0; });

  it('running the unchanged project sketch during a compile ends that compile', async () => {
    s().setCode('void setup() {} void loop() {} // edited');
    s().upload();
    s().setCode(BLINK.code);
    s().upload(); // the learner undid the edit and pressed Run
    expect(s().compiling).toBe(false);
    pending[0].resolve({ ok: true, program: { ...BLINK.program, hex: ':OLD' }, diagnostics: [], ms: 1 });
    await Promise.resolve();
    expect(s().program).toBe(BLINK.program);
  });

  it('a new Run cancels the compile that is still going (one compile at a time)', () => {
    s().setCode('void setup() {} void loop() {} // a');
    s().upload();
    s().setCode('void setup() {} void loop() {} // b');
    s().upload();
    expect(cancels).toHaveLength(1);
  });

  it('Stop during a compile cancels it', () => {
    s().setCode('void setup() {} void loop() {} // c');
    s().upload();
    s().setRunning(false);
    expect(cancels).toHaveLength(1);
  });

  it('serial output without line endings is split so no line grows without limit', () => {
    for (let i = 0; i < 100; i++) s().appendSerialText('x'.repeat(100)); // 10 000 characters, no newline
    expect(s().serial.every((l) => l.length <= 1024)).toBe(true);
    expect(s().serial.join('').length).toBe(10_000);
  });
});
