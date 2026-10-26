import * as THREE from 'three';
export type View = 'board' | 'circuit' | 'bench';
type Vec3 = [number, number, number];

// Camera direction (from target) and per-view framing, as approved in the 3D spike.
export const VIEW_DIR: Vec3 = [85, 200, 190];
export const VIEWS: Record<View, { target: Vec3; zoom: number }> = {
  board: { target: [-37, 3, 4], zoom: 1.55 },
  circuit: { target: [4, 0, 5], zoom: 1.0 },
  bench: { target: [24, 12, -20], zoom: 0.66 }, // Build with modules: the UNO, the breadboard and the bench around them
};

// Orthographic half-extents (mm) that keep ~190 x 128 mm of workbench in view at zoom 1.
export function fitOrtho(aspect: number): { halfW: number; halfH: number } {
  const halfH = Math.max(128, 190 / aspect) / 2;
  return { halfH, halfW: halfH * aspect };
}

// Far out enough to see a whole bench with its props (the lamp, the hairdryer, the toy car) beyond the breadboard.
export const MIN_ZOOM = 0.25, MAX_ZOOM = 7;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

// Camera position after orbiting `angle` radians about the target's vertical axis (height unchanged).
export function orbitAround(pos: Vec3, target: Vec3, angle: number): Vec3 {
  const dx = pos[0] - target[0], dz = pos[2] - target[2], c = Math.cos(angle), s = Math.sin(angle);
  return [target[0] + dx * c + dz * s, pos[1], target[2] - dx * s + dz * c];
}

// "Fit everything": the camera target and zoom that put the whole box in view (seen from the usual direction), with
// `pad` of room round it. Nothing leaves the view; the zoom stays inside the allowed range.
export function fitView(box: THREE.Box3, aspect: number, pad = 0.08, dir: Vec3 = VIEW_DIR): { target: Vec3; zoom: number } {
  const z = new THREE.Vector3(...dir).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
  const up = new THREE.Vector3().crossVectors(z, right);
  const c = box.getCenter(new THREE.Vector3());
  let lox = Infinity, hix = -Infinity, loy = Infinity, hiy = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const zz of [box.min.z, box.max.z]) {
    const d = new THREE.Vector3(x, y, zz).sub(c);
    lox = Math.min(lox, d.dot(right)); hix = Math.max(hix, d.dot(right));
    loy = Math.min(loy, d.dot(up)); hiy = Math.max(hiy, d.dot(up));
  }
  // moving the target by the bounds' offset in view space centres them on the screen
  const target = c.clone().addScaledVector(right, (hix + lox) / 2).addScaledVector(up, (hiy + loy) / 2);
  const { halfW, halfH } = fitOrtho(aspect);
  const zoom = clampZoom(Math.min(halfW / (((hix - lox) / 2) * (1 + pad)), halfH / (((hiy - loy) / 2) * (1 + pad))));
  return { target: target.toArray() as Vec3, zoom };
}
