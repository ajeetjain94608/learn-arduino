import * as THREE from 'three';
import { instanced, rbox } from '../../../shared/geometry';
import { MATERIALS } from '../../../shared/materials';
import { padsOf } from '../layout';
import { P, PITCH, partFor, put } from './place';

export const HEADER_H = 8.5;

const sorted = (name: string) => [...padsOf(name)].sort((a, b) => a.x - b.x || a.y - b.y);
const bbox = (pts: { x: number; y: number }[]) => ({
  x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
  y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
});

// Female headers over the real pad rows, and the two male ICSP headers — each its own inspectable part.
export function buildHeaders(board: THREE.Object3D): void {
  for (const name of ['IOH', 'IOL', 'POWER', 'AD']) {
    const pts = sorted(name), b = bbox(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const part = partFor(board, name, P(cx, cy, 0));
    put(part, rbox(b.x1 - b.x0 + PITCH - 0.1, HEADER_H, b.y1 - b.y0 + PITCH, 0.3, MATERIALS.header), cx, cy, HEADER_H / 2);
    const holes = instanced(new THREE.BoxGeometry(1.05, 0.02, 1.05), MATERIALS.hole, pts.map((p) => new THREE.Matrix4().makeTranslation(P(p.x, p.y, HEADER_H + 0.005))));
    holes.castShadow = false;
    part.add(holes);
  }
  for (const name of ['ICSP', 'ICSP1']) {
    const pts = sorted(name), b = bbox(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const part = partFor(board, name, P(cx, cy, 0));
    put(part, rbox(b.x1 - b.x0 + PITCH, 2.5, b.y1 - b.y0 + PITCH, 0.2, MATERIALS.black), cx, cy, 1.25);
    part.add(instanced(new THREE.BoxGeometry(0.64, 6.0, 0.64), MATERIALS.metal, pts.map((p) => new THREE.Matrix4().makeTranslation(P(p.x, p.y, 5.5)))));
  }
}
