import * as THREE from 'three';

export const FLOW_COLOR = '#3FE9FF';

export function buildLoop(segments: THREE.Curve<THREE.Vector3>[]): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  segments.forEach((s) => path.add(s));
  return path;
}

const tmp = new THREE.Vector3();
// Writes `count` evenly spaced points (arc-length) into `out`; `t` is in loops, so t and t+1 coincide.
export function electronPositions(path: THREE.CurvePath<THREE.Vector3>, count: number, t: number, out: Float32Array): void {
  const shift = t - Math.floor(t);
  for (let i = 0; i < count; i++) {
    path.getPointAt((i / count + shift) % 1, tmp);
    out[i * 3] = tmp.x; out[i * 3 + 1] = tmp.y; out[i * 3 + 2] = tmp.z;
  }
}
