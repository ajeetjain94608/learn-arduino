import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { InputValues, PartState } from '../../circuit/evaluate';
import type { PartInstance, Wire } from '../../circuit/types';
import { UnoBoard } from '../boards/uno/UnoBoard';
import { isTestMode, soloMode } from '../shared/motion';
import { Breadboard } from '../breadboard/Breadboard';
import { Jumper } from '../parts/Jumper';
import { BurnEffect } from './BurnEffect';
import { BenchModel, PartModel } from './partModels';
import { colX, holeLocal } from '../breadboard/breadboardGeometry';
import { BENCH, pinWorld } from './pinPoints';
import { partBodies } from './partBodies';
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
function WireModel({ wire, route, parts, onPick }: { wire: Wire; route: Route; parts: PartInstance[]; onPick(id: string): void }) {
  const [a, b] = useMemo(() => [pinWorld(wire.from, parts), pinWorld(wire.to, parts)], [wire.from, wire.to, parts]);
  return (
    <group name={wire.id} userData={{ buildWire: wire.id }} onClick={(e) => { e.stopPropagation(); onPick(wire.id); }}>
      <Jumper a={a} b={b} color={wire.color} route={route} />
    </group>
  );
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

export function BuildScene({ burns, parts, wires, inputs, partStates, wireVolts, pin13, rx, tx, onPick, onInput }: Props) {
  // all wires laid out together so none passes through another or through a part
  const routes = useMemo(() => routeWires(wires.map((w) => ({ id: w.id, from: w.from, to: w.to, a: pinWorld(w.from, parts), b: pinWorld(w.to, parts) })), partBodies(parts)), [wires, parts]);
  const onBoard = parts.filter((p) => !('x' in p.at)), onBench = parts.filter((p) => 'x' in p.at);
  // (picture baking: with ?solo only the one thing asked for is drawn — see soloMode)
  const solo = soloMode();
  const boardParts = onBoard.map((p) => (
    <PartModel key={p.id} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={(e) => { e.stopPropagation(); onPick(p.id); }}
      onInput={(key, value) => onInput(p.id, key, value)} />
  ));
  return (
    <>
      <ScreenProbe />
      {(!solo || solo === 'uno') && <UnoBoard position={BENCH.board} pin13={pin13} rx={rx} tx={tx} />}
      {!solo || solo === 'breadboard' ? <Breadboard position={BENCH.breadboard}>{boardParts}</Breadboard> : <group position={BENCH.breadboard}>{boardParts}</group>}
      {onBench.map((p) => (
        <BenchModel key={p.id} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={(e) => { e.stopPropagation(); onPick(p.id); }}
          onInput={(key, value) => onInput(p.id, key, value)} />
      ))}
      {wireVolts && <WireTags wires={wires} routes={routes} volts={wireVolts} />}
      {!solo && wires.map((w) => <WireModel key={w.id} wire={w} route={routes.get(w.id)!} parts={parts} onPick={onPick} />)}
      {burns.map((b) => { const at = burnPosition(b.id, parts, b.supply); return at && <BurnEffect key={b.id} position={at} />; })}
    </>
  );
}
