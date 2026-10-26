import { useMemo } from 'react';
import * as THREE from 'three';
import { BB, holeLocal, ROW } from '../../breadboard/breadboardGeometry';
import { castAll } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import { resistorLegCurve } from '../Resistor';
import type { PartView } from '../partView';
import { printTexture, useDisposeOnUnmount } from './kit';

const LIFT = 3.4; // the body's axis above the board (as the resistor's)
// DO-41 body: 5.2 mm long, 2.7 mm across, softly rounded ends (lathe profile, along y before it is laid down)
const PROFILE = [[0, -2.6], [0.75, -2.6], [1.2, -2.45], [1.35, -2.1], [1.35, 2.1], [1.2, 2.45], [0.75, 2.6], [0, 2.6]]
  .map(([r, y]) => new THREE.Vector2(r, y));

function build(col: number, row: keyof typeof ROW) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(resistorLegCurve([col, row], [col + 4, row]), 64, 0.4, 8), MATERIALS.metal));
  const a = holeLocal(col, row), b = holeLocal(col + 4, row);
  const cx = (a[0] + b[0]) / 2, y = BB.H + LIFT, z = a[2];
  const bodyGeo = new THREE.LatheGeometry(PROFILE, 32); bodyGeo.rotateZ(-Math.PI / 2); // +y → +x (toward the cathode)
  const body = new THREE.Mesh(bodyGeo, std('#1D1F24', 0.5)); body.position.set(cx, y, z); g.add(body);
  // the cathode band, painted silver-grey round the K end
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.365, 1.365, 0.95, 32, 1, true), std('#B9BEC5', 0.45, 0.3));
  band.rotation.z = Math.PI / 2; band.position.set(cx + 1.45, y, z); g.add(band);
  // the part number printed along the body, facing up and toward the front
  const tex = printTexture(256, 64, [{ text: '1N4001', size: 40 }], '#C4C8CE');
  const printGeo = new THREE.CylinderGeometry(1.37, 1.37, 3.1, 32, 1, true, -Math.PI * 0.35, Math.PI * 0.7);
  const print = noOutline(new THREE.Mesh(printGeo, std('#ffffff', 0.6, 0, { map: tex, transparent: true, depthWrite: false })));
  tex.rotation = -Math.PI / 2; tex.center.set(0.5, 0.5);
  print.rotation.set(-Math.PI / 4, 0, Math.PI / 2, 'XZY'); print.position.set(cx - 0.75, y, z); print.raycast = () => {};
  g.add(print);
  return castAll(g);
}

// 1N4001 rectifier diode lying flat like a resistor: anode leg at the first hole, cathode (the band) four holes along.
export function Diode({ at }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const g = useMemo(() => build(col, row), [col, row]);
  useDisposeOnUnmount(g);
  return <primitive object={g} />;
}
