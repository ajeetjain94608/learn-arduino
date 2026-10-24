import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { castAll, instanced, placement, rbox } from '../../../shared/geometry';
import { MATERIALS, std } from '../../../shared/materials';
import { at, chipLabel, leads, PITCH } from './place';

// DIP leg: shoulder out of the body side, then straight down into the board.
const dipLegGeo = mergeGeometries([
  new THREE.BoxGeometry(0.55, 0.32, 1.1).translate(0, 0, 0.55),
  new THREE.BoxGeometry(0.55, 3.0, 0.32).translate(0, -1.35, 1.0),
]);

function atmega328(): THREE.Group {
  const g = new THREE.Group();
  const sock = rbox(36.6, 1.6, 10.0, 0.25, MATERIALS.black); sock.position.y = 0.8;
  const body = rbox(35.4, 3.4, 7.2, 0.5, MATERIALS.chip, 3); body.position.y = 3.5;
  const notch = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 24, 1, false, 0, Math.PI), MATERIALS.black);
  notch.rotation.y = Math.PI / 2; notch.position.set(-17.75, 5.12, 0);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), MATERIALS.black); dot.rotation.x = -Math.PI / 2; dot.position.set(-15.6, 5.21, 2.0);
  const label = chipLabel([['ATMEGA328P-PU', 34], ['AU 1931', 24]], 30, 5.6); label.position.set(0.8, 5.22, 0);
  g.add(sock, body, notch, dot, label);
  const legs: THREE.Matrix4[] = [];
  for (let i = 0; i < 14; i++) {
    const x = (i - 6.5) * PITCH;
    legs.push(placement(new THREE.Vector3(x, 3.3, 3.5), 0), placement(new THREE.Vector3(x, 3.3, -3.5), Math.PI));
  }
  g.add(instanced(dipLegGeo, MATERIALS.metal, legs));
  return castAll(g);
}

// ATmega16U2 in MLF32 (QFN 5x5): leadless, the board pads are its contacts.
function atmega16u2(): THREE.Group {
  const g = new THREE.Group();
  const body = rbox(4.9, 0.9, 4.9, 0.12, MATERIALS.chip); body.position.y = 0.45;
  const label = chipLabel([['MEGA16U2', 64], ['MU 1928', 44]], 4.2, 2.6); label.position.y = 0.91;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), std('#15171C', 0.5)); dot.rotation.x = -Math.PI / 2; dot.position.set(-1.8, 0.912, 1.8);
  g.add(body, label, dot);
  return g;
}

function smdBody(w: number, d: number, h: number, text: string): THREE.Group {
  const g = new THREE.Group();
  const body = rbox(w, h, d, 0.12, MATERIALS.chip); body.position.y = h / 2 + 0.1; g.add(body);
  if (text) { const l = chipLabel([[text, 70]], w * 0.8, d * 0.4); l.position.y = h + 0.12; g.add(l); }
  return g;
}

export function buildIcs(board: THREE.Object3D): void {
  at(board, 'ZU4', atmega328());
  at(board, 'U3', atmega16u2());
  const leaded: [name: string, w: number, d: number, h: number, text: string, half: number][] = [
    ['U5', 3.0, 3.0, 0.95, 'V358', 1.5],     // LMV358 op-amp, MSOP-8
    ['U1', 6.5, 3.5, 1.65, 'NCP1117', 1.75], // 5 V regulator, SOT-223
    ['U2', 2.9, 1.6, 1.0, 'LP2985', 0.8],    // 3.3 V regulator, SOT-23-5
    ['T1', 2.9, 1.3, 1.0, '', 0.65],         // FDN340P MOSFET, SOT-23
  ];
  for (const [name, w, d, h, text, half] of leaded) {
    at(board, name, smdBody(w, d, h, text));
    leads(board, name, h, half);
  }
}
