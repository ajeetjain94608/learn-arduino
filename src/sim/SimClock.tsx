import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BOOT_S, bootLed } from '../screens/explorer/boardClock';
import { UPLOAD_S, uploadLeds } from '../screens/explorer/programTimeline';
import { useWorkbenchStore } from '../state/workbenchStore';
import { isTestMode } from '../three/shared/motion';
import type { LineEntry, Program } from '../build/compiler/types';
import { AvrRunner } from './avr/AvrRunner';
import { parseIntelHex } from './avr/hex';
import { currentLine } from './avr/sourceLine';
import { shownSpeed } from './simSpeed';

const TX_LIT_MS = 30;  // the TX LED stays visibly lit this long (sim time) after each byte
const RX_LIT_MS = 60;  // the RX LED blinks this long (real time) when text is sent to the board
const BUDGET_MS = 8;   // wall time per frame the chip may use, so the page stays smooth
// ?test&hold: stop the clock once pin 13 is HIGH and the line it prints is complete (deterministic screenshots)
const HOLD = isTestMode() && new URLSearchParams(location.search).has('hold');

// Test fixtures, loaded only when a test asks for one (debug.loadProgram).
const FIXTURE_HEX = import.meta.glob('./avr/fixtures/*.hex', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const FIXTURE_LINES = import.meta.glob('./avr/fixtures/*.lines.json', { import: 'default' }) as Record<string, () => Promise<LineEntry[]>>;

// Drives the simulated UNO each frame: the upload animation, then the real compiled program on the simulated
// ATmega328P (avr8js). Its pins, serial output and running line flow into the store, which the 3D board,
// the status pill, the code card and the serial monitor read.
export function SimClock() {
  const runner = useRef<{ program: Program; chip: AvrRunner } | null>(null);
  const phaseT = useRef(0);
  const seenReset = useRef(useWorkbenchStore.getState().resetCount);
  const wasUploading = useRef(false);
  const rxUntil = useRef(0);
  const speed = useRef(1);
  const slowFor = useRef(0);

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

    if (s.uploading && !wasUploading.current) { phaseT.current = 0; runner.current = null; }
    wasUploading.current = s.uploading;
    if (s.resetCount !== seenReset.current) { seenReset.current = s.resetCount; phaseT.current = 0; runner.current?.chip.reset(); }

    if (s.uploading) {
      phaseT.current += dt;
      const leds = uploadLeds(phaseT.current);
      if (leds.rx !== s.rxLed || leds.tx !== s.txLed) s.setSerialLeds(leds.rx, leds.tx);
      if (phaseT.current >= UPLOAD_S) { s.setUploading(false); s.setSerialLeds(false, false); }
      else s.setUploading(true, phaseT.current / UPLOAD_S);
      return;
    }
    if (s.booting) { // the reset button: the bootloader flashes the L LED, then the program starts over
      phaseT.current += dt;
      const led = bootLed(phaseT.current);
      if (led !== s.bootLed) s.setBootLed(led);
      if (s.pinHigh) s.setPinHigh(false);
      if (phaseT.current >= BOOT_S) s.setBooting(false);
      return;
    }
    if (!s.running) { runner.current = null; return; }
    if (runner.current?.program !== s.program) runner.current = { program: s.program, chip: new AvrRunner(parseIntelHex(s.program.hex)) };
    const chip = runner.current.chip;

    const input = s.takeSerialInput();
    if (input) { chip.serialWrite(input); rxUntil.current = performance.now() + RX_LIT_MS; }

    const holding = HOLD && chip.pin(13).high && s.serial.length > 0 && !s.serialOpen;
    if (!holding) {
      const advanced = chip.runFor(dt * 1000, BUDGET_MS);
      speed.current += ((dt > 0 ? advanced / (dt * 1000) : 1) - speed.current) * 0.1;
    }
    const slow = shownSpeed(slowFor.current, speed.current, dt, holding);
    slowFor.current = slow.slowFor;
    if (slow.shown !== s.simSpeed) s.setSimSpeed(slow.shown);

    const high = chip.pin(13).high;
    if (high !== s.pinHigh) s.setPinHigh(high);
    const out = chip.takeSerial();
    if (out) s.appendSerialText(out);
    const tx = chip.simMs - chip.lastTxSimMs < TX_LIT_MS, rx = performance.now() < rxUntil.current;
    if (tx !== s.txLed || rx !== s.rxLed) s.setSerialLeds(rx, tx);
    const line = currentLine(chip.pc, chip.returnAddresses(), s.program.lines);
    if (line !== s.line) s.setLine(line);
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.sim = { simMs: chip.simMs, pin13: high, speed: speed.current };
  });
  return null;
}
