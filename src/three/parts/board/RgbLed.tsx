import { useMemo } from 'react';
import * as THREE from 'three';
import { BB, colX, ROW } from '../../breadboard/breadboardGeometry';
import { castAll, rbox } from '../../shared/geometry';
import { std } from '../../shared/materials';
import type { PartView } from '../partView';
import { glowSprite, glowTexture, lead, PITCH, useDisposeOnUnmount } from './kit';

const Y0 = BB.H + 4.6; // underside of the flange
const LEG_OUT = [-1.9, -0.63, 0.63, 1.9]; // where the four leads leave the body (they are 1.27 mm apart)

function build(col: number, z: number) {
  const g = new THREE.Group();
  const cx = colX(col) + 1.5 * PITCH;
  // R, K (the longest — it carries all three colours), G, B: out of the body at 1.27 mm, bent out to 2.54 mm holes
  LEG_OUT.forEach((dx, i) => {
    const hx = colX(col + i);
    g.add(lead([[cx + dx, Y0 + (i === 1 ? 3.6 : 2.8), z], [cx + dx, Y0 - 0.8, z], [hx, Y0 - 2.9, z], [hx, BB.H + 0.6, z], [hx, BB.H - 0.6, z]], 0.24));
  });
  // inside: a lead frame and three tiny dies on the cathode cup, barely seen through the milky epoxy
  const frame = std('#9097A0', 0.45, 0.5);
  const cup = rbox(1.8, 0.9, 0.9, 0.2, frame); cup.position.set(cx - 0.63, Y0 + 3.9, z); g.add(cup);
  ['#FF5A4A', '#4CE07A', '#5A8CFF'].forEach((c, i) => {
    const die = rbox(0.35, 0.25, 0.35, 0.04, std(c, 0.5)); die.position.set(cx - 1.15 + i * 0.5, Y0 + 4.45, z); g.add(die);
  });
  // milky diffused epoxy: flange (flat edge on the red side), barrel and dome
  const epoxy = new THREE.MeshStandardMaterial({ color: '#F1EFEA', emissive: '#000000', roughness: 0.55, transparent: true, opacity: 0.9 });
  const flangeGeo = new THREE.CylinderGeometry(2.9, 2.9, 1.0, 40);
  const pos = flangeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setX(i, Math.max(pos.getX(i), -2.45));
  flangeGeo.computeVertexNormals();
  const flange = new THREE.Mesh(flangeGeo, epoxy); flange.position.set(cx, Y0 + 0.5, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5.6, 40, 1, true), epoxy); body.position.set(cx, Y0 + 3.8, z);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), epoxy); dome.position.set(cx, Y0 + 6.6, z);
  const base = new THREE.Mesh(new THREE.CircleGeometry(2.5, 40), epoxy); base.rotation.x = Math.PI / 2; base.position.set(cx, Y0 + 0.001, z);
  g.add(flange, body, dome, base);
  castAll(g);
  for (const m of [flange, body, dome, base]) m.renderOrder = 2;
  // blackened, cracked-looking lens when it has burnt out
  const burnt = new THREE.Mesh(new THREE.SphereGeometry(2.75, 20, 16), std('#1B1410', 0.9, 0, { transparent: true, opacity: 0.78 }));
  burnt.scale.set(1, 1.5, 1); burnt.position.set(cx, Y0 + 5.2, z); burnt.raycast = () => {}; burnt.visible = false;
  const halo = glowSprite(glowTexture(), 26); halo.position.set(cx, Y0 + 5, z);
  const light = new THREE.PointLight('#ffffff', 0, 45, 1.8); light.position.set(cx, Y0 + 5.5, z);
  g.add(burnt, halo, light);
  return { g, epoxy, halo, light, burnt };
}

// 5 mm RGB LED, common cathode: legs R, K, G, B in one row; the colours of state.rgb mix in its milky lens.
export function RgbLed({ at, state }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const m = useMemo(() => build(col, ROW[row]), [col, row]);
  useDisposeOnUnmount(m.g);
  const [r, g, b] = state?.burnt ? [0, 0, 0] : state?.rgb ?? [0, 0, 0];
  const peak = Math.max(r, g, b);
  m.epoxy.emissive.setRGB(r, g, b);
  m.epoxy.emissiveIntensity = 1.5;
  const tint = peak > 0 ? [r / peak, g / peak, b / peak] : [1, 1, 1];
  (m.halo.material as THREE.SpriteMaterial).color.setRGB(tint[0], tint[1], tint[2]);
  (m.halo.material as THREE.SpriteMaterial).opacity = peak;
  m.light.color.setRGB(tint[0], tint[1], tint[2]);
  m.light.intensity = 260 * peak;
  m.burnt.visible = !!state?.burnt;
  return <primitive object={m.g} />;
}
