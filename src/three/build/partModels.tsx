import { useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PartState } from '../../circuit/evaluate';
import { paramsOf } from '../../circuit/parts';
import type { PartInstance } from '../../circuit/types';
import { BB, colX, holeLocal, ROW } from '../breadboard/breadboardGeometry';
import { Led5mm, type LedColor } from '../parts/Led5mm';
import { Resistor } from '../parts/Resistor';
import { castAll, rbox } from '../shared/geometry';
import { MATERIALS, std } from '../shared/materials';

// Colour bands (digit, digit, multiplier, ±5 % gold) for the resistor values on offer.
const BANDS: Record<number, string[]> = {
  220: ['#D8342B', '#D8342B', '#7A4A24', '#C9A140'],
  1000: ['#7A4A24', '#1A1A1A', '#D8342B', '#C9A140'],
  10000: ['#7A4A24', '#1A1A1A', '#EE8A24', '#C9A140'],
};

type Controls = { enabled: boolean } | null;
type OnInput = (key: string, value: number) => void;

// Press-and-hold in 3D: pressed while the pointer is down (anywhere it goes), released when it lifts.
function useHold(onInput: OnInput) {
  const controls = useThree((s) => s.controls) as Controls;
  return (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (controls) controls.enabled = false; // the camera stays still while you press
    onInput('pressed', 1);
    const up = () => { onInput('pressed', 0); if (controls) controls.enabled = true; window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
}

// Turn a knob in 3D: drag around its centre, like turning a real one — it turns by how far the pointer goes round
// (wherever you grab it), and stops at the ends. The full range is 270°.
export const pointerAngle = (dx: number, dy: number) => (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° = top, clockwise
export function turnKnob(position: number, fromAngle: number, toAngle: number): number {
  let d = toAngle - fromAngle;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.min(1, Math.max(0, position + d / 270));
}
function useTurn(knob: THREE.Object3D, position: number, onInput: OnInput) {
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as Controls;
  return (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (controls) controls.enabled = false;
    const v = knob.getWorldPosition(new THREE.Vector3()).project(camera);
    const r = gl.domElement.getBoundingClientRect();
    const cx = r.left + (v.x * 0.5 + 0.5) * r.width, cy = r.top + (-v.y * 0.5 + 0.5) * r.height;
    let pos = position, angle: number | null = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - cx, dy = ev.clientY - cy;
      if (dx * dx + dy * dy < 36) return; // too close to the centre to tell the angle
      const a = pointerAngle(dx, dy);
      if (angle !== null) { const p = turnKnob(pos, angle, a); if (p !== pos) { pos = p; onInput('position', p); } }
      angle = a;
    };
    const up = () => { if (controls) controls.enabled = true; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
}

// 6 mm tactile push button straddling the gap: black body, round cap that moves down when pressed.
function Button6mm({ col, pressed, onInput }: { col: number; pressed: boolean; onInput: OnInput }) {
  const parts = useMemo(() => {
    const g = new THREE.Group();
    const body = rbox(6, 3.4, 6, 0.4, std('#22252B', 0.5)); body.position.y = BB.H + 1.7; g.add(body);
    const plate = rbox(6.2, 0.4, 6.2, 0.2, MATERIALS.metal); plate.position.y = BB.H + 3.5; g.add(plate);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 1.6, 32), std('#3C4048', 0.45)); cap.position.y = BB.H + 4.4; g.add(cap);
    for (const dx of [-2.54, 2.54]) for (const dz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3, 0.4), MATERIALS.metal);
      leg.position.set(dx, BB.H - 0.6, dz * (ROW.f - ROW.e) / 2); g.add(leg);
    }
    return { g: castAll(g), cap };
  }, []);
  parts.cap.position.y = BB.H + (pressed ? 3.8 : 4.4);
  const hold = useHold(onInput);
  return <primitive object={parts.g} position={[colX(col + 1), 0, (ROW.e + ROW.f) / 2]} onPointerDown={hold} />;
}

// 10 kΩ rotary potentiometer: blue base on the breadboard, black knob with a white pointer.
// position 0…1 turns the pointer from −135° to +135°.
export const knobAngle = (position: number) => (-135 + 270 * position) * (Math.PI / 180);
function Potentiometer({ id, col, row, position, onInput }: { id: string; col: number; row: PartInstance['at']['row']; position: number; onInput: OnInput }) {
  const parts = useMemo(() => {
    const g = new THREE.Group();
    const base = rbox(9.6, 5, 9.6, 0.6, std('#2F5BBF', 0.55)); base.position.y = BB.H + 2.5; g.add(base);
    const knob = new THREE.Group(); knob.position.y = BB.H + 5; knob.name = `${id}:knob`;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 6.5, 40), std('#1F2228', 0.5)); cap.position.y = 3.25; knob.add(cap);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 3.2), std('#F4F4F4', 0.4)); mark.position.set(0, 6.55, -1.6); knob.add(mark);
    g.add(knob);
    for (const dx of [-2.54 * 2, 0, 2.54 * 2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 0.4), MATERIALS.metal); leg.position.set(dx, BB.H - 0.6, -2.54); g.add(leg);
    }
    return { g: castAll(g), knob };
  }, [id]);
  parts.knob.rotation.y = -knobAngle(position);
  const turn = useTurn(parts.knob, position, onInput);
  const [, , z] = holeLocal(col, row);
  const side = ['a', 'b', 'c', 'd', 'e'].includes(row) ? 1 : -1; // the body sits toward the middle of its side
  return <primitive object={parts.g} position={[colX(col + 2), 0, z + side * 2.54]} onPointerDown={turn} />;
}

type Props = { part: PartInstance; state?: PartState; inputs?: Record<string, number>; onPick(e: ThreeEvent<MouseEvent>): void; onInput: OnInput };

// One placed part, in breadboard-local coordinates (render inside <Breadboard>).
export function PartModel({ part, state, inputs, onPick, onInput }: Props) {
  const { col, row } = part.at;
  const params = paramsOf(part.type, part.params);
  const [, , z] = holeLocal(col, row);
  let model: React.ReactNode = null;
  if (part.type === 'led') model = (
    <>
      <Led5mm position={[colX(col) + 1.27, 0, z]} color={String(params.color) as LedColor} lit={state?.burnt ? 0 : state?.brightness ?? 0} />
      {state?.burnt && ( // a blackened, cracked-looking lens
        <mesh position={[colX(col) + 1.27, BB.H + 10.5, z]} raycast={() => {}}>
          <sphereGeometry args={[2.75, 20, 16]} />
          <meshStandardMaterial color="#1B1410" roughness={0.9} transparent opacity={0.72} />
        </mesh>
      )}
    </>
  );
  else if (part.type === 'resistor') model = <Resistor from={[col, row]} to={[col + 4, row]} bands={BANDS[Number(params.ohms)] ?? BANDS[220]} />;
  else if (part.type === 'button') model = <Button6mm col={col} pressed={(inputs?.pressed ?? 0) >= 0.5} onInput={onInput} />;
  else if (part.type === 'pot') model = <Potentiometer id={part.id} col={col} row={row} position={inputs?.position ?? 0.5} onInput={onInput} />;
  return <group name={part.id} userData={{ buildPart: part.id }} onClick={onPick}>{model}</group>;
}
