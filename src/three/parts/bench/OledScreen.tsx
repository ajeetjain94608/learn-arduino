import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { liveDevices } from '../../../sim/liveDevices';
import { rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { std } from '../../shared/materials';
import type { PartView } from '../partView';
import { castSolid, decal, headerPlastic, noRay, pinMesh, silkHole, silkText, smd, SMD_CAP, solderJoint, useDisposeOwned } from './sensing/common';

// 0.96" 128 × 64 SSD1306 I²C OLED module lying face up: the header (GND, VCC, SCL, SDA) along its top edge (−z),
// the glass below it, its flex cable folded round the bottom edge. The panel shows the simulator's live picture.

const PCB = { w: 27.3, d: 27.8, t: 1.2, y0: 2.5 };       // the board stands on its header strip and two front spacers
const TOP = PCB.y0 + PCB.t;
const PINS_X = [-3.81, -1.27, 1.27, 3.81];               // GND, VCC, SCL, SDA (tips: PART_DEFS.oled.bench.pins)
const PIN_TIP = { y: 6, z: -11 };
const GLASS = { w: 26.7, d: 19.3, z0: -7.4 };             // glass outline: from z0 towards the bottom edge (+z)
const ACTIVE = { w: 21.74, d: 10.86, z0: -5.9 };          // the lit area, near the top of the glass
const W = 128, H = 64;

export const OLED_ON = [214, 240, 255] as const;   // ice-white pixels
const OFF = [3, 4, 6] as const;

// Draws an SSD1306 frame (128 × 64, page layout: byte x + (y >> 3) × 128, bit y & 7) into RGBA texels, top row last
// (a DataTexture's first row is its bottom).
export function paintFrame(frame: Uint8Array | undefined, on: boolean, out: Uint8Array): void {
  for (let y = 0; y < H; y++) {
    const page = (y >> 3) * W, bit = 1 << (y & 7), row = (H - 1 - y) * W * 4;
    for (let x = 0; x < W; x++) {
      const lit = on && !!frame && (frame[x + page] & bit) !== 0;
      const c = lit ? OLED_ON : OFF, i = row + x * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
    }
  }
}
// a cheap fingerprint of a frame, to redraw only when the picture changed
export function frameSum(frame: Uint8Array | undefined, on: boolean): number {
  if (!frame || !on) return -1;
  let h = 2166136261;
  for (let i = 0; i < frame.length; i++) h = Math.imul(h ^ frame[i], 16777619);
  return h >>> 0;
}

function buildOled() {
  const g = new THREE.Group();
  const pcbMat = std('#17233A', 0.7);
  const pcb = rbox(PCB.w, PCB.t, PCB.d, 0.3, pcbMat); pcb.position.y = PCB.y0 + PCB.t / 2; g.add(pcb);
  // silkscreen: pin names, mounting holes
  const PX = 20;
  const toPx = (x: number, z: number): [number, number] => [(x + PCB.w / 2) * PX, (z + PCB.d / 2) * PX];
  const silk = decal(PCB.w, PCB.d, PX, (c) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) silkHole(c, ...toPx(sx * (PCB.w / 2 - 2), sz * (PCB.d / 2 - 2)), 1.0 * PX, 1.4 * PX);
    ['GND', 'VCC', 'SCL', 'SDA'].forEach((t, i) => silkText(c, t, ...toPx(PINS_X[i], -8.85), 0.95 * PX, 700));
    for (const x of PINS_X) silkHole(c, ...toPx(x, PIN_TIP.z), 0.45 * PX, 0.85 * PX);
  });
  silk.rotation.x = -Math.PI / 2; silk.position.y = TOP + 0.01; g.add(silk);
  // the glass: substrate and cover, a black frame round the lit area, the driver's bond strip
  const glassMat = std('#07090D', 0.18, 0.15);
  const sub = rbox(GLASS.w, 0.7, GLASS.d, 0.15, glassMat); sub.position.set(0, TOP + 0.35 + 0.05, GLASS.z0 + GLASS.d / 2);
  const cover = rbox(GLASS.w - 0.6, 0.7, GLASS.d - 3.2, 0.15, glassMat); cover.position.set(0, TOP + 0.4 + 0.7, GLASS.z0 + (GLASS.d - 3.2) / 2);
  const bond = rbox(15, 0.3, 1.3, 0.05, std('#2B2E36', 0.5)); bond.position.set(0, TOP + 0.9, GLASS.z0 + GLASS.d - 1.3);
  g.add(sub, cover, bond);
  // the amber flex cable, from under the glass across the board and folded round its bottom edge to the back
  const flexMat = std('#C27A1F', 0.5, 0, { transparent: true, opacity: 0.94 });
  const flexLen = PCB.d / 2 - (GLASS.z0 + GLASS.d - 0.8);
  const flexTop = rbox(12, 0.12, flexLen, 0.04, flexMat); flexTop.position.set(0, TOP + 0.07, PCB.d / 2 - flexLen / 2);
  const fold = new THREE.Mesh(new THREE.CylinderGeometry(PCB.t / 2 + 0.12, PCB.t / 2 + 0.12, 12, 16, 1, true, -Math.PI / 2, Math.PI), flexMat);
  fold.rotation.z = Math.PI / 2; fold.position.set(0, PCB.y0 + PCB.t / 2, PCB.d / 2);
  const flexBack = rbox(12, 0.12, 5, 0.04, flexMat); flexBack.position.set(0, PCB.y0 - 0.07, PCB.d / 2 - 2.5);
  g.add(flexTop, fold, flexBack);
  // the live picture
  const data = new Uint8Array(W * H * 4);
  paintFrame(undefined, false, data);
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  const screen = noRay(noOutline(new THREE.Mesh(new THREE.PlaneGeometry(ACTIVE.w, ACTIVE.d), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))));
  screen.rotation.x = -Math.PI / 2; screen.position.set(0, TOP + 1.47 + 0.02, ACTIVE.z0 + ACTIVE.d / 2);
  g.add(screen);
  // the header: plastic strip under the board (it is what the top edge rests on), short legs up through it
  g.add(headerPlastic(4, 0, 0, PIN_TIP.z, PCB.y0));
  for (const x of PINS_X) {
    g.add(pinMesh(x, PIN_TIP.z, 0.3, PIN_TIP.y));
    const j = solderJoint(); j.position.set(x, TOP + 0.35, PIN_TIP.z); g.add(j);
  }
  // two nylon spacers under the bottom corners, and the parts on the back
  const nylon = std('#E8E2D2', 0.6);
  for (const sx of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, PCB.y0, 6), nylon); s.position.set(sx * (PCB.w / 2 - 2), PCB.y0 / 2, PCB.d / 2 - 2); g.add(s);
  }
  for (const [x, z] of [[-6, 2], [-3, 4], [5, 1], [8, 5]] as const) {
    const c = smd(1.6, 0.8, 0.5, SMD_CAP); c.rotation.x = Math.PI; c.position.set(x, PCB.y0, z); g.add(c);
  }
  return { g: castSolid(g), tex, data };
}

export function OledScreen({ id }: PartView) {
  const parts = useMemo(buildOled, []);
  useDisposeOwned(parts.g);
  const last = useRef<{ frame?: Uint8Array; on: boolean; sum: number }>({ on: false, sum: -2 });
  useFrame(() => {
    const s = liveDevices.states[id];
    const frame = s?.frame, on = !!s?.on;
    if (frame && frame === last.current.frame && on === last.current.on) return; // the same picture as last frame
    const sum = frameSum(frame, on);
    last.current.frame = frame; last.current.on = on;
    if (sum === last.current.sum) return;
    last.current.sum = sum;
    paintFrame(frame, on, parts.data);
    parts.tex.needsUpdate = true;
  });
  return <primitive object={parts.g} />;
}
