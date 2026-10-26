import { useMemo } from 'react';
import * as THREE from 'three';
import { BB, colX, ROW } from '../../breadboard/breadboardGeometry';
import { castAll, rbox } from '../../shared/geometry';
import { MATERIALS, std } from '../../shared/materials';
import type { PartView } from '../partView';
import { decal, printTexture, useDisposeOnUnmount } from './kit';

const BODY_Y = BB.H + 4.5; // underside of the plastic body
const BODY = { w: 10, h: 9.2, d: 3.2 };
const TAB = { w: 10, h: 15.6, t: 1.3, holeR: 1.8, holeFromTop: 2.9 };

function build(col: number, z: number) {
  const g = new THREE.Group();
  const cx = colX(col + 1);
  const front = z + 1.0;           // the plastic's front face sits a little in front of the legs
  const back = front - BODY.d;      // where the tab starts
  // B, C, E: flat leads, wider at the shoulder, straight down into the holes
  for (let i = 0; i < 3; i++) {
    const x = colX(col + i);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.5), MATERIALS.tin); shoulder.position.set(x, BODY_Y - 1.1, z); g.add(shoulder);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, BODY_Y - 2.2 - BB.H + 1.2, 0.5), MATERIALS.tin);
    leg.position.set(x, (BODY_Y - 2.2 + BB.H - 1.2) / 2, z); g.add(leg);
  }
  const body = rbox(BODY.w, BODY.h, BODY.d, 0.35, std('#1D1F24', 0.62)); body.position.set(cx, BODY_Y + BODY.h / 2, front - BODY.d / 2); g.add(body);
  // the metal tab behind it, rising above the body, with its mounting hole
  const s = new THREE.Shape(), hw = TAB.w / 2, c = 0.8;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, TAB.h - c); s.lineTo(hw - c, TAB.h); s.lineTo(-hw + c, TAB.h); s.lineTo(-hw, TAB.h - c); s.lineTo(-hw, 0);
  const hole = new THREE.Path(); hole.absarc(0, TAB.h - TAB.holeFromTop - TAB.holeR, TAB.holeR, 0, Math.PI * 2, true); s.holes.push(hole);
  const tabGeo = new THREE.ExtrudeGeometry(s, { depth: TAB.t, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1, curveSegments: 32 });
  const tab = new THREE.Mesh(tabGeo, std('#C9CDD2', 0.32, 0.65)); tab.position.set(cx, BODY_Y - 0.4, back - TAB.t); g.add(tab);
  const mark = decal(printTexture(256, 160, [{ text: 'TIP120', size: 52, weight: 700 }, { text: 'NPN  D2 24', size: 30, weight: 500 }], '#C7CBD1'), 7.6, 4.75);
  mark.position.set(cx, BODY_Y + BODY.h * 0.42, front + 0.01); g.add(mark);
  return castAll(g);
}

// TIP120 Darlington transistor in a TO-220 package, standing upright: legs B, C, E, metal tab at the back.
export function Tip120({ at }: PartView) {
  const { col, row } = at as { col: number; row: keyof typeof ROW };
  const g = useMemo(() => build(col, ROW[row]), [col, row]);
  useDisposeOnUnmount(g);
  return <primitive object={g} />;
}
