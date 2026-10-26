import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BB, colX, ROW } from '../../breadboard/breadboardGeometry';
import { useBenchDrag } from '../../build/controls3d';
import { BENCH } from '../../build/pinPoints';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { castAll, rbox } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { MATERIALS, std } from '../../shared/materials';
import { useReducedMotion } from '../../shared/motion';
import type { PartView } from '../partView';
import { clamp, decal, glowTexture, lead, printTexture, useDisposeOnUnmount } from './kit';

const BODY_Y = BB.H + 4.2; // underside of the TO-92 body
const BODY_H = 5.2;
const R = 2.45;            // the round back
const FLAT = 1.5;          // the flat face, this far in front of the round's centre (toward −z)
const ELEV = (25 * Math.PI) / 180; // the dryer looks down at the sensor at this angle
const HOLD = 34;           // where the stand's ring holds the dryer, back from the nozzle
const PUFFS = 7;
const SD = 0.6;            // the dryer is drawn at this scale (a small one, so it doesn't hide the board)

// °C ↔ how far the nozzle is from the sensor (mm): 60 °C at 30 mm, room temperature (22 °C) or less at 230 mm.
export const dryerDistance = (celsius: number) => clamp(30 + ((60 - celsius) / 38) * 200, 30, 230);
export const celsiusAt = (d: number) => Math.round(clamp(60 - ((d - 30) / 200) * 38, -10, 60) * 2) / 2;

function buildSensor(col: number, z: number) {
  const g = new THREE.Group();
  const cx = colX(col + 1), zc = z + 0.3; // the legs come out under the middle of the D
  // three leads out of the body at 1.27 mm, formed out to the 2.54 mm holes
  for (let i = 0; i < 3; i++) {
    const hx = colX(col + i), ox = cx + (i - 1) * 1.27;
    g.add(lead([[ox, BODY_Y + 1, z], [ox, BODY_Y - 0.8, z], [hx, BODY_Y - 2.6, z], [hx, BB.H + 0.5, z], [hx, BB.H - 0.6, z]], 0.22));
  }
  const half = Math.sqrt(R * R - FLAT * FLAT), a0 = Math.atan2(FLAT, half);
  const shape = new THREE.Shape();
  shape.moveTo(-half, FLAT); shape.lineTo(half, FLAT);
  shape.absarc(0, 0, R, a0, Math.PI - a0, true); // round back, through −y (which becomes +z)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: BODY_H - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, curveSegments: 32 });
  geo.rotateX(-Math.PI / 2); // shape y → −z, extrusion → up
  geo.rotateY(Math.PI);      // the flat face (and its printing) turns to the viewer, +z
  const body = new THREE.Mesh(geo, std('#1E2126', 0.6));
  body.position.set(cx, BODY_Y + 0.15, zc); g.add(body);
  const mark = decal(printTexture(128, 128, [{ text: 'TMP', size: 30 }, { text: '36', size: 30 }, { text: 'GZ', size: 18, weight: 500 }], '#BFC4CA'), 3.4, 3.4);
  mark.position.set(cx, BODY_Y + BODY_H / 2, zc + FLAT + 0.17); g.add(mark);
  return { g: castAll(g), q: new THREE.Vector3(cx, BODY_Y + BODY_H / 2, zc) };
}

// A small hairdryer, its nozzle tip at the origin and its body along +z.
function buildDryer() {
  const g = new THREE.Group();
  const shell = std('#E27D60', 0.5), dark = std('#2A2D34', 0.6);
  const along = (geo: THREE.BufferGeometry, z0: number, len: number) => { geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2); geo.translate(0, 0, z0); return geo; };
  const nozzle = new THREE.Mesh(along(new THREE.CylinderGeometry(11, 7.5, 14, 40, 1, true), 0, 14), dark); g.add(nozzle);
  const nozzleIn = new THREE.Mesh(along(new THREE.CylinderGeometry(10.6, 7.1, 14, 40, 1, true), 0, 14), std('#15171B', 0.8, 0, { side: THREE.BackSide })); g.add(nozzleIn);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(7.3, 0.35, 8, 40), dark); lip.position.z = 0; g.add(lip);
  // the heating coil, glowing through the nozzle when it is hot
  const coilMat = std('#6B3A22', 0.5, 0.2, { emissive: '#FF5A1A', emissiveIntensity: 0 });
  const coil = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.6, 8, 40), coilMat); coil.position.z = 9; g.add(coil);
  const coil2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.5, 8, 32), coilMat); coil2.position.z = 10.5; g.add(coil2);
  const grilleTex = makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#2A2D34'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#0E0F12'; ctx.lineWidth = 5;
    for (let r = 14; r < 60; r += 11) { ctx.beginPath(); ctx.arc(64, 64, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.lineWidth = 4; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 60 * Math.cos(a), 64 + 60 * Math.sin(a)); ctx.strokeStyle = '#2A2D34'; ctx.stroke(); }
  });
  const barrel = new THREE.Mesh(along(new THREE.CylinderGeometry(13, 12.2, 46, 48), 14, 46), shell); g.add(barrel);
  const collar = new THREE.Mesh(along(new THREE.CylinderGeometry(13.3, 13.3, 3, 48), 13, 3), dark); g.add(collar);
  const back = new THREE.Mesh(along(new THREE.CylinderGeometry(12.6, 12.6, 3.5, 48), 59.5, 3.5), [dark, std('#ffffff', 0.7, 0, { map: grilleTex }), dark]);
  g.add(back);
  // handle hanging under the barrel, with a two-position switch
  const handle = rbox(10, 30, 12, 4.5, shell);
  handle.geometry.translate(0, -15, 0); handle.position.set(0, -9, 44); handle.rotation.x = -0.32; g.add(handle);
  const sw = rbox(4, 7, 2, 0.8, dark); sw.position.set(0, -17, 41.5); sw.rotation.x = -0.32; g.add(sw);
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -37, 53), new THREE.Vector3(0, -42, 58), new THREE.Vector3(0, -44, 72)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 16, 1.4, 8), dark));
  // the stand's ring round the barrel
  const ring = new THREE.Mesh(new THREE.TorusGeometry(13.6, 1.1, 10, 48), MATERIALS.metalDark); ring.position.z = HOLD; g.add(ring);
  castAll(g);
  // warm air: soft puffs drifting from the nozzle toward the sensor
  const tex = glowTexture();
  const puffs = Array.from({ length: PUFFS }, (_, i) => {
    const s = noOutline(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#FFB27A', transparent: true, depthWrite: false, opacity: 0 })));
    s.raycast = () => {}; s.userData.jx = ((i * 37) % 7 - 3) * 0.8; s.userData.jy = ((i * 53) % 5 - 2) * 0.8;
    g.add(s);
    return s;
  });
  g.scale.setScalar(SD);
  return { g, coilMat, puffs };
}

// The stand: a round foot and a post up to the ring that holds the dryer. Its post is stretched to the ring's height.
function buildStand() {
  const g = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 3.5, 48), std('#2E3138', 0.55)); foot.position.y = 1.75; g.add(foot);
  const postGeo = new THREE.CylinderGeometry(1.6, 1.6, 1, 16); postGeo.translate(0, 0.5, 0);
  const post = new THREE.Mesh(postGeo, MATERIALS.metal); post.position.y = 3.5; g.add(post);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 4, 20), MATERIALS.metalDark); g.add(collar);
  return { g: castAll(g), post, collar };
}

// TMP36 in a TO-92 package (flat face toward the viewer (+z), legs VS, OUT, GND), with a hairdryer on a stand in front of it:
// the nearer the dryer, the warmer (inputs.celsius). Drag the dryer to change it.
export function Tmp36({ at, inputs, onInput }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const z = ROW[row];
  const sensor = useMemo(() => buildSensor(col, z), [col, z]);
  const dryer = useMemo(buildDryer, []);
  const stand = useMemo(buildStand, []);
  const prop = useMemo(() => new THREE.Group(), []);
  useDisposeOnUnmount(sensor.g, dryer.g, stand.g);
  const reduced = useReducedMotion();

  const celsius = clamp(inputs.celsius ?? 22, -10, 60);
  const d = dryerDistance(celsius);
  const heat = clamp((celsius - 22) / 38, 0, 1);
  const dRef = useRef(d); dRef.current = d;
  const start = useRef<{ z: number; d: number } | null>(null);
  const drag = useBenchDrag((world) => {
    const localZ = world.z - BENCH.breadboard[2]; // world → breadboard-local
    if (!start.current) { start.current = { z: localZ, d: dRef.current }; return; }
    const next = celsiusAt(start.current.d + (localZ - start.current.z) / Math.cos(ELEV));
    if (next !== celsius) onInput('celsius', next);
  });

  // the nozzle sits d mm from the sensor, up the line the dryer looks down
  const u = new THREE.Vector3(0, Math.sin(ELEV), Math.cos(ELEV));
  dryer.g.position.copy(sensor.q).addScaledVector(u, d);
  dryer.g.rotation.x = -ELEV;
  const hold = sensor.q.clone().addScaledVector(u, d + HOLD * SD);
  stand.g.position.set(hold.x, 0, hold.z); stand.g.scale.set(SD, 1, SD);
  const top = hold.y - 14.6 * SD;
  stand.post.scale.y = Math.max(1, top - 3.5);
  stand.collar.position.y = top - 1;
  dryer.coilMat.emissiveIntensity = 2.2 * heat;

  useFrame(({ clock }) => {
    for (let i = 0; i < PUFFS; i++) {
      const s = dryer.puffs[i], mat = s.material as THREE.SpriteMaterial;
      s.visible = heat > 0.02 && (!reduced || i < 3);
      if (!s.visible) continue;
      const t = reduced ? (i + 0.5) / 3 : (clock.elapsedTime * 0.9 + i / PUFFS) % 1;
      const along = (-t * d * 0.95) / SD;
      s.position.set(s.userData.jx * t * 1.5, s.userData.jy * t * 1.5, along);
      const size = 7 + t * 12; s.scale.set(size, size, 1);
      mat.opacity = 0.32 * heat * Math.sin(Math.PI * t);
    }
  });

  return (
    <>
      <primitive object={sensor.g} />
      <primitive object={prop} onPointerDown={(e: Parameters<typeof drag>[0]) => { start.current = null; drag(e); }}>
        <primitive object={dryer.g} />
        <primitive object={stand.g} />
      </primitive>
    </>
  );
}
