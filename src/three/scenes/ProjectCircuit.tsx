import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { InputValues, PartState } from '../../circuit/evaluate';
import type { PartInstance, Wire } from '../../circuit/types';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { BuildScene } from '../build/BuildScene';
import { isTestMode, useReducedMotion } from '../shared/motion';
import { AssemblyContext, assemblyPlan, type AssemblyClock } from './assembly';

// Tests see the finished circuit at once unless they ask for the animation with ?anim.
const ANIMATE_IN_TESTS = new URLSearchParams(location.search).has('anim');

type Props = {
  parts: PartInstance[]; wires: Wire[]; inputs: InputValues;
  partStates: Record<string, PartState>;
  burns: { id: string; supply?: string }[];
  wireVolts?: Record<string, number>;
  pin13: boolean; rx: boolean; tx: boolean;
  flow?: { active: boolean; volts: Record<string, number> };
  onInput(partId: string, key: string, value: number): void;
};

// Any project's circuit on Home, built the way the Blink circuit is: the breadboard slides in, the parts drop into
// place one after another, then each wire draws itself from the board (see assembly.ts). Every part can be hovered
// for its name and tapped for its explanation. Reduced motion shows it built. Remount (key) to play it again.
export function ProjectCircuit({ parts, wires, inputs, partStates, burns, wireVolts, pin13, rx, tx, flow, onInput }: Props) {
  const reduced = useReducedMotion();
  const count = parts.filter((p) => p.type !== 'breadboard').length; // (a breadboard has a step of its own in the plan)
  const plan = useMemo(() => assemblyPlan(count, wires.length), [count, wires.length]);
  const clock = useMemo<AssemblyClock>(() => ({ t: Infinity }), []);
  useEffect(() => {
    const instant = reduced || (isTestMode() && !ANIMATE_IN_TESTS);
    clock.t = instant ? Infinity : 0;
    useWorkbenchStore.getState().setAssembled(instant);
    if (instant) setTimeout(() => useWorkbenchStore.getState().fitCamera(), 120); // already built: fit at once (after the first frame)
  }, [reduced, clock]);
  useFrame((_, dt) => {
    if (clock.t < plan.done) {
      clock.t += Math.min(dt, 0.1); // a long first frame (shader warm-up) must not skip the build
      if (clock.t >= plan.done) { useWorkbenchStore.getState().setAssembled(true); useWorkbenchStore.getState().fitCamera(); } // built: ease the camera out to show it all
    }
    if (isTestMode()) {
      const built = plan.parts.filter((s) => clock.t >= s[0] + s[1]).length + plan.wires.filter((s) => clock.t >= s[0] + s[1]).length;
      (window.__rq ??= { debug: {} }).debug.assembly = { t: clock.t, built };
    }
  });
  return (
    <AssemblyContext.Provider value={clock}>
      <BuildScene burns={burns} parts={parts} wires={wires} inputs={inputs} partStates={partStates} wireVolts={wireVolts}
        pin13={pin13} rx={rx} tx={tx} onPick={() => {}} onInput={onInput} plan={plan} flow={flow} />
    </AssemblyContext.Provider>
  );
}
