import * as THREE from 'three';
import { makeCanvasTexture } from '../../../shared/canvasTexture';
import { instanced, Y_AXIS } from '../../../shared/geometry';
import { MATERIALS } from '../../../shared/materials';
import { makePart } from '../../../inspect/findPart';
import { PART_OF } from '../../../inspect/partCatalog';
import { boardToLocal, element, smdOf } from '../layout';

export const DEG = Math.PI / 180;
export const PITCH = 2.54;

// Board-mm point → board-local scene position.
export const P = (x: number, y: number, h = 0) => new THREE.Vector3(...boardToLocal(x, y, h));

export function put<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x: number, y: number, h = 0): T {
  obj.position.copy(P(x, y, h));
  parent.add(obj);
  return obj;
}

// An inspectable part for one board element: build its meshes into the returned group (board coordinates);
// hover/tap lifts and scales it about `center` (default: the element's origin on the board surface).
export function partFor(board: THREE.Object3D, name: string, center?: THREE.Vector3): THREE.Group {
  const e = element(name);
  return makePart(board, name, PART_OF[name], center ?? P(e.x, e.y, 0));
}

// Places an object at an element's origin with its rotation (EAGLE "R90" = counter-clockwise from above = +Y here).
export function at<T extends THREE.Object3D>(parent: THREE.Object3D, name: string, obj: T, h = 0): T {
  const e = element(name);
  obj.position.copy(P(e.x, e.y, h));
  obj.rotation.y = e.rot * DEG;
  parent.add(obj);
  return obj;
}

// Gull-wing leads for a leaded SMD package: a tinned foot on each pad plus a shoulder back to the body.
export function leads(parent: THREE.Object3D, name: string, bodyHeight: number, bodyHalf: number): void {
  const e = element(name), feet: THREE.Matrix4[] = [], shoulders: THREE.Matrix4[] = [];
  for (const p of smdOf(name)) {
    const vx = p.x - e.x, vy = p.y - e.y, len = Math.hypot(vx, vy);
    if (len < 0.3) continue;
    const ux = vx / len, uy = vy / len;
    const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.atan2(uy, ux));
    const footLen = Math.min(Math.max(p.dx, p.dy) * 0.7, 1.0), footW = Math.min(p.dx, p.dy) * 0.7;
    feet.push(new THREE.Matrix4().compose(P(p.x - ux * 0.1, p.y - uy * 0.1, 0.09), q, new THREE.Vector3(footLen, 0.18, footW)));
    const sLen = Math.max(len - bodyHalf - footLen / 2, 0.15);
    const sx = e.x + ux * (bodyHalf + sLen / 2), sy = e.y + uy * (bodyHalf + sLen / 2);
    shoulders.push(new THREE.Matrix4().compose(P(sx, sy, bodyHeight * 0.42), q, new THREE.Vector3(sLen + 0.2, 0.16, footW)));
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  parent.add(instanced(unit, MATERIALS.metal, feet), instanced(unit, MATERIALS.metal, shoulders));
}

// Faint laser-etched marking on a chip top (a flat decal, lying in the XZ plane).
export function chipLabel(lines: [text: string, size: number][], w: number, d: number): THREE.Mesh {
  const tex = makeCanvasTexture(512, Math.round((512 * d) / w), (c, cv) => {
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(170,176,188,0.6)'; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach(([t, size], i) => { c.font = `600 ${size}px ui-monospace, Consolas, monospace`; c.fillText(t, cv.width / 2, cv.height * (0.5 + (i - (lines.length - 1) / 2) * 0.32)); });
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
