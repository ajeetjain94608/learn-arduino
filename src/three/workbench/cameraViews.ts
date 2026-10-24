export type View = 'board' | 'circuit';
type Vec3 = [number, number, number];

// Camera direction (from target) and per-view framing, as approved in the 3D spike.
export const VIEW_DIR: Vec3 = [85, 200, 190];
export const VIEWS: Record<View, { target: Vec3; zoom: number }> = {
  board: { target: [-37, 3, 4], zoom: 1.55 },
  circuit: { target: [4, 0, 5], zoom: 1.0 },
};

// Orthographic half-extents (mm) that keep ~190 x 128 mm of workbench in view at zoom 1.
export function fitOrtho(aspect: number): { halfW: number; halfH: number } {
  const halfH = Math.max(128, 190 / aspect) / 2;
  return { halfH, halfW: halfH * aspect };
}
