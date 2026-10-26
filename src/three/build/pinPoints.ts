import * as THREE from 'three';
import { BB, colX, RAIL_Z, type Row } from '../breadboard/breadboardGeometry';
import { BLINK, headerTopWorld, holeWorld } from '../scenes/blinkLayout';
import { PART_DEFS, rotatePoint } from '../../circuit/parts';
import type { PartInstance } from '../../circuit/types';

// The Build bench uses the same layout as the Blink project: UNO on the left, breadboard on the right.
export const BENCH = { board: BLINK.board, breadboard: BLINK.breadboard };

const UNO_LABEL: Record<string, string> = { '5V': '5V', '3V3': '3.3V', VIN: 'VIN', GND: 'GND', AREF: 'AREF' };
const RAIL_INDEX: Record<string, number> = { 'T-': 0, 'T+': 1, 'B-': 2, 'B+': 3 };

// Where a connection point is in the world (mm): the top of a UNO header socket, a breadboard hole, or the tip of a
// module's header pin (`parts`: the modules on the bench).
export function pinWorld(ref: string, parts: readonly PartInstance[] = []): THREE.Vector3 {
  const [part, pin] = [ref.slice(0, ref.indexOf('.')), ref.slice(ref.indexOf('.') + 1)];
  const module = parts.find((p) => p.id === part);
  const bench = module && PART_DEFS[module.type].bench;
  if (module && bench && 'x' in module.at) {
    const [dx, y, dz] = bench.pins[pin] ?? [0, 0, 0];
    const [rx, rz] = rotatePoint(dx, dz, module.rot ?? 0);
    return new THREE.Vector3(module.at.x + rx, y, module.at.z + rz);
  }
  if (part === 'uno') {
    const label = UNO_LABEL[pin] ?? (pin.startsWith('D') ? pin.slice(1) : pin);
    return headerTopWorld(label);
  }
  const rail = pin.match(/^([TB][+-])(\d+)$/);
  if (rail) {
    const b = BENCH.breadboard;
    return new THREE.Vector3(colX(Number(rail[2])) + b[0], BB.H + b[1], RAIL_Z[RAIL_INDEX[rail[1]]] + b[2]);
  }
  const hole = pin.match(/^(\d+)([a-j])$/);
  if (!hole) throw new Error(`Unknown connection point: ${ref}`);
  return holeWorld([Number(hole[1]), hole[2] as Row]);
}
