import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BB, colX, ROW } from '../../breadboard/breadboardGeometry';
import { useBenchDrag } from '../../build/controls3d';
import { BENCH } from '../../build/pinPoints';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { castAll, rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import type { PartView } from '../partView';
import { clamp, glowSprite, glowTexture, lead, useDisposeOnUnmount } from './kit';

const DISC_Y = BB.H + 6.2; // centre of the sensor disc, standing up and facing the lamp (+z)
const HEAD_Y = 44;         // the lamp's shade, above the bench (before scaling)
const REACH = 26;          // how far the shade reaches out in front of the lamp's base
const LS = 0.6;            // the lamp is drawn at this scale (a small desk lamp that doesn't hide the board)

// lux ↔ how far the lamp's shade is from the sensor (mm): 1000 lux at 40 mm, dark at 200 mm.
export const lampDistance = (lux: number) => 40 + ((1000 - clamp(lux, 0, 1000)) / 1000) * 160;
export const luxAt = (d: number) => Math.round(clamp(1000 - ((d - 40) / 160) * 1000, 0, 1000));

// the face: white ceramic, two silvery comb electrodes and the orange-red light-sensitive track winding between them
function faceTexture() {
  return makeCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#EAE4D6'; ctx.fillRect(0, 0, 256, 256);
    ctx.save(); ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#8C857A'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#C23A16'; ctx.lineWidth = 12; ctx.lineJoin = 'round';
    ctx.beginPath();
    const rows = 8, x0 = 40, x1 = 216;
    for (let i = 0; i < rows; i++) {
      const y = 46 + i * 23.5;
      if (i === 0) ctx.moveTo(x0, y);
      ctx.lineTo(i % 2 ? x0 : x1, y);
      if (i < rows - 1) ctx.lineTo(i % 2 ? x0 : x1, y + 23.5);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,110,95,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
  });
}

function buildLdr(col: number, z: number) {
  const g = new THREE.Group();
  const cx = colX(col + 1);
  for (const [dx, hx] of [[-1.7, colX(col)], [1.7, colX(col + 2)]]) {
    g.add(lead([[cx + dx, DISC_Y - 1, z], [cx + dx, DISC_Y - 3.6, z], [hx, BB.H + 1.4, z], [hx, BB.H - 0.6, z]], 0.25));
  }
  const ceramic = std('#E7E1D3', 0.7);
  const discGeo = new THREE.CylinderGeometry(2.55, 2.55, 1.8, 40);
  discGeo.rotateX(Math.PI / 2); // axis along z, the face toward +z
  const disc = new THREE.Mesh(discGeo, [ceramic, std('#ffffff', 0.55, 0, { map: faceTexture() }), ceramic]);
  disc.position.set(cx, DISC_Y, z); g.add(disc);
  // the clear coating over the face: a thin glossy lens
  const coatGeo = new THREE.SphereGeometry(2.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  coatGeo.rotateX(Math.PI / 2); coatGeo.scale(1, 1, 0.16);
  const coat = noOutline(new THREE.Mesh(coatGeo, std('#ffffff', 0.08, 0, { transparent: true, opacity: 0.12, depthWrite: false })));
  coat.position.set(cx, DISC_Y, z + 0.9); coat.raycast = () => {}; g.add(coat);
  return { g: castAll(g), cx };
}

// A small desk lamp on the bench, its origin at the middle of its round foot. The shade's group turns to aim.
function buildLamp() {
  const g = new THREE.Group();
  const paint = std('#33495E', 0.55), joint = MATERIALS.metalDark;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 4, 48), paint); foot.position.y = 2; g.add(foot);
  const switchBtn = rbox(4, 1.6, 6, 0.6, std('#1F2228', 0.5)); switchBtn.position.set(7, 4.5, 3); g.add(switchBtn);
  // two arms: up from the foot, then forward over the board to the shade
  const hinge0 = new THREE.Vector3(0, 6, 0), elbow = new THREE.Vector3(0, HEAD_Y + 14, 9), head = new THREE.Vector3(0, HEAD_Y + 4, -REACH);
  for (const [a, b] of [[hinge0, elbow], [elbow, head]] as const) {
    for (const dx of [-1.6, 1.6]) {
      const len = a.distanceTo(b);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, len, 12), paint);
      rod.position.copy(a).add(b).multiplyScalar(0.5).setX(dx);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(rod);
    }
  }
  for (const p of [hinge0, elbow, head]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5.4, 20), joint); pin.rotation.z = Math.PI / 2; pin.position.copy(p); g.add(pin);
  }
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 9, 3), new THREE.Vector3(0, HEAD_Y + 6, 10)), 2, 0.55, 8), joint);
  g.add(spring);
  // the cord runs off behind the lamp along the bench
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2, 12), new THREE.Vector3(2, 0.8, 22), new THREE.Vector3(-6, 0.8, 40), new THREE.Vector3(4, 0.8, 62)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 32, 1, 8), std('#2A2D33', 0.7)));
  // the shade (opening along its local −y), aimed at the sensor by turning about x
  const shade = new THREE.Group(); shade.position.copy(head).setY(HEAD_Y);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 10.5, 13, 40, 1, true), paint);
  outer.position.y = 0; shade.add(outer);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 10.3, 12.9, 40, 1, true), std('#F2EBDD', 0.7, 0, { side: THREE.BackSide }));
  shade.add(inner);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 3.5, 32), paint); cap.position.y = 8; shade.add(cap);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(10.4, 0.45, 8, 48), paint); rim.rotation.x = Math.PI / 2; rim.position.y = -6.5; shade.add(rim);
  const bulbMat = std('#FFF3D6', 0.3, 0, { emissive: '#FFE2A6', emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), bulbMat); bulb.position.y = -2.5; shade.add(bulb);
  castAll(g); castAll(shade);
  outer.castShadow = inner.castShadow = bulb.castShadow = false; // the lamp's own light shines out of the shade
  // light: a soft beam from the shade towards the sensor, a glow at the mouth and a real light
  const beamTex = makeCanvasTexture(8, 128, (ctx) => {
    const gr = ctx.createLinearGradient(0, 0, 0, 128); // v = 1 at the shade's mouth (top of the canvas)
    gr.addColorStop(0, 'rgba(255,240,205,0.95)'); gr.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 8, 128);
  });
  const beamGeo = new THREE.CylinderGeometry(10, 16, 1, 40, 1, true); beamGeo.translate(0, -0.5, 0);
  const beam = noOutline(new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#FFF0CC', map: beamTex, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
  beam.position.y = -6.5; beam.raycast = () => {}; shade.add(beam);
  const glow = glowSprite(glowTexture(), 34, '#FFE6B0'); glow.position.y = -6; shade.add(glow);
  const light = new THREE.PointLight('#FFE9C4', 0, 220, 1.4); light.position.y = -7; shade.add(light);
  g.add(shade);
  g.scale.setScalar(LS);
  return { g, shade, beam, glow, light, bulbMat };
}

// Light-dependent resistor standing in the board, with a desk lamp on the bench in front of it: the nearer the lamp,
// the more light (inputs.lux). Drag the lamp along the bench to change it.
export function Ldr({ at, inputs, onInput }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const z = ROW[row];
  const ldr = useMemo(() => buildLdr(col, z), [col, z]);
  const lamp = useMemo(buildLamp, []);
  useDisposeOnUnmount(ldr.g, lamp.g);

  const lux = clamp(inputs.lux ?? 300, 0, 1000);
  const d = lampDistance(lux);
  const dRef = useRef(d); dRef.current = d;
  const start = useRef<{ z: number; d: number } | null>(null);
  const drag = useBenchDrag((world) => {
    const localZ = world.z - BENCH.breadboard[2]; // world → breadboard-local
    if (!start.current) { start.current = { z: localZ, d: dRef.current }; return; }
    const next = luxAt(start.current.d + localZ - start.current.z);
    if (next !== Math.round(lux)) onInput('lux', next);
  });

  // place the lamp so its shade is d mm in front of the sensor, and aim the shade at it
  lamp.g.position.set(ldr.cx, 0, z + d + REACH * LS);
  const drop = HEAD_Y * LS - DISC_Y, reach = Math.hypot(d, drop);
  lamp.shade.rotation.x = Math.atan2(d, drop);
  const k = lux / 1000;
  lamp.beam.scale.y = Math.max(1, reach / LS - 9);
  (lamp.beam.material as THREE.MeshBasicMaterial).opacity = 0.32 * k;
  (lamp.glow.material as THREE.SpriteMaterial).opacity = k;
  lamp.bulbMat.emissiveIntensity = 0.1 + 1.9 * k;
  lamp.light.intensity = 2500 * k;

  return (
    <>
      <primitive object={ldr.g} />
      <primitive object={lamp.g} onPointerDown={(e: Parameters<typeof drag>[0]) => { start.current = null; drag(e); }} />
    </>
  );
}
