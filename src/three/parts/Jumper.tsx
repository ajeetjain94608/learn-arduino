import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { castAll, disposeOwned } from '../shared/geometry';
import { MATERIALS, std } from '../shared/materials';
import { HOUSING_H, jumperCurves } from './jumperCurves';
import { slotOf, slotProgress, useAssemblyClock, type StepRef } from '../scenes/assembly';
import type { Route } from '../build/wireRoute';

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

// Dupont housing: rounded 2.5 x 12 x 2.5 body plus a tapered strain relief.
const housingGeo = mergeGeometries([
  new RoundedBoxGeometry(2.5, HOUSING_H - 2, 2.5, 2, 0.35).translate(0, (HOUSING_H - 2) / 2, 0),
  new THREE.CylinderGeometry(0.95, 1.2, 2.0, 16).translate(0, HOUSING_H - 1, 0),
].map((g) => (g.index ? g.toNonIndexed() : g)));

// Male-male jumper wire between two hole tops given in world coordinates. With `route` (Build), the path comes from
// the wire router; a 'flat' route is a pre-cut jumper lying on the breadboard (thin solid wire, bare bent ends).
// With `step`, it draws itself during the circuit build: plug at the start end, the wire grows along its
// path, then the far plug appears. `fromB` draws from b to a (so every wire starts at the board).
export function Jumper({ a, b, color, lift = 22, step, fromB = false, route }: { a: THREE.Vector3; b: THREE.Vector3; color: string; lift?: number; step?: StepRef; fromB?: boolean; route?: Route }) {
  const clock = useAssemblyClock();
  const fx = useMemo(() => {
    const wire = route?.curve ?? jumperCurves(a, b, lift).wire;
    const flat = route?.kind === 'flat';
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(wire, flat ? 48 : 160, flat ? 0.5 : 0.85, flat ? 10 : 14), std(color, 0.32, 0.05));
    g.add(tube);
    const ends = [a, b].map((end, i) => {
      const out = route?.outs?.[i];
      if (out) { // a part standing on the table: just the bare end of the wire touching the leg, no plug (it would look like a short)
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 10), MATERIALS.metal); tip.position.y = 2.3;
        const plug = new THREE.Group(); plug.add(tip);
        plug.position.copy(end); plug.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
        g.add(plug);
        return plug;
      }
      if (flat) { // the bare tip going into the hole
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3, 8), MATERIALS.metal); tip.position.copy(end).setY(end.y - 0.6);
        const plug = new THREE.Group(); plug.add(tip); g.add(plug);
        return plug;
      }
      const housing = new THREE.Mesh(housingGeo, MATERIALS.black); housing.position.copy(end).setY(end.y + 0.2);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 3.0, 0.64), MATERIALS.metal); pin.position.copy(end).setY(end.y - 1.2);
      const plug = new THREE.Group(); plug.add(housing, pin); g.add(plug);
      return plug;
    });
    return { group: castAll(g), tube, start: ends[fromB ? 1 : 0], end: ends[fromB ? 0 : 1], total: tube.geometry.index!.count };
  }, [a, b, color, lift, fromB, route]);

  useEffect(() => () => disposeOwned(fx.group, new Set<object>([housingGeo, MATERIALS.black, MATERIALS.metal])), [fx]); // a rerouted wire frees its old tube

  useFrame(() => {
    if (!step) return;
    const p = easeInOut(slotProgress(clock.t, slotOf(step)));
    const n = Math.round((fx.total * p) / 6) * 6; // whole quads (two triangles), in path order
    fx.tube.geometry.setDrawRange(fromB ? fx.total - n : 0, n);
    fx.tube.visible = n > 0;
    fx.start.visible = p > 0;
    fx.end.visible = p >= 0.98;
  });
  return <primitive object={fx.group} />;
}
