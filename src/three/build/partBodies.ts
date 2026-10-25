import * as THREE from 'three';
import { PART_DEFS } from '../../circuit/parts';
import type { PartInstance } from '../../circuit/types';
import type { Obstacle } from './wireRoute';
import { pinWorld } from './pinPoints';

// How tall each part stands above the breadboard (mm), for keeping wires out of it.
const HEIGHT: Record<string, number> = { led: 12, resistor: 4, button: 5, pot: 13 };

// The space each part's body fills: the holes it covers, up to its height.
export function partBodies(parts: PartInstance[]): Obstacle[] {
  return parts.flatMap((p) => {
    const holes = PART_DEFS[p.type].covers(p.at, p.params);
    if (!holes.length) return [];
    const box = new THREE.Box3();
    for (const h of holes) box.expandByPoint(pinWorld(`bb.${h}`));
    box.max.y += HEIGHT[p.type] ?? 10;
    return [{ box: box.expandByVector(new THREE.Vector3(1, 0, 1)) }];
  });
}
