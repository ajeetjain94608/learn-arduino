import * as THREE from 'three';

export function makeCanvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void, anisotropy = 8): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}
