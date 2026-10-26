import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PART_DEFS } from '../../../circuit/parts';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { castAll, rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import { useReducedMotion } from '../../shared/motion';
import type { PartView } from '../partView';
import { decal, ease, headerPin, noPick, useDisposeOwned, wire } from './motion/kit';

const PINS = PART_DEFS.motor.bench!.pins;
const AXIS_Y = 30;        // the motor's axis sits high on its stand so the 55 mm fan clears the bench
const CAN_R = 10;         // "130" can: 20 mm round with two flats 15 mm apart
const FLAT = 7.5;
const CAN_Z0 = -16, CAN_Z1 = 4; // steel can along z; the white end cap (tabs) faces the front (+z)
const CAP_Z1 = 7.4;
const MAX_RPS = 6;        // visible revolutions per second at full speed

// a cylinder along z with its sides clamped to ±`flat` in x (the 130 can's flats)
function flatCyl(r: number, len: number, flat: number, segs = 40, open = false): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, segs, 1, open);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, THREE.MathUtils.clamp(p.getX(i), -flat, flat));
  g.computeVertexNormals();
  g.rotateX(Math.PI / 2);
  return g;
}

// one twisted plastic fan blade, root at the hub, reaching out along +y
function bladeGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-2.2, 3);
  s.bezierCurveTo(-5.5, 9, -9.5, 18, -7.5, 25.5);
  s.bezierCurveTo(-5.5, 28.2, 0.5, 28.2, 2.5, 25);
  s.bezierCurveTo(4.5, 18, 3.2, 9, 2.2, 3);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.3, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -0.45);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { // pitch: about 32° at the root easing to 18° at the tip
    v.fromBufferAttribute(p, i);
    const a = THREE.MathUtils.degToRad(32 - 14 * THREE.MathUtils.clamp(v.y / 27, 0, 1));
    const x = v.x * Math.cos(a) - v.z * Math.sin(a), z = v.x * Math.sin(a) + v.z * Math.cos(a);
    p.setXYZ(i, x, v.y, z);
  }
  g.computeVertexNormals();
  return g;
}

function build(load: string) {
  const g = new THREE.Group();
  const stand = std('#F2C230', 0.62);          // yellow kit plastic
  const steel = std('#C9CDD3', 0.36, 0.7);
  const capWhite = std('#F1EEE6', 0.7);

  // stand: a base plate, an upright and a clip around the can
  const base = rbox(30, 3, 30, 1.2, stand); base.position.set(0, 1.5, 0); g.add(base);
  const postH = AXIS_Y - CAN_R - 3 + 0.5; // from the base plate up into the clip
  const post = rbox(9, postH, 6, 1, stand); post.position.set(0, 3 + postH / 2 - 0.2, -6); g.add(post);
  const foot = rbox(14, 2, 10, 0.8, stand); foot.position.set(0, 3.8, -6); g.add(foot);
  const ring = new THREE.LatheGeometry([new THREE.Vector2(CAN_R + 0.05, -4), new THREE.Vector2(CAN_R + 1.6, -4), new THREE.Vector2(CAN_R + 1.6, 4), new THREE.Vector2(CAN_R + 0.05, 4), new THREE.Vector2(CAN_R + 0.05, -4)], 48);
  ring.rotateX(Math.PI / 2);
  const rp = ring.attributes.position;
  for (let i = 0; i < rp.count; i++) { const x = rp.getX(i); rp.setX(i, Math.sign(x) * Math.min(Math.abs(x), Math.abs(x) > CAN_R + 0.8 ? FLAT + 1.6 : FLAT + 0.05)); }
  ring.computeVertexNormals();
  const clip = new THREE.Mesh(ring, stand); clip.position.set(0, AXIS_Y, -6); g.add(clip);

  // the motor: steel can with flats, rolled rim, bearing boss and the white end cap
  const can = new THREE.Mesh(flatCyl(CAN_R, CAN_Z1 - CAN_Z0, FLAT), steel); can.position.set(0, AXIS_Y, (CAN_Z0 + CAN_Z1) / 2); g.add(can);
  const rim = new THREE.Mesh(flatCyl(CAN_R + 0.25, 0.8, FLAT + 0.25), steel); rim.position.set(0, AXIS_Y, CAN_Z1 - 0.4); g.add(rim);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 1.6, 28), steel); boss.rotation.x = Math.PI / 2; boss.position.set(0, AXIS_Y, CAN_Z0 - 0.8); g.add(boss);
  for (const dx of [-5.2, 5.2]) { // vent slots in the back face
    const slot = noPick(noOutline(rbox(1.2, 2.6, 0.2, 0.5, MATERIALS.hole))); slot.position.set(dx, AXIS_Y, CAN_Z0 - 0.05); g.add(slot);
  }
  const cap = new THREE.Mesh(flatCyl(CAN_R - 0.3, CAP_Z1 - CAN_Z1, FLAT - 0.1), capWhite); cap.position.set(0, AXIS_Y, (CAN_Z1 + CAP_Z1) / 2); g.add(cap);
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.2, 24), capWhite); bearing.rotation.x = Math.PI / 2; bearing.position.set(0, AXIS_Y, CAP_Z1 + 0.6); g.add(bearing);
  const dot = noPick(noOutline(new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), std('#D8342B', 0.6)))); dot.position.set(-3.6, AXIS_Y + 4.6, CAP_Z1 + 0.02); g.add(dot);
  // two tinned solder tabs out of the cap: + on the left (−x), − on the right
  const tabs: [number, number, number][] = [];
  for (const dx of [-5.6, 5.6]) {
    const tab = rbox(2.4, 0.35, 4.2, 0.15, MATERIALS.tin); tab.rotation.z = Math.PI / 2; tab.position.set(dx, AXIS_Y + 1.5, CAP_Z1 + 1.6); g.add(tab);
    const eye = noPick(noOutline(new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), MATERIALS.hole))); eye.rotation.y = Math.PI / 2;
    eye.position.set(dx + Math.sign(dx) * 0.2, AXIS_Y + 1.5, CAP_Z1 + 2.4); g.add(eye);
    tabs.push([dx, AXIS_Y + 1.5, CAP_Z1 + 2.6]);
  }

  // a tiny terminal board on the base: two pins (+ and −), the motor's wires soldered behind them
  const [px, py, pz] = PINS['+'], [mx] = PINS['-'];
  const pcb = rbox(13, 1.2, 8, 0.4, MATERIALS.pcb); pcb.position.set((px + mx) / 2, 3.6, pz - 1.6); g.add(pcb);
  for (const x of [px, mx]) g.add(headerPin(x, py, pz, 4.2, 1.2));
  g.add(decal(13, 8, (ctx) => {
    ctx.fillStyle = '#F4F1E8'; ctx.font = 'bold 2.3px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('+', 6.5 + px - 2.4, 5.3); ctx.fillText('−', 6.5 + mx + 2.4, 5.3);
  }));
  g.children[g.children.length - 1].position.set((px + mx) / 2, 4.22, pz - 1.6);
  const pads: [number, number, number][] = [[px, 4.4, pz - 3.6], [mx, 4.4, pz - 3.6]];
  for (const [x, y, z] of pads) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MATERIALS.tin); blob.scale.y = 0.6; blob.position.set(x, y - 0.2, z); g.add(blob);
  }
  g.add(wire([tabs[0], [tabs[0][0] - 1.2, tabs[0][1] - 3, tabs[0][2] + 1.5], [px - 1.8, 12, pz - 4.5], [px, 7, pz - 3.8], pads[0]], '#D8342B', 0.5));
  g.add(wire([tabs[1], [tabs[1][0] + 1.2, tabs[1][1] - 3, tabs[1][2] + 1.5], [mx + 1.8, 12, pz - 4.5], [mx, 7, pz - 3.8], pads[1]], '#2B2F38', 0.5));

  // the rotor: shaft and its load, turning about z
  const rotor = new THREE.Group(); rotor.position.set(0, AXIS_Y, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 9, 16), MATERIALS.metal); shaft.rotation.x = Math.PI / 2; shaft.position.z = CAN_Z0 - 5; rotor.add(shaft);
  let blur: THREE.Mesh | null = null, fanMat: THREE.MeshStandardMaterial | null = null;
  if (load === 'fan') {
    fanMat = std('#E9572B', 0.5, 0, { transparent: true }); // fades a little into its blur when fast
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 6, 32), fanMat); hub.rotation.x = Math.PI / 2; hub.position.z = CAN_Z0 - 6.5; rotor.add(hub);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(4.2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), fanMat); nose.rotation.x = -Math.PI / 2; nose.position.z = CAN_Z0 - 9.5; nose.scale.y = 0.45; rotor.add(nose);
    const bg = bladeGeometry();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(bg, fanMat); b.rotation.z = (i * 2 * Math.PI) / 3; b.position.z = CAN_Z0 - 6.5; rotor.add(b);
    }
    // a soft disc that shows the blur of fast blades
    const tex = makeCanvasTexture(128, 128, (ctx) => {
      const gr = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
      gr.addColorStop(0, 'rgba(233,87,43,0.0)'); gr.addColorStop(0.2, 'rgba(233,87,43,0.55)'); gr.addColorStop(0.85, 'rgba(233,87,43,0.4)'); gr.addColorStop(1, 'rgba(233,87,43,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
    });
    blur = noPick(noOutline(new THREE.Mesh(new THREE.CircleGeometry(28.5, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))));
    blur.position.set(0, AXIS_Y, CAN_Z0 - 6.5); blur.renderOrder = 3; g.add(blur);
  } else { // a bare shaft with a strip of tape folded over it, so you can see it turn
    const tape = rbox(0.4, 6, 3.2, 0.15, std('#E8473C', 0.7)); tape.position.set(0, 3.4, CAN_Z0 - 7.5); rotor.add(tape);
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.2, 24), std('#F1EEE6', 0.6)); pulley.rotation.x = Math.PI / 2; pulley.position.z = CAN_Z0 - 4; rotor.add(pulley);
  }
  g.add(rotor);
  castAll(g);
  if (blur) { blur.castShadow = blur.receiveShadow = false; }
  for (const o of [post, foot, clip, rim, boss, bearing, pcb, shaft]) o.raycast = () => {};
  return { g, rotor, blur, fanMat };
}

// Small "130" DC hobby motor on a yellow desk-fan stand: the fan (or a bare shaft) spins at the circuit's speed.
export function DcMotor({ params, state }: PartView) {
  const load = String(params.load);
  const m = useMemo(() => build(load), [load]);
  useDisposeOwned(m.g);
  const reduced = useReducedMotion();
  const spin = useMemo(() => ({ rps: 0 }), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const target = (state?.speed ?? 0) * MAX_RPS;
    spin.rps += (target - spin.rps) * ease(dt, 0.35); // the rotor spins up and coasts down
    if (spin.rps < 0.01 && target === 0) spin.rps = 0;
    const shown = reduced ? Math.min(spin.rps, 0.4) : spin.rps; // reduced motion: a slow turn, the blur disc tells the speed
    m.rotor.rotation.z -= shown * 2 * Math.PI * dt;
    const blur = Math.min(1, Math.max(0, (spin.rps / MAX_RPS - 0.15) / 0.6)); // 0 when slow, 1 from ~75 % speed
    if (m.blur) (m.blur.material as THREE.MeshBasicMaterial).opacity = 0.6 * blur;
    if (m.fanMat) m.fanMat.opacity = 1 - 0.5 * blur;
  });
  return <primitive object={m.g} />;
}
