import { useEffect } from 'react';
import * as THREE from 'three';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { disposeOwned } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';

// Small helpers shared by the breadboard part models.

export const PITCH = 2.54;

// The shared palette is never disposed with a part.
export const KEEP = new Set<object>(Object.values(MATERIALS));

// Frees what a part's model owns (geometries, its own materials and textures) when it leaves the bench.
export function useDisposeOnUnmount(...roots: THREE.Object3D[]) {
  useEffect(() => () => roots.forEach((r) => disposeOwned(r, KEEP)), roots);
}

// A round wire lead following points (breadboard-local mm), bent smoothly — e.g. out of a body and down into a hole.
export function lead(points: [number, number, number][], r = 0.25, material: THREE.Material = MATERIALS.metal): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 10), r, 8), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// A soft white radial glow (tinted by the sprite material's colour).
export function glowTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(128, 128, (ctx) => {
    const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  });
}

// A glow sprite: light, not a thing you can tap or outline.
export function glowSprite(map: THREE.Texture, size: number, color = '#ffffff'): THREE.Sprite {
  const s = noOutline(new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, opacity: 0 })));
  s.scale.set(size, size, 1);
  s.raycast = () => {};
  return s;
}

// A flat printed decal (a canvas texture on a plane facing +z), drawn without an ink outline.
export function decal(map: THREE.Texture, w: number, h: number, roughness = 0.8): THREE.Mesh {
  const mat = std('#ffffff', roughness, 0, { map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = noOutline(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));
  m.raycast = () => {};
  return m;
}

// Small printed text, centred on a transparent canvas (`lines` top to bottom).
export function printTexture(w: number, h: number, lines: { text: string; size: number; weight?: number }[], color = '#D9DCE0'): THREE.CanvasTexture {
  return makeCanvasTexture(w, h, (ctx) => {
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const total = lines.reduce((s, l) => s + l.size * 1.15, 0);
    let y = (h - total) / 2;
    for (const l of lines) {
      ctx.font = `${l.weight ?? 600} ${l.size}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillText(l.text, w / 2, y + (l.size * 1.15) / 2);
      y += l.size * 1.15;
    }
  });
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
