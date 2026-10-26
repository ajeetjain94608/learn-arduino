export type View = 'board' | 'circuit' | 'bench';
type Vec3 = [number, number, number];

// Camera direction (from target) and per-view framing, as approved in the 3D spike.
export const VIEW_DIR: Vec3 = [85, 200, 190];
export const VIEWS: Record<View, { target: Vec3; zoom: number }> = {
  board: { target: [-37, 3, 4], zoom: 1.55 },
  circuit: { target: [4, 0, 5], zoom: 1.0 },
  bench: { target: [28, 0, -8], zoom: 0.78 }, // Build with modules: the UNO, the breadboard and the bench around them
};

// Orthographic half-extents (mm) that keep ~190 x 128 mm of workbench in view at zoom 1.
export function fitOrtho(aspect: number): { halfW: number; halfH: number } {
  const halfH = Math.max(128, 190 / aspect) / 2;
  return { halfH, halfW: halfH * aspect };
}

export const MIN_ZOOM = 0.7, MAX_ZOOM = 7;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

// Camera position after orbiting `angle` radians about the target's vertical axis (height unchanged).
export function orbitAround(pos: Vec3, target: Vec3, angle: number): Vec3 {
  const dx = pos[0] - target[0], dz = pos[2] - target[2], c = Math.cos(angle), s = Math.sin(angle);
  return [target[0] + dx * c + dz * s, pos[1], target[2] - dx * s + dz * c];
}
