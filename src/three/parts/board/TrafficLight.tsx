import { useMemo } from 'react';
import * as THREE from 'three';
import { BB, colX, ROW } from '../../breadboard/breadboardGeometry';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { castAll, rbox } from '../../shared/geometry';
import { MATERIALS, std } from '../../shared/materials';
import type { PartView } from '../partView';
import { decal, glowSprite, glowTexture, lead, PITCH, useDisposeOnUnmount } from './kit';

const PCB = { w: 21, h: 56, t: 1.6 };
const PCB_Y = BB.H + 3.2;   // the board's bottom edge, held up by its header
const PCB_BACK = 3.0;       // the board's back face, this far in front of the pins
const PIN_Y = 1.6;          // header holes, above the board's bottom edge
const LEDS = [
  { key: 'R', y: 47, body: '#F04A3A', glow: '#FF2A1A', halo: '#FF5A3C' },
  { key: 'Y', y: 33, body: '#F5C83A', glow: '#FFC21A', halo: '#FFD24A' },
  { key: 'G', y: 19, body: '#3FC46A', glow: '#22E05A', halo: '#4CF07E' },
] as const;
type Lights = { R: number; Y: number; G: number };

function silkTexture() {
  const k = 10; // px per mm
  return makeCanvasTexture(PCB.w * k, PCB.h * k, (ctx) => {
    ctx.strokeStyle = ctx.fillStyle = '#E9ECEF'; ctx.lineWidth = 3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = (mm: number) => (PCB.h - mm) * k; // canvas y from mm above the bottom edge
    for (const l of LEDS) {
      ctx.beginPath(); ctx.arc(PCB.w * k / 2, y(l.y), 34, 0.25, Math.PI * 2 - 0.25); ctx.stroke(); // LED outline, flat at the cathode
      ctx.font = '700 34px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(l.key, 28, y(l.y));
    }
    ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif';
    ['R', 'Y', 'G', 'GND'].forEach((t, i) => ctx.fillText(t, PCB.w * k / 2 + (i - 1.5) * PITCH * k, y(PIN_Y + 3.2)));
    ctx.strokeRect(PCB.w * k / 2 - 2 * PITCH * k, y(PIN_Y + 1.5), 4 * PITCH * k, 3 * k);
  });
}

function build(col: number, z: number) {
  const g = new THREE.Group();
  const cx = colX(col) + 1.5 * PITCH, back = z + PCB_BACK, front = back + PCB.t;
  // the board: black, rounded corners, a mounting hole at the top
  const s = new THREE.Shape(), hw = PCB.w / 2, r = 1.2;
  s.moveTo(-hw + r, 0); s.lineTo(hw - r, 0); s.quadraticCurveTo(hw, 0, hw, r); s.lineTo(hw, PCB.h - r); s.quadraticCurveTo(hw, PCB.h, hw - r, PCB.h);
  s.lineTo(-hw + r, PCB.h); s.quadraticCurveTo(-hw, PCB.h, -hw, PCB.h - r); s.lineTo(-hw, r); s.quadraticCurveTo(-hw, 0, -hw + r, 0);
  const hole = new THREE.Path(); hole.absarc(0, PCB.h - 3.2, 1.6, 0, Math.PI * 2, true); s.holes.push(hole);
  const pcb = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: PCB.t, bevelEnabled: false, curveSegments: 16 }), [std('#1B1E23', 0.7), std('#3A3E44', 0.85)]);
  pcb.position.set(cx, PCB_Y, back); g.add(pcb);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.6, 32), MATERIALS.tin); ring.position.set(cx, PCB_Y + PCB.h - 3.2, front + 0.02); g.add(ring);
  const silk = decal(silkTexture(), PCB.w, PCB.h); silk.position.set(cx, PCB_Y + PCB.h / 2, front + 0.03); g.add(silk);
  // right-angle header: pins come out of the back, through a plastic spacer, and bend down into the holes
  const spacer = rbox(4 * PITCH, 2.5, 2.4, 0.2, MATERIALS.header); spacer.position.set(cx, PCB_Y + PIN_Y, back - 1.2); g.add(spacer);
  for (let i = 0; i < 4; i++) {
    const x = colX(col + i), py = PCB_Y + PIN_Y;
    g.add(lead([[x, py, front + 0.8], [x, py, z + 0.9], [x, py - 0.3, z + 0.1], [x, py - 1.2, z], [x, BB.H - 0.6, z]], 0.3, MATERIALS.tin));
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), MATERIALS.tin); joint.scale.set(1, 1, 0.5); joint.position.set(x, py, front + 0.2); g.add(joint);
  }
  // the LEDs face forward; a small resistor beside each
  const tex = glowTexture();
  const leds = LEDS.map((l) => {
    const epoxy = new THREE.MeshStandardMaterial({ color: l.body, emissive: l.glow, emissiveIntensity: 0, roughness: 0.15, transparent: true, opacity: 0.72 });
    const led = new THREE.Group();
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 1, 40), epoxy); flange.position.y = 0.5;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4.6, 40), epoxy); barrel.position.y = 3.3;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), epoxy); dome.position.y = 5.6;
    const die = rbox(0.6, 0.3, 0.6, 0.05, std('#FFD2A0', 0.5)); die.position.y = 3.6;
    led.add(flange, barrel, dome, die);
    for (const m of [flange, barrel, dome]) m.renderOrder = 2;
    led.rotation.x = Math.PI / 2; led.position.set(cx, PCB_Y + l.y, front + 0.8); g.add(led);
    const res = rbox(2.0, 1.25, 0.55, 0.12, std('#1E2024', 0.5)); res.position.set(cx + 6.6, PCB_Y + l.y, front + 0.28); g.add(res);
    for (const dx of [-0.85, 0.85]) { const cap = rbox(0.4, 1.3, 0.6, 0.1, MATERIALS.tin); cap.position.set(cx + 6.6 + dx, PCB_Y + l.y, front + 0.3); g.add(cap); }
    const halo = glowSprite(tex, 20, l.halo); halo.position.set(cx, PCB_Y + l.y, front + 5); g.add(halo);
    return { epoxy, halo };
  });
  castAll(g);
  const light = new THREE.PointLight('#ffffff', 0, 50, 1.8); g.add(light);
  return { g, leds, light, cx, front };
}

// Traffic-light LED module standing upright in the board: red, yellow and green LEDs (each with its own resistor
// on the board) and a header R, Y, G, GND. state.lights says how bright each one is.
export function TrafficLight({ at, state }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const m = useMemo(() => build(col, ROW[row]), [col, row]);
  useDisposeOnUnmount(m.g);
  const lights: Lights = state?.lights ?? { R: 0, Y: 0, G: 0 };
  let sum = 0, y = 0;
  const c = m.light.color.setRGB(0, 0, 0);
  LEDS.forEach((l, i) => {
    const v = Math.max(0, Math.min(1, lights[l.key]));
    m.leds[i].epoxy.emissiveIntensity = 1.6 * v;
    (m.leds[i].halo.material as THREE.SpriteMaterial).opacity = v;
    sum += v; y += v * l.y;
    m.leds[i].epoxy.emissive.getRGB(TMP); c.r += TMP.r * v; c.g += TMP.g * v; c.b += TMP.b * v;
  });
  if (sum > 0) { c.multiplyScalar(1 / sum); m.light.position.set(m.cx, PCB_Y + y / sum, m.front + 6); }
  m.light.intensity = 220 * Math.min(1, sum);
  return <primitive object={m.g} />;
}
const TMP = { r: 0, g: 0, b: 0 };
