import * as THREE from 'three';
import { instanced, rbox } from '../../../shared/geometry';
import { MATERIALS } from '../../../shared/materials';
import { headerRow, padsOf } from '../layout';
import { P, PITCH, put } from './place';

export const HEADER_H = 8.5;

const padsSorted = (name: string) => [...padsOf(name)].sort((a, b) => a.x - b.x || a.y - b.y);

const bbox = (pts: { x: number; y: number }[]) => ({
  x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
  y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
});

// Female headers over the real pad rows, and the two male ICSP headers.
export function buildHeaders(): THREE.Group {
  const g = new THREE.Group();
  const holes: THREE.Matrix4[] = [];
  for (const name of ['IOH', 'IOL', 'POWER', 'AD'] as const) {
    const pts = headerRow(name), b = bbox(pts);
    put(g, rbox(b.x1 - b.x0 + PITCH - 0.1, HEADER_H, b.y1 - b.y0 + PITCH, 0.3, MATERIALS.header), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, HEADER_H / 2);
    pts.forEach((p) => holes.push(new THREE.Matrix4().makeTranslation(P(p.x, p.y, HEADER_H + 0.005))));
  }
  const holeMesh = instanced(new THREE.BoxGeometry(1.05, 0.02, 1.05), MATERIALS.hole, holes);
  holeMesh.castShadow = false;
  g.add(holeMesh);

  const pins: THREE.Matrix4[] = [];
  for (const name of ['ICSP', 'ICSP1']) {
    const pts = padsSorted(name), b = bbox(pts);
    put(g, rbox(b.x1 - b.x0 + PITCH, 2.5, b.y1 - b.y0 + PITCH, 0.2, MATERIALS.black), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 1.25);
    pts.forEach((p) => pins.push(new THREE.Matrix4().makeTranslation(P(p.x, p.y, 5.5))));
  }
  g.add(instanced(new THREE.BoxGeometry(0.64, 6.0, 0.64), MATERIALS.metal, pins));
  return g;
}
