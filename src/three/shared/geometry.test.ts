// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { disposeOwned } from './geometry';

describe('disposeOwned', () => {
  it('frees owned geometry, materials and textures, and leaves shared ones alone', () => {
    const tex = new THREE.Texture(), shared = new THREE.MeshBasicMaterial();
    const own = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: tex }));
    const other = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const g = new THREE.Group(); g.add(own, other);
    const spies = [vi.spyOn(own.geometry, 'dispose'), vi.spyOn(own.material, 'dispose'), vi.spyOn(tex, 'dispose')];
    const kept = vi.spyOn(shared, 'dispose');
    disposeOwned(g, new Set([shared]));
    for (const s of spies) expect(s).toHaveBeenCalled();
    expect(kept).not.toHaveBeenCalled();
  });
});
