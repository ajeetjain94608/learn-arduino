import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
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

// 6 mm tactile push button straddling the gap: black body, round cap that moves down when pressed.
function Button6mm({ col, pressed }: { col: number; pressed: boolean }) {
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
  return <primitive object={parts.g} position={[colX(col + 1), 0, (ROW.e + ROW.f) / 2]} />;
}

// 10 kΩ rotary potentiometer: blue base on the breadboard, black knob with a white pointer.
// position 0…1 turns the pointer from −135° to +135°.
export const knobAngle = (position: number) => (-135 + 270 * position) * (Math.PI / 180);
function Potentiometer({ col, row, position }: { col: number; row: PartInstance['at']['row']; position: number }) {
  const parts = useMemo(() => {
    const g = new THREE.Group();
    const base = rbox(9.6, 5, 9.6, 0.6, std('#2F5BBF', 0.55)); base.position.y = BB.H + 2.5; g.add(base);
    const knob = new THREE.Group(); knob.position.y = BB.H + 5;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 6.5, 40), std('#1F2228', 0.5)); cap.position.y = 3.25; knob.add(cap);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 3.2), std('#F4F4F4', 0.4)); mark.position.set(0, 6.55, -1.6); knob.add(mark);
    g.add(knob);
    for (const dx of [-2.54 * 2, 0, 2.54 * 2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 0.4), MATERIALS.metal); leg.position.set(dx, BB.H - 0.6, -2.54); g.add(leg);
    }
    return { g: castAll(g), knob };
  }, []);
  parts.knob.rotation.y = -knobAngle(position);
  const [, , z] = holeLocal(col, row);
  const side = ['a', 'b', 'c', 'd', 'e'].includes(row) ? 1 : -1; // the body sits toward the middle of its side
  return <primitive object={parts.g} position={[colX(col + 2), 0, z + side * 2.54]} />;
}

type Props = { part: PartInstance; state?: PartState; inputs?: Record<string, number>; onPick(e: ThreeEvent<MouseEvent>): void };

// One placed part, in breadboard-local coordinates (render inside <Breadboard>).
export function PartModel({ part, state, inputs, onPick }: Props) {
  const { col, row } = part.at;
  const params = paramsOf(part.type, part.params);
  const [, , z] = holeLocal(col, row);
  let model: React.ReactNode = null;
  if (part.type === 'led') model = <Led5mm position={[colX(col) + 1.27, 0, z]} color={String(params.color) as LedColor} lit={state?.burnt ? 0 : state?.brightness ?? 0} />;
  else if (part.type === 'resistor') model = <Resistor from={[col, row]} to={[col + 4, row]} bands={BANDS[Number(params.ohms)] ?? BANDS[220]} />;
  else if (part.type === 'button') model = <Button6mm col={col} pressed={(inputs?.pressed ?? 0) >= 0.5} />;
  else if (part.type === 'pot') model = <Potentiometer col={col} row={row} position={inputs?.position ?? 0.5} />;
  return <group name={part.id} userData={{ partId: part.id }} onClick={onPick}>{model}</group>;
}
