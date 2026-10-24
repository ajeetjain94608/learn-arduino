import * as THREE from 'three';
import { boardToLocal, headerPin } from '../boards/uno/layout';
import { holeLocal, type Row } from '../breadboard/breadboardGeometry';
import { HEADER_H } from '../boards/uno/parts/Headers';
import { jumperCurves } from '../parts/jumperCurves';

type Vec3 = [number, number, number];
type Hole = [col: number, row: Row];

// Lesson 2 "Blink an LED": where everything sits on the workbench (world mm).
export const BLINK = {
  board: [-38, 0, 2] as Vec3,
  breadboard: [50, 0, 8] as Vec3,
  ledAnode: [8, 'd'] as Hole,
  ledCathode: [9, 'd'] as Hole,
  resistorFrom: [9, 'b'] as Hole,
  resistorTo: [14, 'b'] as Hole,
  signal: { pin: '13', hole: [8, 'a'] as Hole, color: '#F28C16', lift: 22 },
  ground: { pin: 'GND', hole: [14, 'a'] as Hole, color: '#2B2F38', lift: 28 },
};

const add = (v: Vec3, o: Vec3) => new THREE.Vector3(v[0] + o[0], v[1] + o[1], v[2] + o[2]);
export const headerTopWorld = (pin: string) => { const p = headerPin(pin); return add(boardToLocal(p.x, p.y, HEADER_H), BLINK.board); };
export const holeWorld = ([col, row]: Hole) => add(holeLocal(col, row), BLINK.breadboard);

// Both jumpers, oriented in the direction conventional current flows: pin 13 → breadboard, breadboard → GND.
export function blinkWires() {
  const s = { a: headerTopWorld(BLINK.signal.pin), b: holeWorld(BLINK.signal.hole) };
  const g = { a: holeWorld(BLINK.ground.hole), b: headerTopWorld(BLINK.ground.pin) };
  return {
    signal: { ...s, ...jumperCurves(s.a, s.b, BLINK.signal.lift), color: BLINK.signal.color, lift: BLINK.signal.lift },
    ground: { ...g, ...jumperCurves(g.a, g.b, BLINK.ground.lift), color: BLINK.ground.color, lift: BLINK.ground.lift },
  };
}
