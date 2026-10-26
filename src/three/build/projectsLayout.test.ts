// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PROJECTS } from '../../content/projects';
import { HOUSING_H } from '../parts/jumperCurves';
import { partBodies } from './partBodies';
import { pinWorld } from './pinPoints';

// The camera looks along -VIEW_DIR: a wire plug "hides" a part when the ray from any point of the plug, away from the
// camera, reaches the part's body within this distance.
const AWAY = new THREE.Vector3(-85, -200, -190).normalize();
const REACH = 60;

describe('every project is laid out so that nothing is hidden behind a wire plug', () => {
  for (const p of PROJECTS) it(p.id, () => {
    const bodies = partBodies(p.build.parts);
    const hidden: string[] = [];
    for (const w of p.build.wires) for (const end of [w.from, w.to]) {
      if (!end.startsWith('bb.')) continue; // UNO sockets and module pins are not on the breadboard
      const hole = pinWorld(end, p.build.parts);
      for (let y = 0; y <= HOUSING_H; y += 2) {
        const at = hole.clone().setY(hole.y + y);
        const hit = bodies.some((b) => { const q = new THREE.Ray(at, AWAY).intersectBox(b.box, new THREE.Vector3()); return !!q && q.distanceTo(at) < REACH; });
        if (hit) { hidden.push(end); break; }
      }
    }
    expect(hidden, `${p.id}: these plugs stand in front of a part`).toEqual([]);
  });
});
