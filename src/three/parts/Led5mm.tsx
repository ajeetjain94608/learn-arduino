import { useMemo } from 'react';
import * as THREE from 'three';
import { BB } from '../breadboard/breadboardGeometry';
import { makeCanvasTexture } from '../shared/canvasTexture';
import { castAll, rbox } from '../shared/geometry';
import { noOutline } from '../shared/layers';
import { MATERIALS, std } from '../shared/materials';

const PITCH = 2.54;
export const LED_LEG_H = 5;
export const LED_Y0 = BB.H + LED_LEG_H;     // underside of the flange, breadboard-local
export const LED_ANODE_TOP_Y = LED_Y0 + 3.6; // where current enters the die inside the body

const COLORS = {
  red: { body: '#F04A3A', glow: '#FF2A1A', light: '#FF3420', halo: [255, 70, 45] },
  green: { body: '#3FC46A', glow: '#22E05A', light: '#30FF6A', halo: [60, 230, 110] },
  yellow: { body: '#F5C83A', glow: '#FFD21A', light: '#FFE040', halo: [255, 215, 60] },
  blue: { body: '#3E7BF0', glow: '#2A6BFF', light: '#4A86FF', halo: [70, 130, 255] },
  white: { body: '#EDEFF2', glow: '#FFFFFF', light: '#F4F8FF', halo: [235, 242, 255] },
} as const;
export type LedColor = keyof typeof COLORS;

// The LED as plain three.js objects (also used by tools/bake-thumbs for the project picture).
export function buildLed5mm(color: keyof typeof COLORS = 'red') {
  const c = COLORS[color];
  const epoxy = new THREE.MeshStandardMaterial({ color: c.body, emissive: c.glow, emissiveIntensity: 0, roughness: 0.12, transparent: true, opacity: 0.62, depthWrite: false });
  const g = new THREE.Group();
  for (const [x, len] of [[-PITCH / 2, LED_LEG_H + 3.4], [PITCH / 2, LED_LEG_H + 3.0]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, len, 8), MATERIALS.metal);
    leg.position.set(x, BB.H + len / 2 - 0.3, 0); g.add(leg);
  }
  const frame = std('#8F959E', 0.4, 0.6);
  const post = rbox(0.7, 1.4, 0.5, 0.1, frame); post.position.set(-PITCH / 2 + 0.2, LED_Y0 + 3.4, 0);
  const anvil = rbox(1.9, 1.6, 0.6, 0.15, frame); anvil.position.set(PITCH / 2 - 0.35, LED_Y0 + 3.3, 0);
  const die = rbox(0.5, 0.3, 0.5, 0.05, std('#FFD2A0', 0.5)); die.position.set(PITCH / 2 - 0.6, LED_Y0 + 4.2, 0);
  const bond = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 16, Math.PI), frame); bond.position.set(-0.2, LED_Y0 + 4.1, 0);
  g.add(post, anvil, die, bond);
  const flangeGeo = new THREE.CylinderGeometry(2.9, 2.9, 1.0, 40);
  const pos = flangeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setX(i, Math.min(pos.getX(i), 2.45)); // flat edge marks the cathode
  flangeGeo.computeVertexNormals();
  const flange = new THREE.Mesh(flangeGeo, epoxy); flange.position.y = LED_Y0 + 0.5;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5.2, 40, 1, true), epoxy); body.position.y = LED_Y0 + 3.6;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), epoxy); dome.position.y = LED_Y0 + 6.2;
  g.add(flange, body, dome);
  castAll(g);
  for (const m of [flange, body, dome]) m.renderOrder = 2;
  const [r, gg, b] = c.halo;
  const haloTex = makeCanvasTexture(128, 128, (ctx) => {
    const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${r},${gg},${b},0.75)`); gr.addColorStop(0.3, `rgba(${r},${gg},${b},0.32)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  });
  const halo = noOutline(new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, depthWrite: false, transparent: true, opacity: 0 })));
  halo.scale.set(24, 24, 1); halo.position.y = LED_Y0 + 4.5;
  halo.raycast = () => {}; // the glow is light, not something you can tap
  const light = new THREE.PointLight(c.light, 0, 45, 1.8); light.position.y = LED_Y0 + 5;
  g.add(halo, light);
  return { g, epoxy, halo, light };
}

// 5 mm LED standing in two adjacent holes: anode (long leg) at -x, cathode (flat edge) at +x.
// Clear epoxy shows the lead frame inside. `lit` 0..1 drives glow and light.
export function Led5mm({ position, color = 'red', lit = 0 }: { position: [number, number, number]; color?: keyof typeof COLORS; lit?: number }) {
  const parts = useMemo(() => buildLed5mm(color), [color]);

  parts.epoxy.emissiveIntensity = 1.6 * lit;
  (parts.halo.material as THREE.SpriteMaterial).opacity = lit;
  parts.light.intensity = 260 * lit;
  return <primitive object={parts.g} position={position} />;
}
