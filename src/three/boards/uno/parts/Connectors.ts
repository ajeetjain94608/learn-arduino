import * as THREE from 'three';
import { castAll, rbox } from '../../../shared/geometry';
import { MATERIALS, std } from '../../../shared/materials';
import { element } from '../layout';
import { at, P, partFor, put } from './place';

// USB-B and DC barrel jack (both protrude past the left edge), and the TS42 reset switch.
export function buildConnectors(board: THREE.Object3D): void {
  const uy = element('X2').y;
  const usb = partFor(board, 'X2', P(1.85, uy, 0));
  put(usb, rbox(16.5, 10.9, 12.0, 0.9, MATERIALS.metal, 3), 1.85, uy, 5.45);
  put(usb, rbox(0.8, 8.2, 9.0, 0.6, MATERIALS.black), -6.45, uy, 5.45);
  put(usb, rbox(1.0, 3.2, 5.2, 0.3, MATERIALS.header), -6.55, uy, 5.0);
  for (const dy of [-6.05, 6.05]) put(usb, rbox(9, 0.4, 0.2, 0.08, MATERIALS.metalDark), 3, uy + dy, 9);

  const jy = element('X1').y;
  const jack = partFor(board, 'X1', P(5.4, jy, 0));
  put(jack, rbox(14.4, 11, 9.0, 1.0, MATERIALS.black, 3), 5.4, jy, 5.5);
  const sideways = (m: THREE.Mesh) => { m.rotation.z = Math.PI / 2; return m; };
  put(jack, sideways(new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 1.2, 40), MATERIALS.black)), -2.3, jy, 6.0);
  put(jack, sideways(new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.4, 32), MATERIALS.hole)), -2.75, jy, 6.0);
  put(jack, sideways(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.4, 16), MATERIALS.metal)), -2.5, jy, 6.0);

  const reset = new THREE.Group();
  const base = rbox(5.1, 1.2, 3.6, 0.2, MATERIALS.black); base.position.y = 0.6;
  const plate = rbox(4.9, 0.25, 3.4, 0.15, MATERIALS.metal); plate.position.y = 1.3;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 24), std('#D9503A', 0.55)); knob.position.y = 1.75;
  reset.add(base, plate, knob);
  at(partFor(board, 'RESET'), 'RESET', castAll(reset));
}
