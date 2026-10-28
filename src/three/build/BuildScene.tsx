import { useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { InputValues, PartState } from '../../circuit/evaluate';
import { boardOf, DEFAULT_BOARD, PART_DEFS } from '../../circuit/parts';
import type { BoardPlacement, PartInstance, Placement, Wire } from '../../circuit/types';
import { UnoBoard } from '../boards/uno/UnoBoard';
import { isTestMode, soloMode } from '../shared/motion';
import { PartGroup } from '../inspect/Inspectable';
import { Jumper } from '../parts/Jumper';
import { Arrive } from '../scenes/Arrive';
import type { AssemblyPlan } from '../scenes/assembly';
import { BurnEffect } from './BurnEffect';
import { CurrentFlow } from '../current/CurrentFlow';
import { BenchModel, BoardModel, LooseModel, PartModel } from './partModels';
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
  onMove?(id: string, at: Placement): boolean | void; // pressing a part and dragging carries it (the Build bench only; Home just looks)
  selected?: string | null;
  // Current shown as dots along the wires (Home's projects and the Build bench): `volts` are the wires' voltages
  flow?: { active: boolean; volts: Record<string, number> };
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

// A curve walked the other way round.
class Reversed extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly c: THREE.Curve<THREE.Vector3>) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) { return this.c.getPoint(1 - t, target); }
}
// Which way current runs in a wire, as far as the UNO says: out of a supply pin or a HIGH pin, back into a GND socket. A wire
// with no UNO end, or on a LOW pin, shows none. Returns true for "from → to" along the wire.
export function flowForward(from: string, to: string, volts: number): boolean | null {
  const uno = [from, to].find((r) => r.startsWith('uno.'));
  if (!uno) return null;
  const pin = uno.slice(4), out = /^(5V|3V3|VIN)$/.test(pin) || (/^[DA]d+$/.test(pin) && volts >= 1);
  if (/^GND/.test(pin)) return uno === to;     // into the UNO
  return out ? uno === from : null;             // away from the UNO
}

// For a pin of a part standing on the table (not a module's header): which way its plug lies, flat on the table and away from the
// part's other legs, so the jumper does not stand up through the part. Null for every other kind of point.
function plugOut(ref: string, parts: PartInstance[]): THREE.Vector3 | null {
  const id = ref.slice(0, ref.indexOf('.'));
  const p = parts.find((x) => x.id === id);
  if (!p || !('x' in p.at) || PART_DEFS[p.type].bench) return null;
  const pins = PART_DEFS[p.type].pins.map((pin) => pinWorld(`${id}.${pin}`, parts));
  const here = pinWorld(ref, parts), centre = pins.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(pins.length);
  const out = here.clone().sub(centre).setY(0);
  if (out.length() < 0.5) out.set(0, 0, -1); // a lone or central pin (a potentiometer's wiper): towards the back, so wires stay behind the part
  return out.normalize();
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

// a module, or a part standing on the table with its legs free
const FreeModel = (props: ComponentProps<typeof BenchModel>) => (PART_DEFS[props.part.type].bench ? <BenchModel {...props} /> : <LooseModel {...props} />);

// The Build bench: the UNO and the breadboard where they sit in the Blink project, the learner's parts and wires.
// Where to show a burn: on the LED, on the damaged pin, or on the supply pin that was shorted.
function burnPosition(id: string, parts: PartInstance[], supply = '5V'): [number, number, number] | null {
  if (id === 'uno') return pinWorld(`uno.${supply}`).add(new THREE.Vector3(0, 4, 0)).toArray() as [number, number, number];
  if (id.startsWith('uno.')) return pinWorld(id).add(new THREE.Vector3(0, 4, 0)).toArray() as [number, number, number];
  const p = parts.find((x) => x.id === id);
  if (!p) return null;
  if ('x' in p.at) return [p.at.x, 20, p.at.z];
  const [, , z] = holeLocal(p.at.col, p.at.row);
  const board = parts.find((x) => x.id === boardOf(p))?.at as { x: number; z: number } | undefined;
  return [colX(p.at.col) + 1.27 + (board?.x ?? BENCH.breadboard[0]), 20, z + (board?.z ?? BENCH.breadboard[2])];
}

export function BuildScene({ burns, parts, wires, inputs, partStates, wireVolts, pin13, rx, tx, onPick, onMove, selected, flow, onInput, plan }: Props) {
  // all wires laid out together so none passes through another or through a part
  const routes = useMemo(() => routeWires(wires.map((w) => ({ id: w.id, from: w.from, to: w.to, a: pinWorld(w.from, parts), b: pinWorld(w.to, parts), outA: plugOut(w.from, parts), outB: plugOut(w.to, parts) })), partBodies(parts)), [wires, parts]);
  const flowWires = useMemo(() => (!flow?.active ? [] : wires.flatMap((w) => {
    const fwd = flowForward(w.from, w.to, flow.volts[w.id] ?? 0), route = routes.get(w.id);
    return fwd === null || !route ? [] : [{ path: [fwd ? route.curve : new Reversed(route.curve)] }];
  })), [flow, wires, routes]);
  // burns that were already there when this scene opened are only shown again: the sparks and the sound are for a burn that happens now
  const shownAtStart = useRef(new Set(burns.map((b) => b.id)));
  useEffect(() => { for (const id of [...shownAtStart.current]) if (!burns.some((b) => b.id === id)) shownAtStart.current.delete(id); }, [burns]); // replaced: the next burn is new
  // the breadboards, and everything else: in a breadboard's holes, or standing on the bench
  const boards = parts.filter((p) => p.type === 'breadboard'), plain = parts.filter((p) => p.type !== 'breadboard');
  const onBoard = plain.filter((p) => !('x' in p.at)), onBench = plain.filter((p) => 'x' in p.at);
  const boardAt = (id: string) => (boards.find((b) => b.id === id)?.at ?? { x: BENCH.breadboard[0], z: BENCH.breadboard[2] }) as { x: number; z: number };
  // (picture baking: with ?solo only the one thing asked for is drawn — see soloMode)
  const solo = soloMode();
  // a press on a part: in the build-up it also reaches the hover/tap handling of Home's scene (so it is not stopped here)
  const pick = (id: string) => (e: { stopPropagation(): void }) => { if (!plan) e.stopPropagation(); onPick(id); };
  const slotOfPart = (p: PartInstance) => plan?.parts[plain.indexOf(p)];
  // one part, wrapped for the build-up (it drops in from above, and can be hovered) when there is a plan
  const showcase = (p: PartInstance, node: React.ReactNode, center: [number, number, number]) => {
    const slot = slotOfPart(p);
    return slot ? <PartGroup key={p.id} id={p.id} kind={p.type} center={center}><Arrive step={slot} from="above">{node}</Arrive></PartGroup> : node;
  };
  const partsIn = (board: string) => onBoard.filter((p) => (boardOf(p) ?? DEFAULT_BOARD) === board).map((p) => {
    const at = p.at as BoardPlacement;
    const [x, , z] = holeLocal(at.col, at.row);
    return showcase(p, <PartModel key={p.id} boardAt={boardAt(board)} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={pick(p.id)} onMove={onMove && ((to) => onMove(p.id, to as Placement))} selected={selected === p.id} onInput={(key, value) => onInput(p.id, key, value)} />, [x, BB.H, z]);
  });
  return (
    <>
      <ScreenProbe />
      {(!solo || solo === 'uno') && <UnoBoard position={BENCH.board} pin13={pin13} rx={rx} tx={tx} />}
      {boards.map((b, i) => {
        const at = b.at as { x: number; z: number };
        if (solo && solo !== 'breadboard') return <group key={b.id} position={[at.x, 0, at.z]}>{partsIn(b.id)}</group>; // (picture baking: just the parts)
        const node = (
          <BoardModel key={b.id} part={b} onPick={pick(b.id)} onMove={onMove && ((to) => onMove(b.id, to as Placement))} selected={selected === b.id} onInput={() => {}}>
            {partsIn(b.id)}
          </BoardModel>
        );
        return plan && i === 0 ? ( // Home's build-up: the first breadboard slides in
          <PartGroup key={b.id} id="breadboard" kind="breadboard" center={[at.x, 0, at.z]}>
            <Arrive step={plan.breadboard} from="right">{node}</Arrive>
          </PartGroup>
        ) : node;
      })}
      {onBench.map((p) => showcase(p, (
        <FreeModel key={p.id} part={p} state={partStates[p.id]} inputs={inputs[p.id]} onPick={pick(p.id)} onMove={onMove && ((to) => onMove(p.id, to as Placement))} selected={selected === p.id} onInput={(key, value) => onInput(p.id, key, value)} />
      ), [(p.at as { x: number }).x, 0, (p.at as { z: number }).z]))}
      <CurrentFlow wires={flowWires} active={!!flow?.active && flowWires.length > 0} />
      {wireVolts && <WireTags wires={wires} routes={routes} volts={wireVolts} />}
      {!solo && wires.map((w, j) => <WireModel key={w.id} wire={w} route={routes.get(w.id)!} parts={parts} onPick={onPick} slot={plan?.wires[j]} />)}
      {burns.map((b) => { const at = burnPosition(b.id, parts, b.supply); return at && <BurnEffect key={b.id} position={at} fresh={!shownAtStart.current.has(b.id)} />; })}
    </>
  );
}
