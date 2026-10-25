import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BOOT_S, bootLed } from '../screens/explorer/boardClock';
import { UPLOAD_S, uploadLeds } from '../screens/explorer/programTimeline';
import { useWorkbenchStore } from '../state/workbenchStore';
import { isTestMode } from '../three/shared/motion';
import type { LineEntry, Program } from '../build/compiler/types';
import type { Burn, InputValues } from '../circuit/evaluate';
import type { CircuitSpec } from '../circuit/types';
import { circuitChanged, type CircuitSnapshot, type SimSnapshot } from './simEngine';
import type { SimCommand, SimMessage } from './sim.worker';
import { shownSpeed } from './simSpeed';

const TX_LIT_MS = 30;  // the TX LED stays visibly lit this long (sim time) after each byte
const RX_LIT_MS = 60;  // the RX LED blinks this long (real time) when text is sent to the board
// ?test&hold: stop the clock once pin 13 is HIGH and the line it prints is complete (deterministic screenshots)
const HOLD = isTestMode() && new URLSearchParams(location.search).has('hold');

// Test fixtures, loaded only when a test asks for one (debug.loadProgram).
const FIXTURE_HEX = import.meta.glob('./avr/fixtures/*.hex', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const FIXTURE_LINES = import.meta.glob('./avr/fixtures/*.lines.json', { import: 'default' }) as Record<string, () => Promise<LineEntry[]>>;

// Drives the simulated UNO each frame. The upload animation and the reset button's bootloader flashes play here;
// the compiled program itself runs on the simulated ATmega328P in its own worker (sim.worker.ts), whose latest
// snapshot — pins, running line, serial output — flows into the store that the 3D board and the panels read.
// Build passes the learner's circuit, input values and what is burnt (kept with the build: `onBurns` reports changes);
// Home passes nothing (the chip runs on its own). The circuit is live even with no program: the board has power.
type Props = { circuit?: CircuitSpec; inputs?: InputValues; burns?: Burn[]; onBurns?(burns: Burn[]): void };
const burnsKey = (b: Burn[]) => b.map((x) => `${x.id}:${x.reason}`).join();
export function SimClock({ circuit, inputs, burns, onBurns }: Props = {}) {
  const worker = useRef<Worker | null>(null);
  const gen = useRef(0);              // generation of the loaded program: older snapshots are ignored
  const loaded = useRef<Program | null>(null);
  const snap = useRef<SimSnapshot | null>(null);
  const serialIn = useRef('');        // printed text received since the last frame
  const phaseT = useRef(0);
  const seenReset = useRef(useWorkbenchStore.getState().resetCount);
  const wasUploading = useRef(false);
  const wasBooting = useRef(false);
  const rxUntil = useRef(0);
  const slowFor = useRef(0);
  const sentInputs = useRef<InputValues>({});
  const circuitSnap = useRef<{ circuit: CircuitSnapshot | null; replaced: number }>({ circuit: null, replaced: 0 });
  const replacesSent = useRef(0);     // until the worker has handled them all, its snapshots may show an old burn
  const burnsSent = useRef(false);
  const latest = useRef({ burns, onBurns });
  latest.current = { burns, onBurns };

  useEffect(() => {
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<SimMessage>) => {
      circuitSnap.current = { circuit: e.data.snap.circuit ?? null, replaced: e.data.snap.replaced }; // with or without a program
      if (e.data.gen !== gen.current) return;
      snap.current = e.data.snap;
      serialIn.current += e.data.snap.serial;
    };
    if (HOLD) w.postMessage({ t: 'hold', on: true } satisfies SimCommand);
    worker.current = w;
    return () => { w.terminate(); worker.current = null; loaded.current = null; snap.current = null; };
  }, []);

  // the circuit and the inputs follow the props (sent only when they change)
  useEffect(() => {
    worker.current?.postMessage({ t: 'circuit', spec: circuit ?? null } satisfies SimCommand);
    // the build's burns, once, after its first circuit (a circuit drops the burns of parts it doesn't have)
    if (!burnsSent.current && circuit && latest.current.burns) { burnsSent.current = true; worker.current?.postMessage({ t: 'burns', burns: latest.current.burns } satisfies SimCommand); }
  }, [circuit]);
  useEffect(() => {
    const w = worker.current;
    if (!w || !inputs) return;
    for (const [partId, values] of Object.entries(inputs)) for (const [key, value] of Object.entries(values)) {
      if (sentInputs.current[partId]?.[key] === value) continue;
      w.postMessage({ t: 'input', partId, key, value } satisfies SimCommand);
      (sentInputs.current[partId] ??= {})[key] = value;
    }
  }, [inputs]);
  const replaceRequest = useWorkbenchStore((s) => s.replaceRequest);
  useEffect(() => {
    if (!replaceRequest) return;
    replacesSent.current++;
    worker.current?.postMessage({ t: 'replace', id: replaceRequest.id } satisfies SimCommand);
  }, [replaceRequest]);
  useEffect(() => {
    if (!isTestMode()) return;
    const debug = (window.__rq ??= { debug: {} }).debug;
    debug.store = () => useWorkbenchStore.getState();
    debug.loadProgram = async (name: string) => {
      const hex = await FIXTURE_HEX[`./avr/fixtures/${name}.hex`]();
      const lines = await FIXTURE_LINES[`./avr/fixtures/${name}.lines.json`]();
      useWorkbenchStore.getState().loadProgram({ hex, lines, flashBytes: 0, ramBytes: 0 });
    };
  }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const s = useWorkbenchStore.getState();
    const w = worker.current;
    if (!w) return;
    const send = (c: SimCommand) => w.postMessage(c);
    // the circuit (lit parts, burns) — also while stopped; skipped until the worker has handled every replace
    const cs = circuitSnap.current;
    if (cs.replaced >= replacesSent.current) {
      if (circuitChanged(s.circuitState, cs.circuit)) s.setCircuitState(cs.circuit);
      const { burns: kept, onBurns: report } = latest.current;
      if (cs.circuit && kept && report && burnsKey(cs.circuit.burns) !== burnsKey(kept)) report(cs.circuit.burns);
    }
    const unload = () => { if (loaded.current) { send({ t: 'stop' }); loaded.current = null; snap.current = null; serialIn.current = ''; gen.current++; } };

    if (s.uploading && !wasUploading.current) { phaseT.current = 0; unload(); }
    wasUploading.current = s.uploading;
    if (s.resetCount !== seenReset.current) { seenReset.current = s.resetCount; phaseT.current = 0; send({ t: 'reset' }); serialIn.current = ''; }

    if (s.uploading) {
      phaseT.current += dt;
      const leds = uploadLeds(phaseT.current);
      if (leds.rx !== s.rxLed || leds.tx !== s.txLed) s.setSerialLeds(leds.rx, leds.tx);
      if (phaseT.current >= UPLOAD_S) { s.setUploading(false); s.setSerialLeds(false, false); }
      else s.setUploading(true, phaseT.current / UPLOAD_S);
      return;
    }
    if (s.booting) { // the reset button: the bootloader flashes the L LED, then the program starts over
      wasBooting.current = true;
      phaseT.current += dt;
      const led = bootLed(phaseT.current);
      if (led !== s.bootLed) s.setBootLed(led);
      if (s.pinHigh) s.setPinHigh(false);
      if (phaseT.current >= BOOT_S) s.setBooting(false);
      return;
    }
    if (wasBooting.current) { wasBooting.current = false; send({ t: 'resume' }); }
    if (!s.running) { unload(); return; }
    if (loaded.current !== s.program) {
      gen.current++;
      snap.current = null;
      serialIn.current = '';
      send({ t: 'load', gen: gen.current, hex: s.program.hex, lines: s.program.lines });
      loaded.current = s.program;
    }

    const input = s.takeSerialInput();
    if (input) { send({ t: 'serial', text: input }); rxUntil.current = performance.now() + RX_LIT_MS; }

    const chip = snap.current;
    if (!chip) return; // the first snapshot is on its way
    const slow = shownSpeed(slowFor.current, chip.speed, dt, false);
    slowFor.current = slow.slowFor;
    if (slow.shown !== s.simSpeed) s.setSimSpeed(slow.shown);
    if (chip.pin13 !== s.pinHigh) s.setPinHigh(chip.pin13);
    if (serialIn.current) { s.appendSerialText(serialIn.current); serialIn.current = ''; }
    const tx = chip.simMs - chip.lastTxSimMs < TX_LIT_MS, rx = performance.now() < rxUntil.current;
    if (tx !== s.txLed || rx !== s.rxLed) s.setSerialLeds(rx, tx);
    if (chip.line !== s.line) s.setLine(chip.line);
    if (chip.circuit?.board.shorted && s.running) s.setRunning(false); // a short stops the board
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.sim = { simMs: chip.simMs, pin13: chip.pin13, speed: chip.speed };
  });
  return null;
}
