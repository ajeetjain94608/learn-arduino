import * as THREE from 'three';
import { MATERIALS } from '../../../shared/materials';
import { LAYOUT, outlineLoop, UNO } from '../layout';

// Board outline (with the UNO's stepped right edge) and its mounting holes, in board mm.
export function buildPcbShape(): THREE.Shape {
  const loop = outlineLoop();
  const s = new THREE.Shape();
  s.moveTo(loop[0].x, loop[0].y);
  loop.forEach((v, i) => {
    const next = loop[(i + 1) % loop.length];
    if (v.arc) s.quadraticCurveTo(v.arc.cx, v.arc.cy, next.x, next.y);
    else s.lineTo(next.x, next.y);
  });
  for (const [x, y, drill] of LAYOUT.holes) {
    const h = new THREE.Path();
    h.absarc(x, y, drill / 2, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}

// Extruded PCB in board-local scene coordinates (see boardToLocal).
export function buildPcbMesh(): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(buildPcbShape(), { depth: UNO.T - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(-UNO.L / 2, 0.15, UNO.W / 2);
  const m = new THREE.Mesh(g, [MATERIALS.pcb, MATERIALS.pcbEdge]);
  m.castShadow = m.receiveShadow = true;
  return m;
}
