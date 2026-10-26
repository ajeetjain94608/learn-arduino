import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { liveDevices } from '../../../sim/liveDevices';
import { BB, colX, ROW } from '../../breadboard/breadboardGeometry';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { castAll } from '../../shared/geometry';
import { noOutline } from '../../shared/layers';
import { std } from '../../shared/materials';
import { useReducedMotion } from '../../shared/motion';
import type { PartView } from '../partView';
import { decal, lead, PITCH, useDisposeOnUnmount } from './kit';

const R = 6;           // 12 mm across
const H = 9.5;         // tall
const Y0 = BB.H + 0.4; // its underside rests on the leads' shoulders, just off the board
const RINGS = 3;
const RING_S = 1.1;    // seconds for one ring to spread and fade

// black shell, bottom to top, with the sound hole going down into the top
const SHELL = [[5.7, 0.7], [R, 1.0], [R, H - 0.45], [R - 0.15, H - 0.12], [R - 0.5, H], [1.15, H], [1.0, H - 0.2], [1.0, H - 2.2], [0, H - 2.2]]
  .map(([r, y]) => new THREE.Vector2(r, y));

function build(col: number, z: number) {
  const g = new THREE.Group();
  const cx = colX(col) + 1.5 * PITCH;
  for (const hx of [colX(col), colX(col + 3)]) g.add(lead([[hx, Y0 + 1.5, z], [hx, BB.H - 0.6, z]], 0.3));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(SHELL, 48), std('#202329', 0.62));
  shell.position.set(cx, Y0, z); g.add(shell);
  // a passive buzzer shows its green circuit board underneath
  const pcb = new THREE.Mesh(new THREE.CylinderGeometry(5.65, 5.65, 0.8, 40), std('#2F7A52', 0.6));
  pcb.position.set(cx, Y0 + 0.4, z); g.add(pcb);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color: '#08090B' }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(cx, Y0 + H - 2.15, z); g.add(hole);
  // "+" moulded and printed over the + leg
  const plusTex = makeCanvasTexture(64, 64, (ctx) => { ctx.fillStyle = '#8E949C'; ctx.fillRect(28, 14, 8, 36); ctx.fillRect(14, 28, 36, 8); });
  const plus = decal(plusTex, 2.0, 2.0); plus.rotation.x = -Math.PI / 2; plus.position.set(cx - 3.4, Y0 + H + 0.02, z); g.add(plus);
  castAll(g);
  // sound rings spreading from the hole while it plays
  const ringGeo = new THREE.RingGeometry(0.88, 1, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: RINGS }, () => {
    const m = noOutline(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#7FA8E8', transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide })));
    m.raycast = () => {}; m.visible = false; m.position.set(cx, Y0 + H + 0.6, z);
    g.add(m);
    return m;
  });
  return { g, rings, top: Y0 + H };
}

// 12 mm passive piezo buzzer: + at the first leg, − three holes along. Rings rise from it while it plays a note.
export function Buzzer({ id, at }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const m = useMemo(() => build(col, ROW[row]), [col, row]);
  useDisposeOnUnmount(m.g);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    const sounding = (liveDevices.states[id]?.hz ?? 0) > 0;
    for (let i = 0; i < RINGS; i++) {
      const ring = m.rings[i], mat = ring.material as THREE.MeshBasicMaterial;
      ring.visible = sounding && (!reduced || i === 0);
      if (!ring.visible) continue;
      const t = reduced ? 0.45 : ((clock.elapsedTime / RING_S + i / RINGS) % 1);
      const s = 3 + t * 9;
      ring.scale.set(s, 1, s);
      ring.position.y = m.top + 0.6 + t * 3.5;
      mat.opacity = reduced ? 0.45 : 0.7 * (1 - t) * Math.min(1, t * 6);
    }
  });
  return <primitive object={m.g} />;
}
