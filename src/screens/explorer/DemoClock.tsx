import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { isTestMode } from '../../three/shared/motion';
import { BOOT_S, bootLed } from './boardClock';
import { printsUpTo, printText, runStep, txBlink, UPLOAD_S, uploadLeds } from './programTimeline';

const HOLD_HIGH = isTestMode() && new URLSearchParams(location.search).has('hold'); // test aid

// TEMPORARY (Stage 1): plays the blink sketch on the demo board — upload (RX/TX flicker), reset/boot
// (L flashes), then setup() and loop() with the running line, pin 13, serial output and TX blinks.
// Stage 2 replaces this with the simulator runtime executing the code.
export function DemoClock() {
  const runT = useRef(0);    // seconds since the sketch started
  const phaseT = useRef(0);  // seconds into upload or boot
  const printed = useRef(0);
  const seenReset = useRef(useWorkbenchStore.getState().resetCount);
  const wasUploading = useRef(false);

  useEffect(() => {
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.store = () => useWorkbenchStore.getState();
  }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const s = useWorkbenchStore.getState();
    const restart = () => { runT.current = 0; printed.current = 0; };

    if (s.resetCount !== seenReset.current) { seenReset.current = s.resetCount; phaseT.current = 0; restart(); }
    if (s.uploading && !wasUploading.current) { phaseT.current = 0; restart(); }
    wasUploading.current = s.uploading;

    if (s.uploading) {
      phaseT.current += dt;
      const leds = uploadLeds(phaseT.current);
      if (leds.rx !== s.rxLed || leds.tx !== s.txLed) s.setSerialLeds(leds.rx, leds.tx);
      if (phaseT.current >= UPLOAD_S) { s.setUploading(false); s.setSerialLeds(false, false); }
      else s.setUploading(true, phaseT.current / UPLOAD_S);
      return;
    }
    if (s.booting) {
      phaseT.current += dt;
      const led = bootLed(phaseT.current);
      if (led !== s.bootLed) s.setBootLed(led);
      if (phaseT.current >= BOOT_S) s.setBooting(false);
      return;
    }
    if (!s.running) { restart(); return; }

    runT.current += dt;
    const step = runStep(runT.current);
    const high = HOLD_HIGH || step.pinHigh;
    if (high !== s.pinHigh) s.setPinHigh(high);
    if (step.line !== s.line) s.setLine(step.line);
    const n = printsUpTo(runT.current);
    if (n > printed.current) {
      s.appendSerial(Array.from({ length: n - printed.current }, (_, k) => printText(printed.current + k)));
      printed.current = n;
    }
    const tx = txBlink(runT.current);
    if (tx !== s.txLed) s.setSerialLeds(false, tx);
  });
  return null;
}
