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
import { decal, ease, headerPin, noPick, PITCH, ribbon, useDisposeOwned } from './motion/kit';

const PINS = PART_DEFS.stepper.bench!.pins;

// 28BYJ-48 on an acrylic stand at the left, its shaft pointing to the front (+z); the ULN2003 board at the right.
const MX = -17, MY = 18;          // can centre
const SHAFT_Y = MY + 8;           // the output shaft is 8 mm off centre (up)
const CAN_R = 14;
const FACE_Z = 2;                 // the can's front face (mounting ears)
const PLATE_Z0 = 2.8, PLATE_Z1 = 5.8;
const WHEEL_R = 23.5, WHEEL_Z = 10.6;

// the ULN2003 board
const BX0 = 6, BX1 = 38, BZ0 = -17, BZ1 = 18;
const B_BOTTOM = 0.6, B_TOP = 2.2;
const SOCK_X = 9.6, SOCK_Z = -4.6; // white 5-pin motor socket, its row along z
const LED_X = 32.6, LED_Z = [-11.4, -7.6, -3.8, 0];
const CHIP_X = 18.2, CHIP_Z = 1.2;

// coils energised in each of the 8 half-steps (bits: A=1, B=2, C=4, D=8): A, AB, B, BC, C, CD, D, DA
const SEQ = [1, 3, 2, 6, 4, 12, 8, 9];
export const coilsAt = (angle: number) => {
  const half = Math.round((angle / 360) * 4096);
  return SEQ[(((half % 8) + 9) % 8)];
};

const SEGMENTS = [
  { label: '50', color: '#E8473C' }, { label: '100', color: '#F5C83A' }, { label: '200', color: '#3E7BF0' }, { label: 'AGAIN', color: '#3FC46A' },
  { label: '500', color: '#F28C16' }, { label: 'x2', color: '#8E5BD8' }, { label: '1000', color: '#22B0C0' }, { label: 'JACKPOT', color: '#E2558C' },
];

function wheelTexture() {
  return makeCanvasTexture(1024, 1024, (ctx) => {
    const c = 512, r = 510, n = SEGMENTS.length;
    SEGMENTS.forEach((s, i) => { // segment 0 is centred at the top
      const a0 = -Math.PI / 2 + ((i - 0.5) * 2 * Math.PI) / n, a1 = a0 + (2 * Math.PI) / n;
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, a0, a1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 7; ctx.stroke();
      ctx.save(); ctx.translate(c, c); ctx.rotate(a0 + Math.PI / n + Math.PI / 2);
      const rText = s.label.length > 4 ? 350 : 330, fit = 2 * (rText - 40) * Math.tan(Math.PI / n) * 0.86; // fit the segment
      ctx.font = '900 100px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.min(100, Math.floor((100 * fit) / ctx.measureText(s.label).width))}px sans-serif`;
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(30,24,40,0.55)'; ctx.fillStyle = '#FFFFFF';
      ctx.strokeText(s.label, 0, -rText); ctx.fillText(s.label, 0, -rText);
      ctx.restore();
    });
    ctx.lineWidth = 16; ctx.strokeStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(c, c, r - 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(c, c, 120, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2B2F38'; ctx.lineWidth = 5; ctx.stroke();
  });
}

function build(load: string) {
  const g = new THREE.Group();
  const steel = std('#C3C8CF', 0.38, 0.65);
  const blue = std('#2F6AD0', 0.5);
  const acrylic = new THREE.MeshStandardMaterial({ color: '#DDEBF2', roughness: 0.2, transparent: true, opacity: 0.42, depthWrite: false });

  // --- the motor --------------------------------------------------------------------------------------------------
  const canGeo = new THREE.CylinderGeometry(CAN_R, CAN_R, 15, 48); canGeo.rotateX(Math.PI / 2);
  const can = new THREE.Mesh(canGeo, steel); can.position.set(MX, MY, FACE_Z - 7.5); g.add(can);
  const lipGeo = new THREE.CylinderGeometry(CAN_R + 0.3, CAN_R + 0.3, 0.9, 48); lipGeo.rotateX(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, steel); lip.position.set(MX, MY, FACE_Z - 0.45); g.add(lip);
  const capGeo = new THREE.CylinderGeometry(CAN_R + 0.15, CAN_R + 0.15, 4, 48); capGeo.rotateX(Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, blue); cap.position.set(MX, MY, FACE_Z - 17); g.add(cap); // blue back cover
  const box = rbox(15, 5, 13, 1, blue); box.position.set(MX, MY - CAN_R + 1.3, FACE_Z - 12.5); g.add(box); // where the wires leave
  // the ears (35 mm between holes) and the shaft boss on the front face
  const ears = new THREE.Shape();
  ears.moveTo(-17.5, -3.5); ears.absarc(-17.5, 0, 3.5, -Math.PI / 2, -Math.PI * 1.5, true); ears.lineTo(17.5, 3.5);
  ears.absarc(17.5, 0, 3.5, Math.PI / 2, -Math.PI / 2, true); ears.closePath();
  for (const x of [-17.5, 17.5]) { const h = new THREE.Path(); h.absarc(x, 0, 2.1, 0, Math.PI * 2, true); ears.holes.push(h); }
  const earGeo = new THREE.ExtrudeGeometry(ears, { depth: 0.8, bevelEnabled: false, curveSegments: 20 });
  const ear = new THREE.Mesh(earGeo, steel); ear.position.set(MX, MY, FACE_Z); g.add(ear);
  const bossGeo = new THREE.CylinderGeometry(4.6, 4.6, 1.6, 32); bossGeo.rotateX(Math.PI / 2);
  const boss = new THREE.Mesh(bossGeo, steel); boss.position.set(MX, SHAFT_Y, FACE_Z + 0.8); g.add(boss);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.35, 8, 48), steel); ring.position.set(MX, MY, FACE_Z + 0.1); g.add(ring);

  // --- the acrylic stand: foot on the bench, upright plate the ears bolt to -----------------------------------------
  const top = load === 'wheel' ? SHAFT_Y + WHEEL_R + 6 : SHAFT_Y + 9;
  const ps = new THREE.Shape();
  ps.moveTo(-20, 0); ps.lineTo(19, 0); ps.lineTo(19, 22); ps.lineTo(6, top); ps.lineTo(-6, top); ps.lineTo(-20, 22); ps.closePath();
  const hole = new THREE.Path(); hole.absarc(0, SHAFT_Y, 5, 0, Math.PI * 2, true); ps.holes.push(hole);
  const plateGeo = new THREE.ExtrudeGeometry(ps, { depth: PLATE_Z1 - PLATE_Z0, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.4, bevelSegments: 1, curveSegments: 24 });
  const plate = new THREE.Mesh(plateGeo, acrylic); plate.position.set(MX, 0.4, PLATE_Z0); plate.renderOrder = 2; g.add(plate);
  const foot = rbox(39, 2.8, PLATE_Z1 + 12, 0.6, acrylic); foot.position.set(MX - 0.5, 1.4, (PLATE_Z1 - 12) / 2); foot.renderOrder = 2; g.add(foot);
  for (const x of [-17.5, 17.5]) { // screws through the ears, nuts on the plate's front
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.8, 6), MATERIALS.metalDark); nut.rotation.x = Math.PI / 2; nut.position.set(MX + x, MY, PLATE_Z1 + 0.9); g.add(nut);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 16), MATERIALS.metal); bolt.rotation.x = Math.PI / 2; bolt.position.set(MX + x, MY, PLATE_Z1 + 2.2); g.add(bolt);
  }

  // --- the rotor: the D-shaft and its load, turning about z ------------------------------------------------------
  const rotor = new THREE.Group(); rotor.position.set(MX, SHAFT_Y, 0);
  const shaftGeo = new THREE.CylinderGeometry(2.5, 2.5, 9.5, 20); shaftGeo.rotateX(Math.PI / 2);
  const sp = shaftGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setY(i, THREE.MathUtils.clamp(sp.getY(i), -1.5, 1.5)); // the two flats
  shaftGeo.computeVertexNormals();
  const shaft = new THREE.Mesh(shaftGeo, MATERIALS.metal); shaft.position.z = FACE_Z + 1.6 + 4.75; rotor.add(shaft);
  if (load === 'wheel') {
    const hubGeo = new THREE.CylinderGeometry(5.5, 5.5, 5, 32); hubGeo.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, std('#F3F2EE', 0.5)); hub.position.z = WHEEL_Z - 1; rotor.add(hub);
    const discGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 1.6, 72); discGeo.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, std('#F7F5EF', 0.6)); disc.position.z = WHEEL_Z; rotor.add(disc);
    const face = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R - 0.05, 72), new THREE.MeshStandardMaterial({ map: wheelTexture(), roughness: 0.62 }));
    face.position.z = WHEEL_Z + 0.82; face.receiveShadow = true; rotor.add(noOutline(face));
    const capC = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 2, 24), std('#F3F2EE', 0.5)); capC.rotation.x = Math.PI / 2; capC.position.z = WHEEL_Z + 1.8; rotor.add(capC);
    const pegGeo = new THREE.CylinderGeometry(0.6, 0.6, 3.2, 10); pegGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 8; i++) { // pegs on the segment borders: the pointer ticks over them
      const a = Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / 8;
      const peg = new THREE.Mesh(pegGeo, MATERIALS.metal); peg.position.set(Math.cos(a) * (WHEEL_R - 1.8), Math.sin(a) * (WHEEL_R - 1.8), WHEEL_Z + 2.2); rotor.add(peg);
    }
  } else { // a small coupler with a set screw and an index line
    const cpl = new THREE.CylinderGeometry(4.2, 4.2, 8, 28); cpl.rotateX(Math.PI / 2);
    const coupler = new THREE.Mesh(cpl, std('#B8BEC6', 0.32, 0.7)); coupler.position.z = FACE_Z + 9; rotor.add(coupler);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1, 12), MATERIALS.black); screw.position.set(0, 4.1, FACE_Z + 8); rotor.add(screw);
    const mark = noPick(noOutline(rbox(0.8, 3.6, 0.1, 0.1, std('#E8473C', 0.5)))); mark.position.set(0, 2.2, FACE_Z + 13.06); rotor.add(mark);
  }
  g.add(rotor);
  if (load === 'wheel') { // the fixed pointer at the top of the stand
    const ptr = new THREE.Shape(); ptr.moveTo(-2.6, 0); ptr.lineTo(2.6, 0); ptr.lineTo(0, -6.5); ptr.closePath();
    const pg = new THREE.ExtrudeGeometry(ptr, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1 });
    const pointer = new THREE.Mesh(pg, std('#E8473C', 0.45)); pointer.position.set(MX, SHAFT_Y + WHEEL_R + 3.2, WHEEL_Z + 2.3); g.add(pointer);
    const arm = rbox(2, 1.6, WHEEL_Z + 3.5 - PLATE_Z1, 0.4, std('#E8473C', 0.45)); arm.position.set(MX, SHAFT_Y + WHEEL_R + 3.6, (PLATE_Z1 + WHEEL_Z + 3.5) / 2); g.add(arm);
  }

  // --- the ULN2003 driver board -------------------------------------------------------------------------------------
  const pcb = rbox(BX1 - BX0, B_TOP - B_BOTTOM, BZ1 - BZ0, 0.8, std('#1E7A4A', 0.7)); pcb.position.set((BX0 + BX1) / 2, (B_TOP + B_BOTTOM) / 2, (BZ0 + BZ1) / 2); g.add(pcb);
  for (const [x, z] of [[BX0 + 2.6, BZ0 + 2.6], [BX1 - 2.6, BZ0 + 2.6], [BX0 + 2.6, BZ1 - 2.6], [BX1 - 2.6, BZ1 - 2.6]]) {
    const pad = noPick(noOutline(new THREE.Mesh(new THREE.RingGeometry(1.5, 2.3, 24), MATERIALS.tin))); pad.rotation.x = -Math.PI / 2; pad.position.set(x, B_TOP + 0.01, z); g.add(pad);
    const h = noPick(noOutline(new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), MATERIALS.hole))); h.rotation.x = -Math.PI / 2; h.position.set(x, B_TOP + 0.012, z); g.add(h);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, B_BOTTOM, 10), MATERIALS.tin); foot.position.set(x, B_BOTTOM / 2, z); g.add(foot);
  }
  // silkscreen
  const silk = decal(BX1 - BX0, BZ1 - BZ0, (ctx) => {
    const X = (x: number) => x - BX0, Z = (z: number) => z - BZ0;
    ctx.fillStyle = '#F2F4EE'; ctx.strokeStyle = '#F2F4EE'; ctx.lineWidth = 0.22; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 1.25px sans-serif';
    ['IN1', 'IN2', 'IN3', 'IN4'].forEach((n) => ctx.fillText(n, X(PINS[n][0]), Z(PINS[n][2]) - 2.3));
    ctx.strokeRect(X(PINS.IN1[0]) - 1.6, Z(PINS.IN1[2]) - 1.5, 4 * PITCH + 0.6, 3);
    ctx.font = 'bold 2px sans-serif';
    ctx.fillText('+', X(PINS['+'][0]) + 2.6, Z(PINS['+'][2])); ctx.fillText('−', X(PINS['-'][0]) + 2.6, Z(PINS['-'][2]));
    ctx.font = 'bold 1.2px sans-serif'; ctx.fillText('5-12V', X(PINS['+'][0]), Z(PINS['+'][2]) + 2.6);
    ctx.font = 'bold 1.9px sans-serif';
    ['A', 'B', 'C', 'D'].forEach((n, i) => ctx.fillText(n, X(LED_X) + 3, Z(LED_Z[i])));
    ctx.strokeRect(X(CHIP_X) - 4.6, Z(CHIP_Z) - 10.4, 9.2, 20.8);
    ctx.strokeRect(X(SOCK_X) - 3.3, Z(SOCK_Z) - 7.9, 6.6, 15.8);
    ctx.font = 'bold 1.3px sans-serif';
    ctx.fillText('ULN2003 DRIVER', X(CHIP_X), Z(CHIP_Z) - 12);
  }, 30);
  silk.position.set((BX0 + BX1) / 2, B_TOP + 0.02, (BZ0 + BZ1) / 2); g.add(silk);

  // header pins: IN1–IN4 along the front edge, + and − (and the on/off jumper beside them)
  for (const n of ['IN1', 'IN2', 'IN3', 'IN4', '+', '-']) { const [x, y, z] = PINS[n]; g.add(headerPin(x, y, z, B_TOP, 1.4)); }
  const jx = PINS['+'][0] + 5.2;
  for (const n of ['+', '-']) g.add(headerPin(jx, PINS[n][1], PINS[n][2], B_TOP, 1.4));
  const jumper = rbox(2.5, 5.2, 5.1, 0.4, MATERIALS.black); jumper.position.set(jx, B_TOP + 2.5 + 2.4, (PINS['+'][2] + PINS['-'][2]) / 2); g.add(jumper);

  // the ULN2003: a DIP-16 along z, pin 1 toward the inputs
  const chip = rbox(6.35, 3.2, 19.3, 0.5, MATERIALS.chip); chip.position.set(CHIP_X, B_TOP + 0.6 + 1.6, CHIP_Z); g.add(chip);
  const legGeo = new THREE.BoxGeometry(1.4, 0.3, 0.5);
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, MATERIALS.metal); leg.position.set(CHIP_X + s * 3.6, B_TOP + 1.6, CHIP_Z - 8.89 + i * PITCH); g.add(leg);
    const foot = new THREE.Mesh(legGeo, MATERIALS.metal); foot.scale.set(0.3, 6, 1); foot.position.set(CHIP_X + s * 4.05, B_TOP + 0.85, CHIP_Z - 8.89 + i * PITCH); g.add(foot);
  }
  const chipText = decal(6.3, 19.2, (ctx) => {
    ctx.fillStyle = '#C9CCD2'; ctx.font = 'bold 1.25px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(3.15, 9.6); ctx.rotate(-Math.PI / 2); ctx.fillText('ULN2003AN', 0, -0.6); ctx.font = '0.9px sans-serif'; ctx.fillText('7-CH DRIVER', 0, 1.0); ctx.restore();
    ctx.fillStyle = '#1A1C22'; ctx.beginPath(); ctx.arc(3.15, 19.2, 1, Math.PI, 0); ctx.fill(); // notch at pin 1's end
  }, 40);
  chipText.position.set(CHIP_X, B_TOP + 0.6 + 3.21, CHIP_Z); g.add(chipText);

  // the white 5-pin motor socket (wires go in from the top) with the cable's plug in it
  const sock = rbox(5.8, 7, 14.9, 0.35, std('#F2EFE6', 0.6)); sock.position.set(SOCK_X, B_TOP + 3.5, SOCK_Z); g.add(sock);
  const plug = rbox(4.6, 2.6, 12.8, 0.4, std('#F7F5EF', 0.55)); plug.position.set(SOCK_X, B_TOP + 7 + 1.0, SOCK_Z); g.add(plug);

  // four LEDs A–D, each with its resistor
  const leds: THREE.MeshStandardMaterial[] = [], glows: THREE.Sprite[] = [];
  const glowTex = makeCanvasTexture(64, 64, (ctx) => {
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,60,40,0.85)'); gr.addColorStop(0.35, 'rgba(255,60,40,0.3)'); gr.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
  });
  const ledGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.2, 20), domeGeo = new THREE.SphereGeometry(1.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const resGeo = new THREE.BoxGeometry(3.2, 0.6, 1.6);
  LED_Z.forEach((z) => {
    const mat = new THREE.MeshStandardMaterial({ color: '#B8342A', emissive: '#FF1E0A', emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.88 });
    leds.push(mat);
    const body = new THREE.Mesh(ledGeo, mat); body.position.set(LED_X, B_TOP + 1.6, z); g.add(body);
    const dome = new THREE.Mesh(domeGeo, mat); dome.position.set(LED_X, B_TOP + 3.2, z); g.add(dome);
    const glow = noPick(noOutline(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0 }))));
    glow.scale.set(11, 11, 1); glow.position.set(LED_X, B_TOP + 3.6, z); glows.push(glow); g.add(glow);
    const res = new THREE.Mesh(resGeo, MATERIALS.smdBlack); res.position.set(LED_X - 5.4, B_TOP + 0.3, z); g.add(res);
    for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 1.6), MATERIALS.tin); cap.position.set(LED_X - 5.4 + s * 1.45, B_TOP + 0.31, z); g.add(cap); }
  });
  // a ceramic capacitor by the power pins
  const cer = rbox(3.6, 4.2, 1.8, 0.8, std('#D9A441', 0.55)); cer.position.set(PINS['+'][0] + 0.2, B_TOP + 2.6, PINS['+'][2] - 5.4); g.add(cer);

  // the motor's 5-wire cable: blue, pink, yellow, orange, red from the blue box round to the socket
  g.add(ribbon([
    [MX, MY - CAN_R + 1.6, FACE_Z - 18.6], [MX + 0.5, 1.6, -18.2], [MX + 10, 0.6, -17], [0, 0.6, -14], [3, 4, -8.5],
    [5.4, 12.6, SOCK_Z], [SOCK_X - 0.6, 14.4, SOCK_Z], [SOCK_X, 12.6, SOCK_Z], [SOCK_X, B_TOP + 8.6, SOCK_Z],
  ], ['#3A6FD8', '#F08BB8', '#F2D23A', '#F28C16', '#D8342B'].reverse(), 1.15, 0.5));

  castAll(g);
  for (const s of glows) s.castShadow = s.receiveShadow = false;
  for (const o of [lip, ring, boss, shaft, chip, sock, plug, jumper, cer]) o.raycast = () => {};
  return { g, rotor, leds, glows };
}

// 28BYJ-48 stepper and its ULN2003 board: the shaft (and prize wheel) follows the simulated angle; the LEDs A–D show
// which coils are energised.
export function StepperMotor({ id, params }: PartView) {
  const load = String(params.load);
  const m = useMemo(() => build(load), [load]);
  useDisposeOwned(m.g);
  const reduced = useReducedMotion();
  const s = useMemo(() => ({ shown: 0, has: false }), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const a = liveDevices.states[id]?.angle;
    if (a !== undefined) {
      s.shown = !s.has || reduced ? a : s.shown + (a - s.shown) * ease(dt, 0.045);
      s.has = true;
    }
    m.rotor.rotation.z = -(s.shown * Math.PI) / 180; // clockwise, seen from the front
    const coils = a === undefined ? 0 : coilsAt(a);
    for (let i = 0; i < 4; i++) {
      const on = (coils >> i) & 1;
      m.leds[i].emissiveIntensity = on ? 1.3 : 0;
      m.glows[i].material.opacity = on ? 0.9 : 0;
    }
  });
  return <primitive object={m.g} />;
}
