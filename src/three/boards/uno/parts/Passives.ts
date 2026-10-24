import * as THREE from 'three';
import { makeCanvasTexture } from '../../../shared/canvasTexture';
import { castAll, rbox } from '../../../shared/geometry';
import { MATERIALS, std } from '../../../shared/materials';
import { smdOf, topElements } from '../layout';
import { at, P } from './place';

const capMat = std('#C9A56E', 0.6), resMat = std('#1E2127', 0.55), ferriteMat = std('#3B3E45', 0.6), varMat = std('#8C7B66', 0.6);

// A two-terminal SMD part laid along the line between its two pads.
function twoPad(board: THREE.Object3D, name: string, width: number, height: number, bodyMat: THREE.Material, endFrac = 0.22): THREE.Group | null {
  const [a, b] = smdOf(name);
  if (!a || !b) return null;
  const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.min(a.dx, a.dy) * 0.9;
  const g = new THREE.Group();
  const body = rbox(len * (1 - 2 * endFrac) + 0.05, height, width, 0.06, bodyMat); body.position.y = height / 2; g.add(body);
  for (const s of [-1, 1]) {
    const e = rbox(len * endFrac, height + 0.02, width + 0.02, 0.05, MATERIALS.tin);
    e.position.set(s * (len / 2 - (len * endFrac) / 2), height / 2, 0); g.add(e);
  }
  g.position.copy(P((a.x + b.x) / 2, (a.y + b.y) / 2));
  g.rotation.y = Math.atan2(b.y - a.y, b.x - a.x);
  board.add(g);
  return g;
}

const capTopTex = () => makeCanvasTexture(256, 256, (c) => {
  c.fillStyle = '#C9CED5'; c.beginPath(); c.arc(128, 128, 128, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2B2F38'; c.beginPath(); c.arc(128, 128, 128, Math.PI * 0.62, Math.PI * 1.38); c.fill();
  c.fillStyle = '#3A3F49'; c.font = '700 54px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('47', 150, 98); c.fillText('25V', 150, 160);
});

// 47 µF electrolytics (Panasonic D: 6.3 mm can on a square base).
function electrolytic(top: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const base = rbox(6.6, 1.0, 6.6, 0.4, MATERIALS.black); base.position.y = 0.5;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.15, 4.4, 40), std('#C9CED5', 0.35, 0.6)); can.position.y = 3.2;
  const groove = new THREE.Mesh(new THREE.TorusGeometry(3.12, 0.12, 6, 40), std('#9FA5AE', 0.4, 0.6)); groove.rotation.x = Math.PI / 2; groove.position.y = 2.0;
  const lid = new THREE.Mesh(new THREE.CircleGeometry(3.1, 40), std('#ffffff', 0.45, 0.3, { map: top })); lid.rotation.x = -Math.PI / 2; lid.position.y = 5.41;
  g.add(base, can, groove, lid);
  return castAll(g);
}

// Status LEDs return their material so the board can light them.
export type StatusLeds = { L: THREE.MeshStandardMaterial; TX: THREE.MeshStandardMaterial; RX: THREE.MeshStandardMaterial; ON: THREE.MeshStandardMaterial };

function led0805(board: THREE.Object3D, name: string, color: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: '#F2EEE4', emissive: color, emissiveIntensity: 0, roughness: 0.25 });
  const g = twoPad(board, name, 1.25, 0.75, mat, 0.18)!;
  const lens = rbox(1.0, 0.12, 0.9, 0.05, new THREE.MeshStandardMaterial({ color, roughness: 0.2, transparent: true, opacity: 0.55 }));
  lens.position.y = 0.8; g.add(lens);
  return mat;
}

export function buildPassives(board: THREE.Object3D): StatusLeds {
  for (const e of topElements()) {
    if (e.pkg === 'C0603-ROUND') twoPad(board, e.name, 0.8, 0.8, capMat);
    else if (e.pkg === 'R0603-ROUND') twoPad(board, e.name, 0.8, 0.45, resMat);
    else if (e.pkg === 'CT/CN0603') twoPad(board, e.name, 0.8, 0.8, varMat);
    else if (e.pkg === '0805') twoPad(board, e.name, 1.25, 0.9, ferriteMat);
    else if (e.pkg === 'L1812') twoPad(board, e.name, 3.2, 1.0, std('#D8B24C', 0.55));
  }
  const top = capTopTex();
  for (const name of ['PC1', 'PC2']) at(board, name, electrolytic(top));

  // resistor arrays (CAY16: four 0603 resistors in one 3.2 x 1.6 body)
  for (const name of ['RN1', 'RN2', 'RN3', 'RN4']) {
    const g = new THREE.Group();
    const body = rbox(3.2, 0.5, 1.6, 0.06, resMat); body.position.y = 0.25; g.add(body);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const t = rbox(0.45, 0.52, 0.3, 0.04, MATERIALS.tin); t.position.set((i - 1.5) * 0.8, 0.26, s * 0.72); g.add(t); }
    at(board, name, g);
  }

  // M7 rectifier (SMB) with cathode band, and the two glass MiniMELF diodes
  const d1 = new THREE.Group();
  const d1body = rbox(4.3, 2.1, 3.6, 0.25, MATERIALS.smdBlack); d1body.position.y = 1.05;
  const band = rbox(0.5, 0.02, 3.4, 0.01, std('#A8ADB5', 0.5)); band.position.set(-1.5, 2.11, 0);
  d1.add(d1body, band);
  for (const s of [-1, 1]) { const t = rbox(1.0, 0.25, 2.0, 0.05, MATERIALS.tin); t.position.set(s * 2.45, 0.12, 0); d1.add(t); }
  at(board, 'D1', d1);
  for (const name of ['D2', 'D3']) {
    const [a, b] = smdOf(name);
    if (!a || !b) continue;
    const len = 3.5, g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, len * 0.62, 20), std('#D9824F', 0.2, 0, { transparent: true, opacity: 0.9 }));
    glass.rotation.z = Math.PI / 2; glass.position.y = 0.72;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.3, 20), MATERIALS.smdBlack); ring.rotation.z = Math.PI / 2; ring.position.set(len * 0.2, 0.72, 0);
    g.add(glass, ring);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, len * 0.19, 20), MATERIALS.tin); e.rotation.z = Math.PI / 2; e.position.set(s * len * 0.405, 0.72, 0); g.add(e); }
    g.position.copy(P((a.x + b.x) / 2, (a.y + b.y) / 2));
    g.rotation.y = Math.atan2(b.y - a.y, b.x - a.x);
    board.add(castAll(g));
  }

  const leds: StatusLeds = { L: led0805(board, 'L', '#FFB020'), TX: led0805(board, 'TX', '#FFB020'), RX: led0805(board, 'RX', '#FFB020'), ON: led0805(board, 'ON', '#2BE07A') };
  leds.ON.emissiveIntensity = 2.0;
  return leds;
}
