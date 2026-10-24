import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorkbenchStore } from '../../state/workbenchStore';

const HOLD_HIGH = typeof location !== 'undefined' && new URLSearchParams(location.search).has('hold'); // test aid

// TEMPORARY (Stage 1): the blink sketch's timing — pin 13 HIGH 1 s, LOW 1 s while running.
// Stage 2 replaces this with the simulator runtime.
export function DemoClock() {
  const simT = useRef(0);
  useFrame((_, dt) => {
    const s = useWorkbenchStore.getState();
    if (!s.running) { simT.current = 0; return; }
    simT.current += Math.min(dt, 0.1);
    const high = HOLD_HIGH || Math.floor(simT.current) % 2 === 0;
    if (high !== s.pinHigh) s.setPinHigh(high);
  });
  return null;
}
