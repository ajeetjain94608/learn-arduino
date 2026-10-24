import * as THREE from 'three';
import { makeCanvasTexture } from '../../../shared/canvasTexture';
import { castAll, rbox } from '../../../shared/geometry';
import { std } from '../../../shared/materials';
import { at } from './place';

// 16 MHz crystal, HC-49/US low profile: an upright racetrack-shaped metal can with a flat top.
function hc49(): THREE.Group {
  const L = 11.05, W = 4.65, r = W / 2, H = 3.5;
  const s = new THREE.Shape();
  s.moveTo(-L / 2 + r, -r); s.lineTo(L / 2 - r, -r); s.absarc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-L / 2 + r, r); s.absarc(-L / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const canGeo = new THREE.ExtrudeGeometry(s, { depth: H - 0.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 24 });
  canGeo.rotateX(-Math.PI / 2); canGeo.translate(0, 0.25, 0);
  const flangeGeo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false, curveSegments: 24 });
  flangeGeo.rotateX(-Math.PI / 2);
  const flange = new THREE.Mesh(flangeGeo, std('#B9BEC5', 0.35, 0.7)); flange.scale.set(1.03, 1, 1.08);
  const tex = makeCanvasTexture(512, 220, (c) => {
    c.clearRect(0, 0, 512, 220); c.fillStyle = 'rgba(70,76,86,0.75)'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 92px ui-monospace, Consolas, monospace'; c.fillText('16.000', 256, 92);
    c.font = '600 46px ui-monospace, Consolas, monospace'; c.fillText('T  1928', 256, 168);
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 3.6), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.4 }));
  top.rotation.x = -Math.PI / 2; top.position.y = H + 0.01;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(canGeo, std('#D9DDE2', 0.3, 0.75)), flange, top);
  return castAll(g);
}

// 16 MHz ceramic resonator for the 328P (CSTCE, 3.2 x 1.3 mm).
function resonator(): THREE.Group {
  const g = new THREE.Group();
  const b = rbox(3.2, 0.9, 1.3, 0.12, std('#9DB3C8', 0.55)); b.position.y = 0.55;
  const cap = rbox(2.4, 0.25, 1.1, 0.08, std('#C9CDD3', 0.4, 0.5)); cap.position.y = 1.05;
  g.add(b, cap);
  return g;
}

export function buildCrystals(board: THREE.Object3D): void {
  at(board, 'Y1', hc49());
  at(board, 'Y2', resonator());
}
