import { useEffect } from 'react';
import * as THREE from 'three';
import { makeCanvasTexture } from '../../../shared/canvasTexture';
import { disposeOwned, rbox } from '../../../shared/geometry';
import { noOutline } from '../../../shared/layers';
import { MATERIALS } from '../../../shared/materials';

// Small shared helpers for the motion modules (DC motor, servo, stepper).

export const PITCH = 2.54;
// the shared palette is never disposed with a model
export const KEEP: Set<object> = new Set(Object.values(MATERIALS));

// Frees what a model built for itself when it unmounts (or rebuilds).
export function useDisposeOwned(root: THREE.Object3D): void {
  useEffect(() => () => disposeOwned(root, KEEP), [root]);
}

export const noPick = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => { c.raycast = () => {}; });
  return o;
};

// One straight male header pin: a black plastic spacer from `baseY` and a tinned square pin whose tip is exactly at
// (x, tipY, z). `under` mm of pin also go down below the spacer (into a PCB).
export function headerPin(x: number, tipY: number, z: number, baseY: number, under = 1.6): THREE.Group {
  const g = new THREE.Group();
  const spacer = rbox(PITCH - 0.06, 2.5, PITCH - 0.06, 0.25, MATERIALS.header); spacer.position.set(x, baseY + 1.25, z);
  const len = tipY - baseY + under - 0.35;
  const pin = new THREE.Mesh(new THREE.BoxGeometry(0.64, len, 0.64), MATERIALS.tin); pin.position.set(x, baseY - under + len / 2, z);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 0.35, 4, 1), MATERIALS.tin); tip.rotation.y = Math.PI / 4;
  tip.position.set(x, tipY - 0.175, z);
  g.add(spacer, pin, tip);
  return g;
}

// A round insulated wire along a smooth path.
export function wire(points: [number, number, number][], color: string, radius = 0.55, segments = 48): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// A flat printed decal (silkscreen, a printed card) lying in the XZ plane, facing up; drawn with `draw` on a canvas
// `px` pixels per mm.
export function decal(w: number, d: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, px = 24): THREE.Mesh {
  const tex = makeCanvasTexture(Math.round(w * px), Math.round(d * px), (ctx) => { ctx.scale(px, px); draw(ctx, px); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return noPick(noOutline(m));
}

// Rate-independent exponential approach: how much of the remaining gap to close this frame.
export const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

// A flat cable of parallel wires following one centre path; wire i sits (i − (n−1)/2)·gap to the right of the path
// (the right of its direction of travel, seen from above).
export function ribbon(path: [number, number, number][], colors: string[], gap = 1.1, radius = 0.5): THREE.Group {
  const centre = new THREE.CatmullRomCurve3(path.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const pts = centre.getSpacedPoints(80);
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(1, 0, 0), t = new THREE.Vector3(), s = new THREE.Vector3();
  const sides = pts.map((_, i) => {
    t.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
    s.crossVectors(t, up);
    if (s.length() > 0.25) side.copy(s).normalize();
    return side.clone();
  });
  const g = new THREE.Group();
  colors.forEach((c, k) => {
    const o = (k - (colors.length - 1) / 2) * gap;
    const curve = new THREE.CatmullRomCurve3(pts.map((p, i) => p.clone().addScaledVector(sides[i], o)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
    m.castShadow = m.receiveShadow = true;
    m.raycast = () => {};
    g.add(m);
  });
  return g;
}
