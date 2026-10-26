import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import { useReducedMotion } from '../../shared/motion';
import type { PartView } from '../partView';
import { castSolid, decal, headerPlastic, legZ, noRay, PITCH, pinMesh, silkText, smd, SMD_CAP, SMD_RES, soic, solderJoint, useDisposeOwned } from './sensing/common';

// Capacitive soil-moisture sensor (v1.2 style) pushed into a terracotta pot with a small plant, and a watering can
// beside it: press and hold the can to water the plant (moisture rises ~20 %/s). The soil darkens as it gets wetter,
// cracks when dry, and the plant droops below 30 %.

const POT = { rim: 34.4, soil: 30.6, soilR: 23.6 };
const PROBE = { w: 23, t: 1.6, top: 53, bottom: 4, z: 11.95 };   // the visible part of the 98 mm probe; z = centre plane
const PROBE_FRONT = PROBE.z + PROBE.t / 2;
const PINS_X = [-PITCH, 0, PITCH];                               // GND, VCC, AOUT (tips: PART_DEFS.soil.bench.pins)
const PIN_TIP = { y: 58, z: 14 };
const LEG_Y = 51.75;
const CAN_REST = new THREE.Vector3(52, 0, 4), CAN_POUR = new THREE.Vector3(43, 40, 4), CAN_TILT = 0.72;
const POUR_RATE = 20; // % per second while the can pours

// a small seeded random, so every pot looks the same
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function buildPot() {
  const g = new THREE.Group();
  const clay = std('#C46A3E', 0.88, 0, { side: THREE.DoubleSide });
  const v = (pts: number[][]) => pts.map(([r, y]) => new THREE.Vector2(r, y));
  const saucer = new THREE.Mesh(new THREE.LatheGeometry(v([[0, 1.0], [26.2, 1.0], [27.3, 3.7], [28.6, 3.7], [28.6, 3.2], [24.6, 0], [0, 0]]), 64), clay);
  const pot = new THREE.Mesh(new THREE.LatheGeometry(v([[0, 1.0], [20.6, 1.0], [21.0, 1.6], [24.5, 26.6], [27.3, 27.0], [27.6, 33.8], [27.1, POT.rim],
    [25.2, POT.rim], [24.4, 33.6], [POT.soilR, POT.soil - 0.4], [0, POT.soil - 0.4]]), 72), clay);
  g.add(saucer, pot);
  // the soil: a low mound with grains, cracks on top when dry, a few clods
  const R = POT.soilR + 0.3;
  const soilGeo = new THREE.RingGeometry(0, R, 64, 8);
  const p = soilGeo.attributes.position, rand = rng(7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y) / R;
    p.setZ(i, r > 0.98 ? -0.3 : 1.1 * (1 - r * r) + (rand() - 0.5) * 0.35);
  }
  soilGeo.computeVertexNormals();
  const grain = makeCanvasTexture(256, 256, (c) => {
    const r = rng(3);
    c.fillStyle = '#E4E0DA'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const k = r(); c.fillStyle = k < 0.5 ? `rgba(70,55,40,${0.15 + r() * 0.3})` : `rgba(255,250,240,${0.2 + r() * 0.35})`;
      const s = 1 + r() * 3; c.fillRect(r() * 256, r() * 256, s, s);
    }
  });
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(2, 2);
  const soilMat = std('#7A5A3C', 0.92, 0, { map: grain });
  const soil = new THREE.Mesh(soilGeo, soilMat); soil.rotation.x = -Math.PI / 2; soil.position.y = POT.soil;
  const cracks = makeCanvasTexture(512, 512, (c) => {
    c.clearRect(0, 0, 512, 512);
    const r = rng(11);
    c.strokeStyle = 'rgba(48,32,20,0.95)'; c.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      let x = 40 + r() * 432, y = 40 + r() * 432, a = r() * Math.PI * 2;
      c.lineWidth = 2.5 + r() * 2.5; c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < 7; s++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * 22; y += Math.sin(a) * 22; c.lineTo(x, y); c.lineWidth *= 0.85; }
      c.stroke();
    }
  });
  const crackMat = new THREE.MeshBasicMaterial({ map: cracks, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const crack = noRay(noOutline(new THREE.Mesh(soilGeo, crackMat))); crack.rotation.x = -Math.PI / 2; crack.position.y = POT.soil + 0.03;
  g.add(soil, crack);
  const clodGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, d = 6 + rand() * 14, s = 0.7 + rand() * 0.9;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(z - PROBE.z) < 3 && Math.abs(x) < 13) continue; // not inside the probe
    const clod = new THREE.Mesh(clodGeo, soilMat); clod.scale.set(s, s * 0.6, s);
    clod.position.set(x, POT.soil + 1.1 * (1 - (d / R) ** 2) + 0.1, z); clod.rotation.set(rand() * 3, rand() * 3, 0);
    g.add(noRay(clod));
  }
  return { g, soilMat, crackMat };
}

// The probe: black PCB, the circuit at the top, the white line that marks how deep it may go.
function buildProbe() {
  const g = new THREE.Group();
  const h = PROBE.top - PROBE.bottom;
  const pcb = rbox(PROBE.w, h, PROBE.t, 0.6, std('#1A1C21', 0.66)); pcb.position.set(0, PROBE.bottom + h / 2, PROBE.z); g.add(pcb);
  const PX = 16, DH = 24, y0 = PROBE.top - DH;  // the decal covers the top 24 mm
  const toPx = (x: number, y: number): [number, number] => [(x + PROBE.w / 2) * PX, (PROBE.top - y) * PX];
  const silk = decal(PROBE.w, DH, PX, (c) => {
    c.strokeStyle = 'rgba(120,128,140,0.35)'; c.lineWidth = 0.35 * PX; c.lineJoin = 'round';
    for (const path of [[[-6.5, 46], [-6.5, 43.5], [-2.5, 43.5]], [[6.5, 41], [4, 41], [4, 44]], [[-3, 37.5], [-3, 40.5]], [[3, 37.5], [3, 40.5]], [[0, 49.5], [0, 46]]]) {
      c.beginPath(); path.forEach(([x, y], i) => (i ? c.lineTo(...toPx(x, y)) : c.moveTo(...toPx(x, y)))); c.stroke();
    }
    ['GND', 'VCC', 'AOUT'].forEach((t, i) => silkText(c, t, ...toPx(PINS_X[i] * 1.18, 48.9), 0.95 * PX, 700));
    silkText(c, 'Capacitive Soil', ...toPx(0, 35.6), 1.25 * PX, 600);
    silkText(c, 'Moisture Sensor v1.2', ...toPx(0, 33.9), 1.25 * PX, 600);
    c.fillStyle = '#F2F2EE'; c.fillRect(0, (PROBE.top - 32.1) * PX, PROBE.w * PX, 0.9 * PX); // the line: soil up to here
  });
  silk.position.set(0, y0 + DH / 2, PROBE_FRONT + 0.01); g.add(silk);
  // the circuit: a timer chip, a regulator, a few resistors and capacitors
  const onFace = (o: THREE.Object3D, x: number, y: number, rotZ = 0) => { o.rotation.set(Math.PI / 2, 0, 0); o.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), rotZ); o.position.set(x, y, PROBE_FRONT); g.add(o); };
  onFace(soic(4, 4.9, 3.9, '555'), 0, 42.5);
  onFace(rbox(2.9, 1.1, 1.6, 0.15, MATERIALS.chip), 6.5, 46.5);
  for (const [x, y, cap, rz] of [[-6.5, 46, 0, 0], [-6.5, 41.5, 1, 0], [6.5, 41.5, 1, Math.PI / 2], [-3.2, 38.2, 0, Math.PI / 2], [3.2, 38.2, 1, Math.PI / 2]] as const) {
    onFace(smd(1.6, 0.8, 0.5, cap ? SMD_CAP : SMD_RES), x, y, rz);
  }
  // the right-angle header at the top: legs through the board, plastic on the front, pins standing up
  g.add(headerPlastic(3, 0, LEG_Y - 1.25, PIN_TIP.z));
  for (const x of PINS_X) {
    g.add(legZ(x, LEG_Y, PROBE.z - PROBE.t / 2 - 0.5, PIN_TIP.z));
    g.add(pinMesh(x, PIN_TIP.z, LEG_Y - 0.32, PIN_TIP.y));
    const j = solderJoint(); j.rotation.x = -Math.PI / 2; j.position.set(x, LEG_Y, PROBE.z - PROBE.t / 2 - 0.35); g.add(j);
  }
  return g;
}

// A small plant: a stem in two parts (the upper one bends when it droops) and leaves on pivots.
function leafGeo(len: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(len * 0.32, len * 0.2, len * 0.28, len * 0.68, 0, len); s.bezierCurveTo(-len * 0.28, len * 0.68, -len * 0.32, len * 0.2, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 0.09 * x * x - 0.012 * y * y); } // cupped, tip curling down
  geo.rotateX(Math.PI / 2); // lies along +z, face up
  geo.computeVertexNormals();
  return geo;
}
function buildPlant() {
  const root = new THREE.Group(); root.position.set(-7, POT.soil + 0.5, -8);
  const stemMat = std('#5D8C3A', 0.75), leafMat = std('#4E9A43', 0.72, 0, { side: THREE.DoubleSide });
  const stem = (len: number) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.4, len * 0.5, 0.2), new THREE.Vector3(0, len, 0)]), 8, 0.75, 8), stemMat);
    return m;
  };
  root.add(stem(14));
  const upper = new THREE.Group(); upper.position.y = 14; upper.add(stem(12)); root.add(upper);
  const leaves: { pivot: THREE.Group; up: number }[] = [];
  const geos = new Map<number, THREE.BufferGeometry>();
  const leaf = (parent: THREE.Group, y: number, yaw: number, len: number, up: number) => {
    if (!geos.has(len)) geos.set(len, leafGeo(len));
    const pivot = new THREE.Group(); pivot.position.y = y; pivot.rotation.order = 'YXZ'; pivot.rotation.y = yaw;
    pivot.add(new THREE.Mesh(geos.get(len)!, leafMat)); parent.add(pivot);
    leaves.push({ pivot, up });
  };
  leaf(root, 6, 0.4, 12, 0.35); leaf(root, 10, 3.0, 13, 0.4);
  leaf(upper, 5, 4.6, 12, 0.5); leaf(upper, 8.5, 1.6, 11, 0.55);
  leaf(upper, 12, 0.9, 8, 0.9); leaf(upper, 12, 3.9, 8, 0.9);
  return { root, upper, leaves, leafMat };
}

// A galvanised watering can (origin: the centre of its base); the spout points to −x.
function buildCan() {
  const g = new THREE.Group();
  const zinc = std('#AEB5BD', 0.48, 0.55), brass = std('#C9A140', 0.42, 0.5);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(10.4, 11.5, 24, 44), zinc); body.position.y = 12;
  const foot = new THREE.Mesh(new THREE.TorusGeometry(11.35, 0.6, 8, 44), zinc); foot.rotation.x = Math.PI / 2; foot.position.y = 0.6;
  const seam = new THREE.Mesh(new THREE.TorusGeometry(10.95, 0.35, 8, 44), zinc); seam.rotation.x = Math.PI / 2; seam.position.y = 15;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 10.4, 2.6, 44), zinc); top.position.y = 25.3;
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.7, 8, 36), zinc); mouth.rotation.x = Math.PI / 2; mouth.position.y = 26.6;
  const hole = noRay(new THREE.Mesh(new THREE.CircleGeometry(5.4, 32), std('#2A2E34', 0.9))); hole.rotation.x = -Math.PI / 2; hole.position.y = 26.55;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(7.2, 1.2, 10, 28, Math.PI), zinc); handle.rotation.z = -Math.PI / 2; handle.position.set(10.2, 14, 0);
  const spoutCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-8.5, 4.5, 0), new THREE.Vector3(-14, 10.5, 0), new THREE.Vector3(-18.6, 17, 0), new THREE.Vector3(-21, 21.3, 0)]);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 16, 1.35, 10), zinc);
  const dir = new THREE.Vector3(-2.4, 4.3, 0).normalize();
  const rose = new THREE.Group(); rose.position.set(-21.6, 22.4, 0); rose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 1.5, 3.2, 24), brass);
  const holes = makeCanvasTexture(128, 128, (c) => {
    c.fillStyle = '#C9A140'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#3A2E14';
    for (let r = 0; r < 4; r++) { const n = r ? r * 6 : 1; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; c.beginPath(); c.arc(64 + Math.cos(a) * r * 15, 64 + Math.sin(a) * r * 15, 3.6, 0, Math.PI * 2); c.fill(); } }
  });
  const face = noRay(new THREE.Mesh(new THREE.CircleGeometry(3.25, 24), std('#C9A140', 0.5, 0.4, { map: holes }))); face.rotation.x = -Math.PI / 2; face.position.y = 1.62;
  const nozzle = new THREE.Object3D(); nozzle.position.y = 2.5; // where the water leaves
  rose.add(cone, face, nozzle);
  g.add(body, foot, seam, top, mouth, hole, handle, spout, rose);
  return { g: castSolid(g), nozzle };
}

const DROPS = 8;
function buildDrops() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.75, 10, 8), mat = new THREE.MeshStandardMaterial({ color: '#6CB8EC', roughness: 0.15, transparent: true, opacity: 0.85, depthWrite: false });
  const drops = Array.from({ length: DROPS }, (_, i) => {
    const m = noRay(noOutline(new THREE.Mesh(geo, mat))); m.scale.set(1, 1.7, 1);
    m.userData.dx = Math.sin(i * 2.4) * 1.6; m.userData.dz = Math.cos(i * 1.7) * 1.6;
    g.add(m); return m;
  });
  g.visible = false;
  return { g, drops };
}

const DRY = new THREE.Color('#B48D60'), WET = new THREE.Color('#3A291B');
const LEAF_OK = new THREE.Color('#4E9A43'), LEAF_LIMP = new THREE.Color('#93A04A');

export function SoilSensor({ inputs, onInput }: PartView) {
  const reduced = useReducedMotion();
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const moisture = Math.min(100, Math.max(0, Math.round(inputs.moisture ?? 50)));
  const parts = useMemo(() => {
    const root = new THREE.Group();
    const pot = buildPot(), probe = buildProbe(), plant = buildPlant(), drops = buildDrops();
    root.add(pot.g, probe, plant.root, drops.g);
    castSolid(root);
    const can = buildCan();
    const canHolder = new THREE.Group(); canHolder.add(can.g); canHolder.position.copy(CAN_REST);
    return { root, pot, plant, drops, can, canHolder };
  }, []);
  useDisposeOwned(parts.root);
  useDisposeOwned(parts.canHolder);

  // soil: lighter and cracked when dry, dark and a little glossy when wet
  const m = moisture / 100;
  parts.pot.soilMat.color.lerpColors(DRY, WET, Math.pow(m, 0.8));
  parts.pot.soilMat.roughness = 0.95 - 0.4 * m;
  parts.pot.crackMat.opacity = Math.min(1, Math.max(0, (35 - moisture) / 30)) * 0.85;

  // press and hold the watering can: it tips over the pot and pours
  const live = useRef({ held: false, pour: 0, droop: -1, level: moisture, sent: moisture, t: 0 });
  const latest = useRef({ onInput, moisture });
  latest.current = { onInput, moisture };
  if (!live.current.held) { live.current.level = moisture; live.current.sent = moisture; }
  const release = useRef<(() => void) | null>(null);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (live.current.held) return;
    live.current.held = true;
    live.current.level = live.current.sent = latest.current.moisture;
    if (controls) controls.enabled = false;
    const up = () => {
      live.current.held = false;
      if (controls) controls.enabled = true;
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      release.current = null;
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    release.current = up;
  };
  useEffect(() => () => release.current?.(), []);

  const tmp = useMemo(() => ({ v: new THREE.Vector3() }), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), s = live.current;
    // the can
    const target = s.held ? 1 : 0;
    s.pour = reduced ? target : s.pour + (target - s.pour) * Math.min(1, dt * 7);
    const k = s.pour * s.pour * (3 - 2 * s.pour);
    parts.canHolder.position.lerpVectors(CAN_REST, CAN_POUR, k);
    parts.canHolder.rotation.z = CAN_TILT * k;
    // the water
    const pouring = s.held && s.pour > 0.85;
    if (pouring) {
      s.level = Math.min(100, s.level + POUR_RATE * dt);
      const v = Math.round(s.level);
      if (v !== s.sent) { s.sent = v; latest.current.onInput('moisture', v); }
    }
    parts.drops.g.visible = pouring;
    if (pouring) {
      s.t += dt;
      parts.can.nozzle.getWorldPosition(tmp.v); parts.root.worldToLocal(tmp.v);
      const fall = tmp.v.y - POT.soil;
      parts.drops.drops.forEach((d, i) => {
        const p = reduced ? (i + 0.5) / DROPS : (s.t * 2.2 + i / DROPS) % 1;
        d.position.set(tmp.v.x - 1.5 * p + d.userData.dx * p, tmp.v.y - fall * p * p, tmp.v.z + d.userData.dz * p);
      });
    }
    // the plant droops when the soil is dry
    const want = latest.current.moisture < 30 ? (30 - latest.current.moisture) / 30 : 0;
    const droop = s.droop < 0 || reduced ? want : s.droop + (want - s.droop) * Math.min(1, dt * 3);
    if (droop !== s.droop) {
      s.droop = droop;
      const pl = parts.plant;
      pl.upper.rotation.x = 0.75 * droop; pl.upper.rotation.z = -0.25 * droop;
      for (const l of pl.leaves) l.pivot.rotation.x = -(l.up - 1.25 * droop);
      pl.leafMat.color.lerpColors(LEAF_OK, LEAF_LIMP, droop);
    }
  });

  return (
    <group>
      <primitive object={parts.root} />
      <primitive object={parts.canHolder} onPointerDown={onDown}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }} />
    </group>
  );
}
