import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { castAll } from '../shared/geometry';
import { MATERIALS, std } from '../shared/materials';
import { HOUSING_H, jumperCurves } from './jumperCurves';

// Dupont housing: rounded 2.5 x 12 x 2.5 body plus a tapered strain relief.
const housingGeo = mergeGeometries([
  new RoundedBoxGeometry(2.5, HOUSING_H - 2, 2.5, 2, 0.35).translate(0, (HOUSING_H - 2) / 2, 0),
  new THREE.CylinderGeometry(0.95, 1.2, 2.0, 16).translate(0, HOUSING_H - 1, 0),
].map((g) => (g.index ? g.toNonIndexed() : g)));

// Male-male jumper wire between two hole tops given in world coordinates.
export function Jumper({ a, b, color, lift = 22 }: { a: THREE.Vector3; b: THREE.Vector3; color: string; lift?: number }) {
  const group = useMemo(() => {
    const { wire } = jumperCurves(a, b, lift);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(wire, 160, 0.85, 14), std(color, 0.32, 0.05)));
    for (const end of [a, b]) {
      const housing = new THREE.Mesh(housingGeo, MATERIALS.black); housing.position.copy(end).setY(end.y + 0.2);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 3.0, 0.64), MATERIALS.metal); pin.position.copy(end).setY(end.y - 1.2);
      g.add(housing, pin);
    }
    return castAll(g);
  }, [a, b, color, lift]);
  return <primitive object={group} />;
}
