import { useEffect } from 'react';
import * as THREE from 'three';
import { makeCanvasTexture } from '../../../shared/canvasTexture';
import { castAll, disposeOwned, rbox } from '../../../shared/geometry';
import { LAYER_NO_OUTLINE, noOutline } from '../../../shared/layers';
import { MATERIALS, std } from '../../../shared/materials';

// Shared bits of the sensing modules (HC-SR04, OLED, soil sensor): header pins, silkscreen decals, clean-up.

export const PITCH = 2.54;
export const noRay = <T extends THREE.Object3D>(o: T): T => { o.traverse((c) => { c.raycast = () => {}; }); return o; };

// Shadows for the solid parts; decals and glows (not outlined) cast none.
export function castSolid<T extends THREE.Object3D>(o: T): T {
  castAll(o);
  o.traverse((m) => { if (m.layers.isEnabled(LAYER_NO_OUTLINE) && !m.layers.isEnabled(0)) { m.castShadow = false; m.receiveShadow = false; } });
  return o;
}

// Frees what a model owns when it goes away (never the shared palette).
export function useDisposeOwned(root: THREE.Object3D, keep: Set<object> = KEEP) {
  useEffect(() => () => disposeOwned(root, keep), [root, keep]);
}

// A pin of square 0.64 mm wire from y0 up to y1 (a chamfered tip at the top), centred at x, z.
export function pinMesh(x: number, z: number, y0: number, y1: number, mat: THREE.Material = MATERIALS.tin): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.64, y1 - y0 - 0.3, 0.64), mat); shaft.position.set(x, (y0 + y1 - 0.3) / 2, z);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 0.3, 4, 1).rotateY(Math.PI / 4), mat); tip.position.set(x, y1 - 0.15, z);
  g.add(shaft, tip);
  return g;
}

// A horizontal pin segment (a right-angle header's short leg) from z0 to z1 at height y.
export function legZ(x: number, y: number, z0: number, z1: number, mat: THREE.Material = MATERIALS.tin): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.64, Math.abs(z1 - z0)), mat); m.position.set(x, y, (z0 + z1) / 2);
  return m;
}

// A black 2.54 mm header strip: n positions centred on x0, its plastic from y0 to y0 + h, depth d at z.
export function headerPlastic(n: number, x0: number, y0: number, z: number, h = 2.5, d = 2.5): THREE.Mesh {
  const m = rbox(n * PITCH, h, d, 0.25, MATERIALS.header); m.position.set(x0, y0 + h / 2, z);
  return m;
}

// A solder joint: a low tin cone around a pin, standing on a face whose normal is `up` (default +y).
export function solderJoint(): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.75, 0.55, 14), MATERIALS.tin);
}

// A printed decal (silkscreen, labels): a transparent plane `w` × `h` mm drawn at `pxPerMm`. Lies in the xy plane,
// facing +z; rotate it into place. Not outlined, not tappable.
export function decal(w: number, h: number, pxPerMm: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void): THREE.Mesh {
  const W = Math.round(w * pxPerMm), H = Math.round(h * pxPerMm);
  const tex = makeCanvasTexture(W, H, (c) => { c.clearRect(0, 0, W, H); draw(c, W, H); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.renderOrder = 1;
  return noRay(noOutline(m));
}

// Silkscreen helpers for decals (canvas units: px, the decal's own mm × pxPerMm).
export const SILK = '#F2F2EE';
export function silkText(c: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, weight = 700, color = SILK, align: CanvasTextAlign = 'center') {
  c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
  c.font = `${weight} ${px}px "Segoe UI", Roboto, Arial, sans-serif`;
  c.fillText(text, x, y);
}
// a plated mounting hole: tin ring and the dark hole
export function silkHole(c: CanvasRenderingContext2D, x: number, y: number, rHole: number, rRing: number) {
  c.fillStyle = '#D9DDE2'; c.beginPath(); c.arc(x, y, rRing, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#0B0C10'; c.beginPath(); c.arc(x, y, rHole, 0, Math.PI * 2); c.fill();
}

// A small SMD part (resistor / capacitor) lying on a face: body with tinned ends. Built along x; `w` long.
export function smd(w: number, d: number, h: number, body: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const b = rbox(w * 0.6, h, d, 0.08, body); b.position.y = h / 2; g.add(b);
  for (const s of [-1, 1]) { const e = rbox(w * 0.2, h, d, 0.06, MATERIALS.tin); e.position.set(s * w * 0.4, h / 2, 0); g.add(e); }
  return g;
}
export const SMD_RES = std('#1E2026', 0.6);
export const SMD_CAP = std('#B59A72', 0.65);
// shared materials no model may free
export const KEEP: Set<object> = new Set<object>([...Object.values(MATERIALS), SMD_RES, SMD_CAP]);

// An SOIC chip lying on a face (+y up): black body with gull-wing leads along both long sides.
export function soic(pinsPerSide: number, len: number, wid: number, label?: string): THREE.Group {
  const g = new THREE.Group();
  const body = rbox(len, 1.45, wid, 0.15, MATERIALS.chip); body.position.y = 0.2 + 0.725; g.add(body);
  for (let i = 0; i < pinsPerSide; i++) for (const s of [-1, 1]) {
    const lead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 1.0), MATERIALS.tin);
    lead.position.set((i - (pinsPerSide - 1) / 2) * 1.27, 0.15, s * (wid / 2 + 0.4)); g.add(lead);
  }
  if (label) {
    const d = decal(len * 0.8, wid * 0.5, 40, (c, W, H) => silkText(c, label, W / 2, H / 2, H * 0.55, 600, 'rgba(190,195,205,0.55)'));
    d.rotation.x = -Math.PI / 2; d.position.y = 1.67; g.add(d);
  }
  return g;
}
