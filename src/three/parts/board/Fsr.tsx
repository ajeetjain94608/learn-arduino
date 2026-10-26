import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { BB, colX, ROW } from '../../breadboard/breadboardGeometry';
import { usePressDrag } from '../../build/controls3d';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { castAll, rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import type { PartView } from '../partView';
import { PITCH, useDisposeOnUnmount } from './kit';

const PAD_R = 9.15;     // 18.3 mm round sensing pad
const ACTIVE_R = 6.4;   // its active area
const TAIL_W = 5.6;
const TAIL_T = 0.35;
const RISE = BB.H + 6;  // the tail stands up out of the board, then runs over the edge to the bench
const EDGE = BB.W / 2;

// calibration weights stacked on the pad when a weight is set (largest at the bottom)
const WEIGHTS = [
  { g: 1000, r: 11, h: 11, label: '1 kg' },
  { g: 500, r: 9.5, h: 8, label: '500 g' },
  { g: 200, r: 7.6, h: 6, label: '200 g' },
  { g: 100, r: 6.4, h: 4.6, label: '100 g' },
];
const MAX_STACK = 6;
export function weightStack(grams: number): number[] {
  const out: number[] = [];
  let left = grams;
  for (let i = 0; i < WEIGHTS.length && out.length < MAX_STACK; i++) {
    while (left >= WEIGHTS[i].g - 1 && out.length < MAX_STACK) { out.push(i); left -= WEIGHTS[i].g; }
  }
  return out;
}

// A flat strip along a curve in the y-z plane (its width along x), with a top, a bottom and edges.
function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, thick: number, n = 64): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const side = new THREE.Vector3(1, 0, 0), t = new THREE.Vector3(), nrm = new THREE.Vector3(), p = new THREE.Vector3();
  const len = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    curve.getPointAt(s, p); curve.getTangentAt(s, t);
    nrm.crossVectors(t, side).normalize(); // the strip's "up"
    if (nrm.y < 0 && Math.abs(t.y) < 0.99) nrm.negate();
    for (const [w, h] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
      pos.push(p.x + (w * width) / 2, p.y + (nrm.y * h * thick) / 2, p.z + (nrm.z * h * thick) / 2);
      uv.push((w + 1) / 2, s * len / 20);
    }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function build(col: number, z: number) {
  const g = new THREE.Group();
  const cx = colX(col) + PITCH / 2, s = z < 0 ? -1 : 1; // the pad goes off the nearer long edge
  const padZ = s * (EDGE + 6 + PAD_R);
  // the tail: up out of the board, over the edge and down onto the bench, flat to the pad
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx, BB.H + 2.2, z), new THREE.Vector3(cx, RISE - 1.6, z), new THREE.Vector3(cx, RISE, z + s * 2),
    new THREE.Vector3(cx, RISE, s * (EDGE - 2)), new THREE.Vector3(cx, RISE - 3, s * (EDGE + 1.5)), new THREE.Vector3(cx, 2.5, s * (EDGE + 3.5)),
    new THREE.Vector3(cx, 0.25, s * (EDGE + 6.5)), new THREE.Vector3(cx, 0.2, padZ - s * PAD_R * 0.7),
  ], false, 'centripetal');
  const tailTex = makeCanvasTexture(64, 256, (ctx) => {
    ctx.fillStyle = '#CDB98C'; ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = '#B7BCC2'; ctx.fillRect(12, 0, 10, 256); ctx.fillRect(42, 0, 10, 256);
  });
  tailTex.wrapT = THREE.RepeatWrapping;
  const tail = new THREE.Mesh(ribbon(curve, TAIL_W, TAIL_T), std('#ffffff', 0.55, 0, { map: tailTex }));
  g.add(tail);
  // the crimped connector: two silver clinch tabs and square pins into the holes
  for (const hx of [colX(col), colX(col + 1)]) {
    const clinch = rbox(1.9, 3.4, 1.4, 0.3, MATERIALS.tin); clinch.position.set(hx, BB.H + 2.8, z); g.add(clinch);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 3.4, 0.64), MATERIALS.metal); pin.position.set(hx, BB.H - 0.2, z); g.add(pin);
  }
  // the pad: a tan base film, a black spacer ring and the darker active area in the middle
  const pad = new THREE.Group(); pad.position.set(cx, 0, padZ);
  const film = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R, 0.25, 48), std('#CDB98C', 0.55)); film.position.y = 0.125; pad.add(film);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R - 0.1, PAD_R - 0.1, 0.25, 48), std('#1E2024', 0.55)); ring.position.y = 0.37; pad.add(ring);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(TAIL_W + 2, 0.48, 5), std('#1E2024', 0.55)); neck.position.set(0, 0.24, -s * (PAD_R - 1.5)); pad.add(neck);
  const activeGeo = new THREE.CylinderGeometry(ACTIVE_R, ACTIVE_R, 0.3, 48); activeGeo.translate(0, 0.15, 0);
  const active = new THREE.Mesh(activeGeo, std('#3A3631', 0.3)); active.position.y = 0.4; pad.add(active);
  castAll(pad);
  // a fingertip pressing (only while pressed) and a soft pressure ring on the pad
  const finger = new THREE.Group();
  const skin = std('#E2B08E', 0.75);
  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(6.2, 26, 8, 20), skin); tip.position.y = 13 + 6.2; finger.add(tip);
  const nail = new THREE.Mesh(new THREE.CapsuleGeometry(4.6, 8, 6, 16), std('#F1CDB8', 0.35));
  nail.scale.set(1, 1, 0.35); nail.position.set(0, 8.5 + 4, -s * 5.2); finger.add(nail);
  finger.rotation.x = s * 0.55; // tilted the way a finger comes in from in front
  castAll(finger); finger.visible = false; pad.add(finger);
  const pressTex = makeCanvasTexture(128, 128, (ctx) => {
    const gr = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,170,60,0)'); gr.addColorStop(0.65, 'rgba(255,170,60,0.85)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  });
  const glow = noOutline(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: pressTex, transparent: true, depthWrite: false, opacity: 0 })));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.9; glow.raycast = () => {}; pad.add(glow);
  // weights: one mesh per slot in the stack, its size and label set when the weight changes
  const labels = WEIGHTS.map((w) => makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#C3C8CF'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#A3A9B1'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#4A5059'; ctx.font = `700 ${w.label.length > 4 ? 26 : 32}px "Helvetica Neue", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(w.label, 64, 66);
  }));
  for (const t of labels) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; } // the label reads from the front of the bench
  const steel = std('#C3C8CF', 0.35, 0.6);
  const weightGeo = WEIGHTS.map((w) => new THREE.CylinderGeometry(w.r, w.r, w.h, 48));
  const weightMat = WEIGHTS.map((_, i) => [steel, std('#ffffff', 0.4, 0.4, { map: labels[i] }), steel]);
  const stack = Array.from({ length: MAX_STACK }, () => {
    const m = new THREE.Mesh(weightGeo[0], weightMat[0]); m.visible = false; m.castShadow = m.receiveShadow = true; pad.add(m);
    return m;
  });
  castAll(g);
  // every weight's geometry and material, held here so they are freed with the part even if never shown
  const spares = new THREE.Group();
  WEIGHTS.forEach((_, i) => spares.add(new THREE.Mesh(weightGeo[i], weightMat[i])));
  return { g, pad, spares, active, finger, glow, stack, weightGeo, weightMat };
}

// Force-sensing resistor: its tail plugged into two holes, its round pad lying on the bench past the board's edge.
// Press the pad and drag down to push harder (inputs.grams); a set weight shows as calibration weights on the pad.
export function Fsr({ at, inputs, onInput }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const m = useMemo(() => build(col, ROW[row]), [col, row]);
  useDisposeOnUnmount(m.g, m.pad, m.spares);
  const [pressing, setPressing] = useState(false);
  const grams = Math.max(0, inputs.grams ?? 0);
  const press = usePressDrag(
    (px) => onInput('grams', Math.round(Math.min(5000, px * 20) / 10) * 10),
    () => { setPressing(false); onInput('grams', 0); },
  );

  const k = Math.min(1, grams / 5000);
  m.active.scale.y = 1 - 0.6 * k; // the pad gives a little under load
  m.finger.visible = pressing;
  m.finger.position.y = 0.6 - 0.4 * k;
  const glowMat = m.glow.material as THREE.MeshBasicMaterial;
  glowMat.opacity = pressing && grams > 0 ? 0.35 + 0.6 * k : 0;
  const gs = 2 * (8 + 6 * k); m.glow.scale.set(gs, gs, 1);
  const stack = pressing ? [] : weightStack(grams);
  let y = 0.7 - 0.12 * k;
  m.stack.forEach((mesh, i) => {
    mesh.visible = i < stack.length;
    if (!mesh.visible) return;
    const w = WEIGHTS[stack[i]];
    mesh.geometry = m.weightGeo[stack[i]]; mesh.material = m.weightMat[stack[i]];
    mesh.position.y = y + w.h / 2; y += w.h;
  });

  return (
    <>
      <primitive object={m.g} />
      <primitive object={m.pad} onPointerDown={(e: Parameters<typeof press>[0]) => { setPressing(true); press(e); }} />
    </>
  );
}
