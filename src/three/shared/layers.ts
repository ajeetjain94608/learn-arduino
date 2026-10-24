import type { Object3D } from 'three';

// Objects on this layer are drawn in colour but skipped by the ink-outline normal pass:
// flat decals (silkscreen), glows, particles, the floor grid.
export const LAYER_NO_OUTLINE = 2;

export function noOutline<T extends Object3D>(obj: T): T {
  obj.traverse((o) => o.layers.set(LAYER_NO_OUTLINE));
  return obj;
}
