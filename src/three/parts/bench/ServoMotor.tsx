import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PART_DEFS } from '../../../circuit/parts';
import { liveDevices } from '../../../sim/liveDevices';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { castAll, rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import { useReducedMotion } from '../../shared/motion';
import type { PartView } from '../partView';
import { decal, noPick, PITCH, useDisposeOwned, wire } from './motion/kit';

const PINS = PART_DEFS.servo.bench!.pins;
// 9 g micro servo: case 23 × 12.2 mm, 22.5 mm tall, lying along x; the output shaft near the +x end.
const L = 23, W = 12.2, H = 22.5;
const BZ = -4.4;                 // the case sits toward the back, its lead plugs in at the front
const SX = L / 2 - 5.9;          // output shaft x
const EAR_Y = 15.6;              // underside of the mounting ears
const BOSS_TOP = H + 3.6;
const CARD_Y = BOSS_TOP + 0.05;  // the printed angle card rests on the boss
const HORN_Y = CARD_Y + 0.5;
const DEG_PER_S = 500;           // ~0.12 s per 60°

function build() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#2756BE', roughness: 0.3, transparent: true, opacity: 0.84, depthWrite: false });
  const shellSolid = std('#2A58B4', 0.4);
  const white = std('#F3F2EE', 0.55);

  // inside, seen through the tinted case: the little motor, the gear train and the control board
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 11, 20), MATERIALS.metal); motor.position.set(-L / 2 + 5, 7.5, BZ); g.add(motor);
  const board = rbox(9, 0.8, 10, 0.2, std('#2E7A3E', 0.6)); board.position.set(-1.5, 2.4, BZ); g.add(board);
  for (const [x, r, y] of [[SX, 5.2, 19.6], [SX - 6.5, 3.6, 18.4], [SX - 2.5, 4.4, 21.0], [SX - 7.5, 2.4, 20.4]] as const) {
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.1, 24), white); gear.position.set(x, y, BZ); g.add(gear);
  }
  // the case: bottom cover, body, ears, top cover
  const bottom = rbox(L, 4.2, W, 0.6, shell); bottom.position.set(0, 2.1, BZ);
  const body = rbox(L - 0.3, EAR_Y - 4.2 + 0.1, W - 0.3, 0.4, shell); body.position.set(0, 4.15 + (EAR_Y - 4.2) / 2, BZ);
  const ears = rbox(32.2, 2.4, W - 0.4, 0.5, shell); ears.position.set(0, EAR_Y + 1.2, BZ);
  const top = rbox(L, H - EAR_Y - 2.4, W, 0.6, shell); top.position.set(0, EAR_Y + 2.4 + (H - EAR_Y - 2.4) / 2, BZ);
  g.add(bottom, body, ears, top);
  for (const sx of [-1, 1]) { // ear screw holes and slots
    const hole = noPick(noOutline(new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), MATERIALS.hole))); hole.rotation.x = -Math.PI / 2;
    hole.position.set(sx * 13.8, EAR_Y + 2.42, BZ); g.add(hole);
    const slot = noPick(noOutline(rbox(2.3, 0.05, 1.0, 0.2, MATERIALS.hole))); slot.position.set(sx * 14.95, EAR_Y + 2.43, BZ); g.add(slot);
  }
  // the gear tower on top: the big boss round the output shaft and the small idler bump
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 5.9, BOSS_TOP - H, 36), shellSolid); boss.position.set(SX, H + (BOSS_TOP - H) / 2, BZ); g.add(boss);
  const bump = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, BOSS_TOP - H - 0.4, 24), shellSolid); bump.position.set(SX - 6.8, H + (BOSS_TOP - H - 0.4) / 2, BZ); g.add(bump);
  const spline = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 18), white); spline.position.set(SX, BOSS_TOP + 0.6, BZ); g.add(spline);
  for (const m of [bottom, body, ears, top]) m.renderOrder = 2;

  // a printed card on the shaft, 0–180° like a protractor: 0 to the right, 90 straight back, 180 to the left
  const R = 17;
  const cardTex = makeCanvasTexture(2 * R * 28, (R + 3) * 28, (ctx) => {
    ctx.scale(28, 28);
    const cx = R, cy = R; // the shaft
    ctx.fillStyle = '#FAF8F0'; ctx.fillRect(0, 0, 2 * R, R + 3);
    ctx.strokeStyle = '#2B2F38'; ctx.lineWidth = 0.18;
    ctx.beginPath(); ctx.arc(cx, cy, R - 1.2, Math.PI, 0); ctx.stroke();
    for (let a = 0; a <= 180; a += 10) {
      const t = (a * Math.PI) / 180, len = a % 30 === 0 ? 2.2 : 1.1;
      ctx.lineWidth = a % 30 === 0 ? 0.28 : 0.16;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * (R - 1.2), cy - Math.sin(t) * (R - 1.2));
      ctx.lineTo(cx + Math.cos(t) * (R - 1.2 - len), cy - Math.sin(t) * (R - 1.2 - len)); ctx.stroke();
    }
    ctx.fillStyle = '#2B2F38'; ctx.font = 'bold 2.1px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let a = 0; a <= 180; a += 30) {
      const t = (a * Math.PI) / 180, r = R - 5.2;
      ctx.save(); ctx.translate(cx + Math.cos(t) * r, cy - Math.sin(t) * r); ctx.rotate(Math.PI / 2 - t); ctx.fillText(`${a}°`, 0, 0); ctx.restore();
    }
    ctx.fillStyle = '#E8473C'; ctx.beginPath(); ctx.arc(cx, cy, 6.6, Math.PI, 0); ctx.arc(cx, cy, 6.2, 0, Math.PI, true); ctx.fill();
  });
  // the card itself: a half disc plus a strip in front of the shaft, its printing mapped on from above
  const cs = new THREE.Shape();
  cs.moveTo(-R, -2.6); cs.lineTo(R, -2.6); cs.lineTo(R, 0); cs.absarc(0, 0, R, 0, Math.PI, false); cs.closePath();
  const cardGeo = new THREE.ShapeGeometry(cs, 48);
  const cp = cardGeo.attributes.position, uv = cardGeo.attributes.uv;
  for (let i = 0; i < cp.count; i++) uv.setXY(i, (cp.getX(i) + R) / (2 * R), (cp.getY(i) + 3) / (R + 3));
  cardGeo.rotateX(-Math.PI / 2); // the half disc lies behind the shaft (−z)
  const card = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.85 }));
  card.position.set(SX, CARD_Y, BZ);
  g.add(card);
  const cardEdge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, 64, 1, false, Math.PI / 2, Math.PI), std('#F6F3EA', 0.85));
  cardEdge.position.set(SX, CARD_Y - 0.17, BZ); g.add(cardEdge);

  // the single-arm horn: a hub on the spline and a tapered arm with holes, pointing +x at rotation 0
  const horn = new THREE.Group(); horn.position.set(SX, HORN_Y, BZ);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 3.6, 28), white); hub.position.y = 1.8; horn.add(hub);
  const s = new THREE.Shape();
  s.absarc(0, 0, 3.4, Math.PI / 2, (3 * Math.PI) / 2, false); s.lineTo(15.2, -1.9); s.absarc(15.2, 0, 1.9, -Math.PI / 2, Math.PI / 2, false); s.closePath();
  for (let i = 0; i < 6; i++) { const h = new THREE.Path(); h.absarc(5.6 + i * 1.95, 0, 0.42, 0, Math.PI * 2, true); s.holes.push(h); }
  const armGeo = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1, curveSegments: 20 });
  armGeo.rotateX(-Math.PI / 2); // the shape's y becomes −z: at rotation 0 the arm points +x
  const arm = new THREE.Mesh(armGeo, white); arm.position.y = 2.2; horn.add(arm);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 16), MATERIALS.metalDark); screw.position.y = 3.95; horn.add(screw);
  const tipMark = noPick(noOutline(new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), std('#E8473C', 0.6)))); tipMark.rotation.x = -Math.PI / 2;
  tipMark.position.set(15.2, 3.85, 0); horn.add(tipMark);
  g.add(horn);

  // the lead: brown GND, red V+, orange SIG out of the −x end, round to a 3-pin plug lying at the front, and a
  // right-angle header in the plug whose pins point up
  const [gx, py, pz] = PINS.GND;
  const cols = ['#7A4A2A', '#D8342B', '#F28C16'];
  const plugZ0 = 5.2, plugZ1 = 12.6;
  const housing = rbox(3 * PITCH + 0.2, 2.7, plugZ1 - plugZ0, 0.35, MATERIALS.black); housing.position.set(0, 1.35, (plugZ0 + plugZ1) / 2); g.add(housing);
  const latch = rbox(3.2, 0.5, 3, 0.2, MATERIALS.black); latch.position.set(0, 2.85, plugZ1 - 2.6); g.add(latch);
  const spacer = rbox(3 * PITCH, 2.5, 2.4, 0.25, MATERIALS.header); spacer.position.set(0, 1.35, plugZ1 + 1.25); g.add(spacer);
  ['GND', 'V+', 'SIG'].forEach((name, i) => {
    const [x] = PINS[name];
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.64, pz - plugZ1 + 0.32), MATERIALS.tin); leg.position.set(x, 1.35, (plugZ1 + pz + 0.32) / 2); g.add(leg);
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.64, py - 1.35 - 0.3, 0.64), MATERIALS.tin); up.position.set(x, 1.03 + (py - 1.03) / 2, pz); g.add(up);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 0.35, 4, 1), MATERIALS.tin); tip.rotation.y = Math.PI / 4; tip.position.set(x, py - 0.175, pz); g.add(tip);
    const ez = BZ + (i - 1) * 1.0;
    g.add(wire([[-L / 2 + 0.5, 2.6, ez], [-L / 2 - 2.2, 2.2, ez + 0.4], [-L / 2 - 2.6, 1.2, 3.2 + i * 0.2], [-L / 2 + 3, 1.2, 3.6 + i * 0.3], [x - 0.6, 1.3, plugZ0 - 0.9], [x, 1.35, plugZ0 + 0.4]], cols[i], 0.5, 64));
  });
  const grommet = rbox(1.4, 2.6, 4.2, 0.4, shell); grommet.position.set(-L / 2 - 0.3, 2.6, BZ); g.add(grommet);
  const labels = decal(3 * PITCH, 2.4, (ctx) => {
    ctx.fillStyle = '#F4F1E8'; ctx.font = 'bold 0.75px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ['GND', 'V+', 'SIG'].forEach((n, i) => ctx.fillText(n, PITCH * (i + 0.5), 1.2));
  }, 60);
  labels.position.set(gx + PITCH, 2.62, plugZ1 + 1.25); g.add(labels);

  castAll(g);
  for (const o of [motor, board, cardEdge, spline, screw, latch, grommet]) o.raycast = () => {};
  return { g, horn };
}

// Micro servo: the horn turns to the angle the program asks for (liveDevices), at a real servo's speed, over a
// printed 0–180° card.
export function ServoMotor({ id }: PartView) {
  const m = useMemo(() => build(), []);
  useDisposeOwned(m.g);
  const reduced = useReducedMotion();
  const s = useMemo(() => ({ target: 90, shown: 90 }), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const a = liveDevices.states[id]?.angle;
    if (a !== undefined) s.target = a;
    const step = DEG_PER_S * dt, d = s.target - s.shown;
    s.shown = reduced || Math.abs(d) <= step ? s.target : s.shown + Math.sign(d) * step;
    m.horn.rotation.y = (s.shown * Math.PI) / 180; // 0° → +x, 90° → straight back (centre), 180° → −x
  });
  return <primitive object={m.g} />;
}
