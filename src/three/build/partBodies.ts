import * as THREE from 'three';
import { benchRect, PART_DEFS } from '../../circuit/parts';
import type { PartInstance } from '../../circuit/types';
import type { Obstacle } from './wireRoute';
import { pinWorld } from './pinPoints';

// How tall each part stands above the breadboard (mm), for keeping wires out of it.
const HEIGHT: Record<string, number> = { led: 12, resistor: 4, button: 5, pot: 13, rgb: 12, buzzer: 10, ldr: 8, tmp36: 7, fsr: 3, diode: 4, npn: 18, traffic: 26 };

// The space each part's body fills: the holes it covers, up to its height.
export function partBodies(parts: PartInstance[]): Obstacle[] {
  return parts.flatMap((p) => {
    const bench = PART_DEFS[p.type].bench;
    if (bench && 'x' in p.at) { // a module: its box on the bench (its header pins stick out of it: the router allows the wire's own end)
      const r = benchRect(p.type, p.at);
      return [{ box: new THREE.Box3(new THREE.Vector3(r.x - r.w / 2, 0, r.z - r.d / 2), new THREE.Vector3(r.x + r.w / 2, bench.h, r.z + r.d / 2)) }];
    }
    const holes = PART_DEFS[p.type].covers(p.at, p.params);
    if (!holes.length) return [];
    const box = new THREE.Box3();
    for (const h of holes) box.expandByPoint(pinWorld(`bb.${h}`));
    box.max.y += HEIGHT[p.type] ?? 10;
    return [{ box: box.expandByVector(new THREE.Vector3(1, 0, 1)) }];
  });
}
