import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { InputValues, PartState } from '../../circuit/evaluate';
import type { BoardPlacement, PartInstance, Wire } from '../../circuit/types';
import { UnoBoard } from '../boards/uno/UnoBoard';
import { isTestMode, soloMode } from '../shared/motion';
import { Breadboard } from '../breadboard/Breadboard';
import { PartGroup } from '../inspect/Inspectable';
import { Jumper } from '../parts/Jumper';
import { Arrive } from '../scenes/Arrive';
import type { AssemblyPlan } from '../scenes/assembly';
import { BurnEffect } from './BurnEffect';
import { BenchModel, PartModel } from './partModels';
import { BB, colX, holeLocal } from '../breadboard/breadboardGeometry';
import { BENCH, pinWorld } from './pinPoints';
import { partBodies } from './partBodies';
import type { Slot } from '../scenes/assembly';
import { routeWires, type Route } from './wireRoute';
import { WireTags } from './WireTags';

type Props = {
  burns: { id: string; supply?: string }[];
  parts: PartInstance[];
  wires: Wire[];
  inputs: InputValues;
  partStates: Record<string, PartState>;
  wireVolts?: Record<string, number>; // set while the board runs and tags are on
  pin13: boolean; rx: boolean; tx: boolean;
  onPick(id: string): void;
  onInput(partId: string, key: string, value: number): void;
  // Home's project view ("showcase"): the circuit builds itself with this plan, and every part and wire can be hovered
  // (the name card) and tapped, like the Blink circuit. Without it: the plain Build bench.
  plan?: AssemblyPlan;
};

// Test hook: where a part (or a pot's knob) is on the page, so tests can press and turn it like a person would.
function ScreenProbe() {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    if (!isTestMode()) return;
    (window.__rq ??= { debug: {} }).debug.buildPartScreen = (id: string) => {
      const o = scene.getObjectByName(`${id}:knob`) ?? scene.getObjectByName(id);
      if (!o) return null;
      const v = o.name.endsWith(':knob') ? o.getWorldPosition(new THREE.Vector3()) : new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      if (o.name.endsWith(':knob')) v.y += 6.5; // the knob's top face
      v.project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
  }, [scene, camera, gl]);
  return null;
}

// One jumper, along the path the router gave it.
function WireModel({ wire, route, parts, onPick, slot }: { wire: Wire; route: Route; parts: PartInstance[]; onPick(id: string): void; slot?: Slot }) {
  const [a, b] = useMemo(() => [pinWorld(wire.from, parts), pinWorld(wire.to, parts)], [wire.from, wire.to, parts]);
  const jumper = (
    <group name={wire.id} userData={{ buildWire: wire.id }} onClick={slot ? undefined : (e) => { e.stopPropagation(); onPick(wire.id); }}>
      {/* in the build-up every wire is drawn from the UNO's end */}
      <Jumper a={a} b={b} color={wire.color} route={route} step={slot} fromB={!!slot && wire.to.startsWith('uno.') && !wire.from.startsWith('uno.')} />
    </group>
  );
  if (!slot) return jumper;
  const mid = route.curve.getPoint(0.5).toArray() as [number, number, number];
  return <PartGroup id={`wire-${wire.id}`} kind="wire" center={mid}>{jumper}</PartGroup>;
}

// The Build bench: the UNO and the breadboard where they sit in the Blink project, the learner's parts and wires.
// Where to show a burn: on the LED, on the damaged pin, or on the supply pin that was shorted.
function burnPosition(id: string, parts: PartInstance[], supply = '5V'): [number, number, number] | null {
  if (id === 'uno') return pinWorld(`uno.${supply}`).add(new THREE.Vector3(0, 4, 0)).toArray() as [number, number, number];
  if (id.startsWith('uno.')) return pinWorld(id).add(new THREE.Vector3(0, 4, 0)).toArray() as [number, number, number];
  const p = parts.find((x) => x.id === id);
  if (!p) return null;
  if ('x' in p.at) return [p.at.x, 20, p.at.z];
  const [, , z] = holeLocal(p.at.col, p.at.row);
  return [colX(p.at.col) + 1.27 + BENCH.breadboard[0], 20, z + BENCH.breadboard[2]];
}

export function BuildScene({ burns, parts, wires, inputs, partStates, wireVolts, pin13, rx, tx, onPick, onInput, plan }: Props) {
  // all wires laid out together so none passes through another or through a part
  const routes = useMemo(() => routeWires(wires.map((w) => ({ id: w.id, from: w.from, to: w.to, a: pinWorld(w.from, parts), b: pinWorld(w.to, parts) })), partBodies(parts)), [wires, parts]);
  const onBoard = parts.filter((p) => !('x' in p.at)), onBench = parts.filter((p) => 'x' in p.at);
  // (picture baking: with ?solo only the one thing asked for is drawn — see soloMode)
  const solo = soloMode();
  // a press on a part: in the build-up it also reaches the hover/tap handling of Home's scene (so it is not stopped here)
  const pick = (id: string) => (e: { stopPropagation(): void }) => { if (!plan) e.stopPropagation(); onPick(id); };
  const slotOfPart = (p: PartInstance) => plan?.parts[parts.indexOf(p)];
  // one part, wrapped for the build-up (it drops in from above, and can be hovered) when there is a plan
  const showcase = (p: PartInstance, node: React.ReactNode, center: [number, number, number]) => {
    const slot = slotOfPart(p);
    return slot ? <PartGroup key={p.id} id={p.id} kind={p.type} center={center}><Arrive step={slot} from="above">{node}</Arrive></PartGroup> : node;
  };
  const boardParts = onBoard.map((p) => {
    const at = p.at as BoardPlacement;
    const [x, , z] = holeLocal(at.col, at.row);
    return showcase(p, <PartModel key={p.id} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={pick(p.id)} onInput={(key, value) => onInput(p.id, key, value)} />, [x, BB.H, z]);
  });
  return (
    <>
      <ScreenProbe />
      {(!solo || solo === 'uno') && <UnoBoard position={BENCH.board} pin13={pin13} rx={rx} tx={tx} />}
      {plan ? (
        <PartGroup id="breadboard" kind="breadboard" center={BENCH.breadboard}>
          <Arrive step={plan.breadboard} from="right"><Breadboard position={BENCH.breadboard}>{boardParts}</Breadboard></Arrive>
        </PartGroup>
      ) : !solo || solo === 'breadboard' ? <Breadboard position={BENCH.breadboard}>{boardParts}</Breadboard> : <group position={BENCH.breadboard}>{boardParts}</group>}
      {onBench.map((p) => showcase(p, (
        <BenchModel key={p.id} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={pick(p.id)} onInput={(key, value) => onInput(p.id, key, value)} />
      ), [(p.at as { x: number }).x, 0, (p.at as { z: number }).z]))}
      {wireVolts && <WireTags wires={wires} routes={routes} volts={wireVolts} />}
      {!solo && wires.map((w, j) => <WireModel key={w.id} wire={w} route={routes.get(w.id)!} parts={parts} onPick={onPick} slot={plan?.wires[j]} />)}
      {burns.map((b) => { const at = burnPosition(b.id, parts, b.supply); return at && <BurnEffect key={b.id} position={at} />; })}
    </>
  );
}
