import { useMemo } from 'react';
import type { InputValues, PartState } from '../../circuit/evaluate';
import type { PartInstance, Wire } from '../../circuit/types';
import { UnoBoard } from '../boards/uno/UnoBoard';
import { Breadboard } from '../breadboard/Breadboard';
import { Jumper } from '../parts/Jumper';
import { PartModel } from './partModels';
import { BENCH, pinWorld } from './pinPoints';

type Props = {
  parts: PartInstance[];
  wires: Wire[];
  inputs: InputValues;
  partStates: Record<string, PartState>;
  pin13: boolean; rx: boolean; tx: boolean;
  onPick(id: string): void;
};

// One jumper; its curve is rebuilt only when its ends or colour change.
function WireModel({ wire, onPick }: { wire: Wire; onPick(id: string): void }) {
  const [a, b] = useMemo(() => [pinWorld(wire.from), pinWorld(wire.to)], [wire.from, wire.to]);
  return (
    <group name={wire.id} onClick={(e) => { e.stopPropagation(); onPick(wire.id); }}>
      <Jumper a={a} b={b} color={wire.color} lift={20} />
    </group>
  );
}

// The Build bench: the UNO and the breadboard where they sit in the Blink project, the learner's parts and wires.
export function BuildScene({ parts, wires, inputs, partStates, pin13, rx, tx, onPick }: Props) {
  return (
    <>
      <UnoBoard position={BENCH.board} pin13={pin13} rx={rx} tx={tx} />
      <Breadboard position={BENCH.breadboard}>
        {parts.map((p) => (
          <PartModel key={p.id} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={(e) => { e.stopPropagation(); onPick(p.id); }} />
        ))}
      </Breadboard>
      {wires.map((w) => <WireModel key={w.id} wire={w} onPick={onPick} />)}
    </>
  );
}
