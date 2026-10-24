import * as THREE from 'three';

export const HOUSING_H = 14; // Dupont housing height above the hole, mm

// Route of a male-male jumper between two hole tops: straight up out of each housing, then a soft arch
// peaking `lift` mm above the taller housing. `path` is the electrical route hole → wire → hole.
export function jumperCurves(a: THREE.Vector3, b: THREE.Vector3, lift: number): { wire: THREE.CatmullRomCurve3; path: THREE.Curve<THREE.Vector3>[] } {
  const up = (p: THREE.Vector3, h: number) => p.clone().setY(p.y + h);
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.max(a.y, b.y) + HOUSING_H + lift;
  const side = new THREE.Vector3().subVectors(b, a).normalize();
  const shoulder = (p: THREE.Vector3, sign: number) => up(p, HOUSING_H + 5).lerp(mid, 0.5).add(side.clone().multiplyScalar(4 * sign)).setY(mid.y - 2);
  const wire = new THREE.CatmullRomCurve3(
    [up(a, HOUSING_H - 0.5), up(a, HOUSING_H + 5), shoulder(a, -1), mid, shoulder(b, 1), up(b, HOUSING_H + 5), up(b, HOUSING_H - 0.5)],
    false, 'centripetal',
  );
  return { wire, path: [new THREE.LineCurve3(a.clone(), up(a, HOUSING_H - 0.5)), wire, new THREE.LineCurve3(up(b, HOUSING_H - 0.5), b.clone())] };
}
