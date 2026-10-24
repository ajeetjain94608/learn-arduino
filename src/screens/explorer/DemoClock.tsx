import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { isTestMode } from '../../three/shared/motion';
import { blinkPin, BOOT_S, bootLed } from './boardClock';

const HOLD_HIGH = isTestMode() && new URLSearchParams(location.search).has('hold'); // test aid

// TEMPORARY (Stage 1): drives pin 13 with the blink sketch's timing and plays the reset/boot sequence.
// Stage 2 replaces this with the simulator runtime.
export function DemoClock() {
  const simT = useRef(0);
  const bootT = useRef(0);
  const seenReset = useRef(useWorkbenchStore.getState().resetCount);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const s = useWorkbenchStore.getState();

    if (s.resetCount !== seenReset.current) { // reset button pressed: reboot, program starts over
      seenReset.current = s.resetCount;
      bootT.current = 0;
      simT.current = 0;
    }
    if (s.booting) {
      bootT.current += dt;
      const led = bootLed(bootT.current);
      if (led !== s.bootLed) s.setBootLed(led);
      if (bootT.current >= BOOT_S) s.setBooting(false);
      return;
    }

    if (!s.running) { simT.current = 0; return; }
    simT.current += dt;
    const high = HOLD_HIGH || blinkPin(simT.current);
    if (high !== s.pinHigh) s.setPinHigh(high);
  });
  return null;
}
