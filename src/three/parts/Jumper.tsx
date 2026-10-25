import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { castAll } from '../shared/geometry';
import { MATERIALS, std } from '../shared/materials';
import { HOUSING_H, jumperCurves } from './jumperCurves';
import { ASSEMBLY, slotProgress, useAssemblyClock, type AssemblyStep } from '../scenes/assembly';

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

// Dupont housing: rounded 2.5 x 12 x 2.5 body plus a tapered strain relief.
const housingGeo = mergeGeometries([
  new RoundedBoxGeometry(2.5, HOUSING_H - 2, 2.5, 2, 0.35).translate(0, (HOUSING_H - 2) / 2, 0),
  new THREE.CylinderGeometry(0.95, 1.2, 2.0, 16).translate(0, HOUSING_H - 1, 0),
].map((g) => (g.index ? g.toNonIndexed() : g)));

// Male-male jumper wire between two hole tops given in world coordinates.
// With `step`, it draws itself during the circuit build: plug at the start end, the wire grows along its
// path, then the far plug appears. `fromB` draws from b to a (so every wire starts at the board).
export function Jumper({ a, b, color, lift = 22, step, fromB = false }: { a: THREE.Vector3; b: THREE.Vector3; color: string; lift?: number; step?: AssemblyStep; fromB?: boolean }) {
  const clock = useAssemblyClock();
  const fx = useMemo(() => {
    const { wire } = jumperCurves(a, b, lift);
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(wire, 160, 0.85, 14), std(color, 0.32, 0.05));
    g.add(tube);
    const ends = [a, b].map((end) => {
      const housing = new THREE.Mesh(housingGeo, MATERIALS.black); housing.position.copy(end).setY(end.y + 0.2);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 3.0, 0.64), MATERIALS.metal); pin.position.copy(end).setY(end.y - 1.2);
      const plug = new THREE.Group(); plug.add(housing, pin); g.add(plug);
      return plug;
    });
    return { group: castAll(g), tube, start: ends[fromB ? 1 : 0], end: ends[fromB ? 0 : 1], total: tube.geometry.index!.count };
  }, [a, b, color, lift, fromB]);

  useFrame(() => {
    if (!step) return;
    const p = easeInOut(slotProgress(clock.t, ASSEMBLY[step]));
    const n = Math.round((fx.total * p) / 6) * 6; // whole quads (two triangles), in path order
    fx.tube.geometry.setDrawRange(fromB ? fx.total - n : 0, n);
    fx.tube.visible = n > 0;
    fx.start.visible = p > 0;
    fx.end.visible = p >= 0.98;
  });
  return <primitive object={fx.group} />;
}
