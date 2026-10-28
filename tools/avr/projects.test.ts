// @vitest-environment node
// Every ready-made project: its build is one a learner could make (the store accepts every part and wire), its code
// compiles, and running it in the simulator does what the project says.
import { describe, expect, it } from 'vitest';
import { compileSketch } from '../../src/build/compiler/pipeline';
import { checkWiring } from '../../src/circuit/check';
import { usesBreadboard } from '../../src/circuit/parts';
import { PROJECTS } from '../../src/content/projects';
import type { Project } from '../../src/content/projects/types';
import { parseIntelHex } from '../../src/sim/avr/hex';
import { SimEngine } from '../../src/sim/simEngine';
import { createBuildStore } from '../../src/state/buildStore';
import { nativeEnv } from './nativeEnv';
import { nativeAvailable } from './nativeToolchain.mjs';

class MemoryStorage { data = new Map<string, string>(); getItem(k: string) { return this.data.get(k) ?? null; } setItem(k: string, v: string) { this.data.set(k, v); } removeItem(k: string) { this.data.delete(k); } }

// Build the project the way a learner would: add each part, move it into place, set it up, then wire it.
function replay(p: Project) {
  const s = createBuildStore(new MemoryStorage() as unknown as Storage).getState;
  if (usesBreadboard(p.build.parts, p.build.wires)) expect(s().addPart('breadboard'), `${p.id}: add the breadboard`).toBe('bb');
  for (const part of p.build.parts) {
    const id = s().addPart(part.type);
    expect(id, `${p.id}: add ${part.id}`).toBe(part.id);
    expect(s().movePart(part.id, part.at), `${p.id}: ${part.id} fits at ${JSON.stringify(part.at)} (${s().message})`).toBe(true);
    for (const [k, v] of Object.entries(part.params)) s().setParam(part.id, k, v);
  }
  for (const w of p.build.wires) expect(s().addWire(w.from, w.to, w.color), `${p.id}: wire ${w.from} → ${w.to} (${s().message})`).toBeTruthy();
  return s();
}

describe('every project can be built by hand', () => {
  for (const p of PROJECTS) it(p.id, () => {
    const s = replay(p);
    expect(s.parts.length).toBe(p.build.parts.length + (usesBreadboard(p.build.parts, p.build.wires) ? 1 : 0)); // (+ the breadboard)
    expect(checkWiring({ parts: s.parts, wires: s.wires }), `${p.id}: no dangerous wiring`).toEqual([]);
  });
  it('there are 16, with unique ids', () => {
    expect(PROJECTS).toHaveLength(16);
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(16);
  });
});

type Run = { e: SimEngine; at: number; play(ms: number): void; serial(): string };
async function start(id: string): Promise<Run> {
  const p = PROJECTS.find((x) => x.id === id)!;
  const r = await compileSketch(p.build.code, nativeEnv);
  expect(r.diagnostics.filter((d) => d.severity === 'error'), id).toEqual([]);
  if (!r.ok) throw new Error(`${id} did not compile`);
  const e = new SimEngine();
  e.setCircuit({ parts: p.build.parts, wires: p.build.wires });
  for (const [part, values] of Object.entries(p.build.inputs ?? {})) for (const [k, v] of Object.entries(values)) e.setInput(part, k, v);
  e.load(parseIntelHex(r.program.hex), r.program.lines, 0);
  let out = '';
  const run: Run = {
    e, at: 0,
    play(ms) { for (const end = run.at + ms; run.at < end; run.at += 16) e.step(run.at, 1e9); out += e.snapshot().serial; },
    serial: () => out,
  };
  return run;
}
const circuit = (r: Run) => r.e.snapshot().circuit!.parts;
const devices = (r: Run) => r.e.snapshot().devices!;

describe.skipIf(!nativeAvailable())('every project runs and does what it says', { timeout: 120_000 }, () => {
  it('board: says hello and counts blinks', async () => {
    const r = await start('board'); r.play(1200);
    expect(r.serial()).toContain('Hello from the UNO!');
    expect(r.serial()).toContain('Blinks: 1');
  });
  it('blink: the LED lights', async () => {
    const r = await start('blink'); r.play(300);
    expect(circuit(r).led1.brightness).toBeGreaterThan(0.3);
  });
  it('button: pressing lights the LED', async () => {
    const r = await start('button'); r.play(100);
    expect(r.e.snapshot().pin13).toBe(false);
    r.e.setInput('button1', 'pressed', 1); r.play(100);
    expect(r.e.snapshot().pin13).toBe(true);
    expect(r.serial()).toContain('pressed');
  });
  it('knob: full turn reads 1023 and lights the LED fully', async () => {
    const r = await start('knob');
    r.e.setInput('pot1', 'position', 1); r.play(400);
    expect(r.serial()).toContain('knob 1023');
    expect(circuit(r).led1.brightness).toBeGreaterThan(0.5);
  });
  it('rgb: starts red, then orange', async () => {
    const r = await start('rgb'); r.play(300);
    const [red, green, blue] = circuit(r).rgb1.rgb!;
    expect(red).toBeGreaterThan(0.5); expect(green).toBe(0); expect(blue).toBe(0);
    r.play(800);
    expect(r.serial()).toContain('orange');
  });
  it('night light: dark turns the LED on, bright light turns it off', async () => {
    const r = await start('night-light');
    r.e.setInput('ldr1', 'lux', 1); r.play(500);
    expect(circuit(r).led1.brightness).toBeGreaterThan(0.2);
    r.e.setInput('ldr1', 'lux', 900); r.play(500);
    expect(circuit(r).led1.brightness).toBe(0);
  });
  it('distance: prints 30 cm', async () => {
    const r = await start('distance'); r.play(500);
    expect(r.serial()).toMatch(/(29|30|31) cm/);
  });
  it('tune: the buzzer plays E (330 Hz) first', async () => {
    const r = await start('tune'); r.play(150);
    expect(Math.abs(devices(r).buzzer1.hz! - 330)).toBeLessThan(4);
  });
  it('piano: the third key plays Mi', async () => {
    const r = await start('piano');
    r.e.setInput('button3', 'pressed', 1); r.play(200);
    expect(Math.abs(devices(r).buzzer1.hz! - 330)).toBeLessThan(4);
    expect(r.serial()).toContain('Mi');
    r.e.setInput('button3', 'pressed', 0); r.play(200);
    expect(devices(r).buzzer1.hz).toBe(0);
  });
  it('motor: the fan speeds up', async () => {
    const r = await start('motor'); r.play(2000);
    expect(circuit(r).motor1.speed).toBeGreaterThan(0.5);
  });
  it('thermostat: 35 °C turns the fan on', async () => {
    const r = await start('thermostat');
    r.e.setInput('tmp361', 'celsius', 35); r.play(800);
    expect(r.serial()).toContain('fan ON');
    expect(circuit(r).motor1.speed).toBeGreaterThan(0.5);
  });
  it('servo: sweeps from 0 towards 180', async () => {
    const r = await start('servo'); r.play(1000);
    expect(devices(r).servo1.angle).toBeGreaterThan(100);
  });
  it('wheel: a press spins more than a whole turn and lands on a prize', async () => {
    const r = await start('wheel');
    r.e.setInput('button1', 'pressed', 1); r.play(300);
    r.e.setInput('button1', 'pressed', 0); r.play(14000);
    expect(devices(r).stepper1.steps!).toBeGreaterThan(2048);
    expect(r.serial()).toContain('Landed on');
  });
  it('plant: 25 % moisture — the screen shows it', async () => {
    const r = await start('plant'); r.play(1500);
    expect(r.serial()).toMatch(/2[3-7]/);
    expect(devices(r).oled1.frame!.some((b) => b !== 0)).toBe(true);
    expect(devices(r).oled1.on).toBe(true);
  });
  it('strength: a 1 kg press swings the needle up and rings the bell', async () => {
    const r = await start('strength');
    r.e.setInput('fsr1', 'grams', 1000); r.play(800);
    expect(devices(r).servo1.angle).toBeGreaterThan(150);
    expect(r.serial()).toContain('DING!');
  });
  it('parking: far is green, near is red', async () => {
    const r = await start('parking'); r.play(400);
    expect(circuit(r).traffic1.lights!.G).toBeGreaterThan(0.3);
    r.e.setInput('hcsr041', 'cm', 10); r.play(400);
    expect(circuit(r).traffic1.lights!.R).toBeGreaterThan(0.3);
    expect(circuit(r).traffic1.lights!.G).toBe(0);
  });
});
