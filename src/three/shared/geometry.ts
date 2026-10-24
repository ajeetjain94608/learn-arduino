import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Rounded box mesh; the radius is clamped so it never exceeds half of any side.
export function rbox(w: number, h: number, d: number, r: number, material: THREE.Material, segments = 2): THREE.Mesh {
  const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, radius), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function placement(pos: THREE.Vector3, rotY = 0, scale?: THREE.Vector3): THREE.Matrix4 {
  return new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rotY), scale ?? new THREE.Vector3(1, 1, 1));
}

export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function castAll<T extends THREE.Object3D>(o: T): T {
  o.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}
