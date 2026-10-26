import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { soloMode } from '../../shared/motion';
import { useBenchDrag } from '../../build/controls3d';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import { useReducedMotion } from '../../shared/motion';
import type { PartView } from '../partView';
import { castSolid, decal, legZ, noRay, pinMesh, silkHole, silkText, soic, solderJoint, useDisposeOwned } from './sensing/common';

// HC-SR04 ultrasonic distance sensor standing upright on a small stand, its two transducers looking along +z
// (away from the UNO), and a toy car on the bench in front of it: drag the car to set the distance.

const BOARD = { w: 45, h: 20, t: 1.6, y0: 1.5, z: -4.8 };      // the PCB: bottom edge at y0, centre plane at z
const FRONT = BOARD.z + BOARD.t / 2;                           // the PCB's front face
const CAN = { x: 13, y: BOARD.y0 + BOARD.h / 2, r: 8, depth: 12 };
export const SONAR_FACE_Z = FRONT + CAN.depth;                 // the transducers' mesh fronts (8 mm)
const PINS_X = [-3.81, -1.27, 1.27, 3.81];                     // VCC, TRIG, ECHO, GND (tips: PART_DEFS.hcsr04.bench.pins)
const PIN_TIP = { y: 12, z: 9 };
const LEG_Y = 4.4;                                             // the right-angle header's legs through the PCB

// The obstacle's distance: the gap between the sensor face and the car's bumper is 8 mm + 0.6 mm per cm.
export const gapOf = (cm: number) => 8 + Math.min(400, Math.max(2, cm)) * 0.6;
export const cmOf = (gap: number) => Math.min(400, Math.max(2, Math.round((gap - 8) / 0.6)));

function transducer(meshTex: THREE.Texture, can: THREE.Material) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(CAN.r, CAN.r, CAN.depth - 0.5, 48, 1, true), can);
  body.rotation.x = Math.PI / 2; body.position.z = FRONT + (CAN.depth - 0.5) / 2;
  const crimp = new THREE.Mesh(new THREE.TorusGeometry(CAN.r - 0.15, 0.32, 8, 48), can); crimp.position.z = FRONT + 2.2;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(CAN.r - 0.45, 0.45, 10, 48), can); lip.position.z = SONAR_FACE_Z - 0.45;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(CAN.r - 0.6, 48), std('#9A9FA7', 0.55, 0.45, { map: meshTex }));
  mesh.position.z = SONAR_FACE_Z - 0.75;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(CAN.r + 0.2, CAN.r + 0.2, 0.8, 48), std('#2B2E35', 0.7));
  base.rotation.x = Math.PI / 2; base.position.z = FRONT + 0.4;
  g.add(body, crimp, lip, mesh, base);
  return g;
}

// HC-49/S crystal lying against the board front: a racetrack can.
function crystal() {
  const L = 11, W = 4.6, r = W / 2;
  const s = new THREE.Shape();
  s.moveTo(-L / 2 + r, -r); s.lineTo(L / 2 - r, -r); s.absarc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-L / 2 + r, r); s.absarc(-L / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3.0, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 20 }), std('#D9DDE2', 0.3, 0.75));
  const top = decal(8, 3, 50, (c, Wp, Hp) => silkText(c, '12.000', Wp / 2, Hp / 2, Hp * 0.62, 700, 'rgba(70,76,86,0.8)'));
  top.position.z = 3.27;
  g.add(can, top);
  return g;
}

function buildSensor() {
  const g = new THREE.Group();
  const meshTex = makeCanvasTexture(256, 256, (c) => {
    c.fillStyle = '#3A3E45'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#D3D7DD'; c.lineWidth = 2.2;
    for (let i = 0; i <= 256; i += 7.5) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); }
    const gr = c.createRadialGradient(128, 128, 20, 128, 128, 128); // the screen dips towards its rim
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  });
  const canMat = std('#C9CED5', 0.38, 0.6);
  // the PCB, its silkscreen front and back
  const pcbMat = std('#1D5DAA', 0.68);
  const pcb = rbox(BOARD.w, BOARD.h, BOARD.t, 0.3, pcbMat); pcb.position.set(0, BOARD.y0 + BOARD.h / 2, BOARD.z); g.add(pcb);
  const PX = 16, top = BOARD.y0 + BOARD.h;
  const toPx = (x: number, y: number): [number, number] => [(x + BOARD.w / 2) * PX, (top - y) * PX];
  const drawHoles = (c: CanvasRenderingContext2D) => {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) silkHole(c, ...toPx(sx * (BOARD.w / 2 - 1.8), BOARD.y0 + BOARD.h / 2 + sy * (BOARD.h / 2 - 1.8)), 0.8 * PX, 1.5 * PX);
  };
  const front = decal(BOARD.w, BOARD.h, PX, (c) => {
    drawHoles(c);
    silkText(c, 'T', ...toPx(-6.6, 19.6), 2.2 * PX);
    silkText(c, 'R', ...toPx(6.6, 19.6), 2.2 * PX);
    ['Vcc', 'Trig', 'Echo', 'Gnd'].forEach((t, i) => silkText(c, t, ...toPx(PINS_X[i], 7.4), 0.95 * PX, 700));
    for (const x of PINS_X) silkHole(c, ...toPx(x, LEG_Y), 0.42 * PX, 0.85 * PX);
  });
  front.position.set(0, BOARD.y0 + BOARD.h / 2, FRONT + 0.01); g.add(front);
  const back = decal(BOARD.w, BOARD.h, PX, (c) => {
    drawHoles(c);
    silkText(c, 'HC-SR04', ...toPx(0, 19.2), 1.7 * PX);
    for (const x of PINS_X) silkHole(c, ...toPx(x, LEG_Y), 0.42 * PX, 0.85 * PX);
  });
  back.rotation.y = Math.PI; back.position.set(0, BOARD.y0 + BOARD.h / 2, BOARD.z - BOARD.t / 2 - 0.01); g.add(back);
  // the driver chips on the back
  for (const [x, n, len] of [[-12, 7, 8.7], [3, 7, 8.7], [15.5, 4, 4.9]] as const) {
    const chip = soic(n, len, 3.9); chip.rotation.x = -Math.PI / 2; chip.position.set(x, 11.5, BOARD.z - BOARD.t / 2); g.add(chip);
  }
  // transmitter (T, left) and receiver (R, right)
  for (const sx of [-1, 1]) { const t = transducer(meshTex, canMat); t.position.set(sx * CAN.x, CAN.y, 0); g.add(t); }
  const xtal = crystal(); xtal.position.set(0, 18.4, FRONT + 0.2); g.add(xtal);
  // a little stand the board is pushed into
  const stand = rbox(40, 3.4, 9, 0.9, std('#3B4049', 0.75)); stand.position.set(0, 1.7, BOARD.z); g.add(stand);
  // a right-angle pin adapter: legs through the board into a long plastic body, the pins standing up at its front
  const body = rbox(4 * 2.54, 2.6, PIN_TIP.z + 1.4 - FRONT, 0.3, MATERIALS.header);
  body.position.set(0, LEG_Y, (FRONT + PIN_TIP.z + 1.4) / 2); g.add(body);
  for (const x of PINS_X) {
    g.add(legZ(x, LEG_Y, BOARD.z - BOARD.t / 2 - 0.5, FRONT + 0.5));
    g.add(pinMesh(x, PIN_TIP.z, LEG_Y, PIN_TIP.y));
    const j = solderJoint(); j.rotation.x = -Math.PI / 2; j.position.set(x, LEG_Y, BOARD.z - BOARD.t / 2 - 0.35); g.add(j);
  }
  return castSolid(g);
}

// A small toy car, its flat rear bumper towards the sensor (local origin: the bumper's face, on the bench).
function buildCar() {
  const g = new THREE.Group();
  const paint = std('#EFA238', 0.55), dark = std('#2A2C31', 0.8), trim = std('#D7DADF', 0.5), glass = std('#33414F', 0.3, 0.1);
  const red = std('#D8342B', 0.45, 0, { emissive: '#7A1008', emissiveIntensity: 0.4 });
  const body = rbox(28, 8.5, 40, 3, paint); body.position.set(0, 7.6, 21.5);
  const cabin = rbox(22, 6.4, 19, 2.2, glass); cabin.position.set(0, 14.8, 23.5);
  const roof = rbox(23, 1.8, 17.5, 0.8, paint); roof.position.set(0, 18.6, 23.5);
  const bumper = rbox(29, 3.6, 2.2, 0.8, trim); bumper.position.set(0, 5.4, 1.1);
  const plate = rbox(8, 3, 0.5, 0.2, std('#F6F4EE', 0.6)); plate.position.set(0, 9.2, 1.55);
  g.add(body, cabin, roof, bumper, plate);
  for (const sx of [-1, 1]) {
    const lamp = rbox(4.5, 2.2, 0.6, 0.3, red); lamp.position.set(sx * 9.5, 9.6, 1.5); g.add(lamp);
    for (const z of [9.5, 33.5]) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3.8, 28), dark); tyre.rotation.z = Math.PI / 2; tyre.position.set(sx * 13.6, 5, z);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 4.0, 20), trim); hub.rotation.z = Math.PI / 2; hub.position.set(sx * 13.6, 5, z);
      g.add(tyre, hub);
    }
  }
  const mats = [paint, dark, trim, glass, red, (plate.material as THREE.Material)];
  return { car: castSolid(g), mats };
}

// One outgoing sound arc: a flat band in the horizontal plane through the transducers, redrawn in place.
const ARC_SEG = 28, ARC_SPREAD = 0.55, ARC_W = 1.1;
function arcMesh(mat: THREE.Material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARC_SEG + 1) * 2 * 3), 3));
  const idx: number[] = [];
  for (let i = 0; i < ARC_SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const m = noRay(noOutline(new THREE.Mesh(geo, mat)));
  m.frustumCulled = false;
  return m;
}
function setArc(m: THREE.Mesh, r: number) {
  const pos = m.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= ARC_SEG; i++) {
    const a = -ARC_SPREAD + (2 * ARC_SPREAD * i) / ARC_SEG, s = Math.sin(a), c = Math.cos(a);
    pos.setXYZ(i * 2, (r - ARC_W / 2) * s, 0, (r - ARC_W / 2) * c);
    pos.setXYZ(i * 2 + 1, (r + ARC_W / 2) * s, 0, (r + ARC_W / 2) * c);
  }
  pos.needsUpdate = true;
}

function buildFx() {
  const g = new THREE.Group();
  const arcs = [0, 1, 2].map(() => {
    const m = arcMesh(new THREE.MeshBasicMaterial({ color: '#4FB6E8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(0, CAN.y, SONAR_FACE_Z);
    g.add(m);
    return m;
  });
  // a dashed measuring line on the bench from the sensor face to the bumper
  const dashTex = makeCanvasTexture(64, 8, (c) => { c.clearRect(0, 0, 64, 8); c.fillStyle = '#2F6FA8'; c.fillRect(0, 0, 36, 8); });
  dashTex.wrapS = THREE.RepeatWrapping;
  const line = noRay(noOutline(new THREE.Mesh(new THREE.PlaneGeometry(1, 0.9), new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, depthWrite: false, opacity: 0.85 }))));
  line.rotation.set(-Math.PI / 2, 0, Math.PI / 2); line.position.y = 0.15;
  const tickMat = new THREE.MeshBasicMaterial({ color: '#2F6FA8' });
  const ticks = [0, 1].map(() => { const t = noRay(noOutline(new THREE.Mesh(new THREE.PlaneGeometry(7, 0.9), tickMat))); t.rotation.x = -Math.PI / 2; t.position.y = 0.16; g.add(t); return t; });
  g.add(line);
  // the distance, floating over the gap
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
  const labelTex = new THREE.CanvasTexture(canvas); labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = noRay(noOutline(new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, depthTest: false }))));
  label.scale.set(19, 7.1, 1); label.renderOrder = 5;
  g.add(label);
  const drawLabel = (cm: number) => {
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, 256, 96);
    c.fillStyle = 'rgba(255,255,255,0.92)'; c.strokeStyle = '#2F6FA8'; c.lineWidth = 5;
    c.beginPath(); c.roundRect(5, 5, 246, 86, 40); c.fill(); c.stroke();
    c.fillStyle = '#1D3B5C'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 54px "Segoe UI", Roboto, Arial, sans-serif';
    c.fillText(cm >= 400 ? '— cm' : `${cm} cm`, 128, 51);
    labelTex.needsUpdate = true;
  };
  return { g, arcs, line, ticks, label, drawLabel };
}

export function Sonar({ at, inputs, onInput, state }: PartView) {
  const reduced = useReducedMotion();
  const cm = Math.min(400, Math.max(2, Math.round(inputs.cm ?? 30)));
  const powered = !!state?.powered;
  const parts = useMemo(() => {
    const root = new THREE.Group();
    const sensor = buildSensor();
    const { car, mats } = buildCar();
    const carHolder = new THREE.Group(); carHolder.add(car);
    const fx = buildFx();
    root.add(sensor, fx.g);
    noRay(fx.g);
    return { root, carHolder, carMats: mats, fx, last: { cm: -1, faded: false } };
  }, []);
  useDisposeOwned(parts.root);
  useDisposeOwned(parts.carHolder);

  // where the car stands
  const gap = gapOf(cm);
  const nearZ = SONAR_FACE_Z + gap;
  parts.carHolder.position.z = nearZ;
  const faded = cm >= 400; // nothing in range: the car is only a ghost of where it was
  if (faded !== parts.last.faded) {
    for (const m of parts.carMats) { m.transparent = faded; m.opacity = faded ? 0.35 : 1; m.depthWrite = !faded; m.needsUpdate = true; }
    parts.last.faded = faded;
  }
  const { fx } = parts;
  fx.line.scale.set(gap, 1, 1); fx.line.position.z = SONAR_FACE_Z + gap / 2;
  (fx.line.material as THREE.MeshBasicMaterial).map!.repeat.set(gap / 3, 1);
  fx.ticks[0].position.z = SONAR_FACE_Z; fx.ticks[1].position.z = nearZ;
  fx.label.position.set(-24, 6, SONAR_FACE_Z + gap / 2);
  if (cm !== parts.last.cm) { fx.drawLabel(cm); parts.last.cm = cm; }
  fx.g.visible = powered;

  // dragging the car along the bench sets the distance
  const atZ = 'x' in at ? at.z : 0;
  const grab = useRef(0), cmNow = useRef(cm);
  cmNow.current = cm;
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const drag = useBenchDrag((w) => {
    const v = cmOf(w.z - atZ - grab.current - SONAR_FACE_Z);
    if (v !== cmNow.current) { cmNow.current = v; onInput('cm', v); }
  });
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    grab.current = e.ray.intersectPlane(plane, hit) ? hit.z - atZ - nearZ : 0;
    drag(e);
  };

  const t = useRef(0);
  useFrame((_, dt) => {
    if (!powered) return;
    t.current = (t.current + Math.min(dt, 0.1)) % 1000;
    const reach = gapOf(cmNow.current);
    fx.arcs.forEach((m, i) => {
      const p = reduced ? (i + 1) / 4 : (t.current / 0.9 + i / 3) % 1;
      setArc(m, 3 + p * Math.max(1, reach - 4));
      (m.material as THREE.MeshBasicMaterial).opacity = (reduced ? 0.35 : 0.55 * Math.sin(Math.PI * Math.min(1, p * 1.15))) * (cmNow.current >= 400 ? 0.5 : 1);
    });
  });

  return (
    <group>
      <primitive object={parts.root} />
      {!soloMode() && <primitive object={parts.carHolder} onPointerDown={onDown}
        onPointerOver={() => { document.body.style.cursor = 'grab'; }} onPointerOut={() => { document.body.style.cursor = ''; }} />}
    </group>
  );
}
