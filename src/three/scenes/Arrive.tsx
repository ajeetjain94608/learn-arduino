import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { ASSEMBLY, BREADBOARD_SLIDE_MM, DROP_MM, dropOffset, easeOutCubic, slotProgress, useAssemblyClock, type AssemblyStep } from './assembly';

// Moves its children in during the circuit build: slides in from the right, or drops into place from above.
// An inner group, so the inspect pivot around it (which owns its own lift) is left alone.
export function Arrive({ step, from, children }: { step: AssemblyStep; from: 'right' | 'above'; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const clock = useAssemblyClock();
  useFrame(() => {
    const g = ref.current; if (!g) return;
    const p = slotProgress(clock.t, ASSEMBLY[step]);
    if (from === 'right') g.position.x = BREADBOARD_SLIDE_MM * (1 - easeOutCubic(p));
    else { g.position.y = DROP_MM * dropOffset(p); g.visible = p > 0; }
  });
  return <group ref={ref}>{children}</group>;
}
