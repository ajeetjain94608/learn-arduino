import { useMemo } from 'react';
import * as THREE from 'three';
import { BB, holeLocal, type Row } from '../breadboard/breadboardGeometry';
import { castAll } from '../shared/geometry';
import { MATERIALS, std } from '../shared/materials';

type Hole = [col: number, row: Row];
const BODY_LIFT = 3.4;

// Leg path in breadboard-local mm: down into `from`, along the body, down into `to`.
export function resistorLegCurve(from: Hole, to: Hole): THREE.CatmullRomCurve3 {
  const [x1, , z1] = holeLocal(...from), [x2, , z2] = holeLocal(...to), top = BB.H + BODY_LIFT;
  const ux = Math.sign(x2 - x1) * 0.8;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(x1, BB.H - 0.5, z1), new THREE.Vector3(x1, top - 0.8, z1), new THREE.Vector3(x1 + ux, top, z1),
    new THREE.Vector3(x2 - ux, top, z2), new THREE.Vector3(x2, top - 0.8, z2), new THREE.Vector3(x2, BB.H - 0.5, z2),
  ], false, 'centripetal');
}

const PROFILE = [[0, -3.2], [0.9, -3.2], [1.15, -2.9], [1.2, -2.1], [1.0, -1.5], [0.95, 0], [1.0, 1.5], [1.2, 2.1], [1.15, 2.9], [0.9, 3.2], [0, 3.2]]
  .map(([r, y]) => new THREE.Vector2(r, y));

// Through-hole resistor lying flat between two holes in the same row. Default bands: 220 Ω ±5%.
export function Resistor({ from, to, bands = ['#D8342B', '#D8342B', '#7A4A24', '#C9A140'] }: { from: Hole; to: Hole; bands?: string[] }) {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const curve = resistorLegCurve(from, to);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.25, 8), MATERIALS.metal));
    const a = holeLocal(...from), b = holeLocal(...to);
    const cx = (a[0] + b[0]) / 2, z = a[2], top = BB.H + BODY_LIFT;
    const bodyGeo = new THREE.LatheGeometry(PROFILE, 32); bodyGeo.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, std('#E3CFA3', 0.6)); body.position.set(cx, top, z); g.add(body);
    const offsets = [-2.2, -1.2, -0.2, 2.1];
    bands.forEach((col, i) => {
      const r = Math.abs(offsets[i]) > 1.8 ? 1.22 : 1.0;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 32), std(col, 0.55, i === 3 ? 0.5 : 0));
      band.rotation.z = Math.PI / 2; band.position.set(cx + offsets[i], top, z); g.add(band);
    });
    return castAll(g);
  }, [from, to, bands]);
  return <primitive object={group} />;
}
