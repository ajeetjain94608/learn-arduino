import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { InputValues, PartState } from '../../circuit/evaluate';
import type { PartInstance, Wire } from '../../circuit/types';
import { UnoBoard } from '../boards/uno/UnoBoard';
import { isTestMode } from '../shared/motion';
import { Breadboard } from '../breadboard/Breadboard';
import { Jumper } from '../parts/Jumper';
import { BurnEffect } from './BurnEffect';
import { PartModel } from './partModels';
import { colX, holeLocal } from '../breadboard/breadboardGeometry';
import { BENCH, pinWorld } from './pinPoints';
import { partBodies } from './partBodies';
import { routeWires, type Route } from './wireRoute';

type Props = {
  burns: { id: string }[];
  parts: PartInstance[];
  wires: Wire[];
  inputs: InputValues;
  partStates: Record<string, PartState>;
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
function WireModel({ wire, route, onPick }: { wire: Wire; route: Route; onPick(id: string): void }) {
  const [a, b] = useMemo(() => [pinWorld(wire.from), pinWorld(wire.to)], [wire.from, wire.to]);
  return (
    <group name={wire.id} userData={{ buildWire: wire.id }} onClick={(e) => { e.stopPropagation(); onPick(wire.id); }}>
      <Jumper a={a} b={b} color={wire.color} route={route} />
    </group>
  );
}

// The Build bench: the UNO and the breadboard where they sit in the Blink project, the learner's parts and wires.
// Where to show a burn: on the LED, on the damaged pin, or over the UNO's power section for a short.
function burnPosition(id: string, parts: PartInstance[]): [number, number, number] | null {
  if (id === 'uno') return [BENCH.board[0] - 18, 14, BENCH.board[2] + 14];
  if (id.startsWith('uno.')) return pinWorld(id).add(new THREE.Vector3(0, 4, 0)).toArray() as [number, number, number];
  const p = parts.find((x) => x.id === id);
  if (!p) return null;
  const [, , z] = holeLocal(p.at.col, p.at.row);
  return [colX(p.at.col) + 1.27 + BENCH.breadboard[0], 20, z + BENCH.breadboard[2]];
}

export function BuildScene({ burns, parts, wires, inputs, partStates, pin13, rx, tx, onPick, onInput }: Props) {
  // all wires laid out together so none passes through another or through a part
  const routes = useMemo(() => routeWires(wires.map((w) => ({ id: w.id, from: w.from, to: w.to, a: pinWorld(w.from), b: pinWorld(w.to) })), partBodies(parts)), [wires, parts]);
  return (
    <>
      <ScreenProbe />
      <UnoBoard position={BENCH.board} pin13={pin13} rx={rx} tx={tx} />
      <Breadboard position={BENCH.breadboard}>
        {parts.map((p) => (
          <PartModel key={p.id} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={(e) => { e.stopPropagation(); onPick(p.id); }}
            onInput={(key, value) => onInput(p.id, key, value)} />
        ))}
      </Breadboard>
      {wires.map((w) => <WireModel key={w.id} wire={w} route={routes.get(w.id)!} onPick={onPick} />)}
      {burns.map((b) => { const at = burnPosition(b.id, parts); return at && <BurnEffect key={b.id} position={at} />; })}
    </>
  );
}
