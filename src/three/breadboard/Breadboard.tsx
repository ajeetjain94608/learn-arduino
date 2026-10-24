import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCanvasTexture } from '../shared/canvasTexture';
import { rbox } from '../shared/geometry';
import { noOutline } from '../shared/layers';
import { MATERIALS, std } from '../shared/materials';
import { BB, colX, COLUMNS, isRailColumn, RAIL_Z, ROW, type Row } from './breadboardGeometry';

export const FLOW_COLOR = '#3FE9FF';

function drawTop(c: CanvasRenderingContext2D, px: number) {
  const w = BB.L * px, h = BB.W * px;
  const X = (x: number) => (x + BB.L / 2) * px, Z = (z: number) => (z + BB.W / 2) * px;
  c.fillStyle = '#F8F4EB'; c.fillRect(0, 0, w, h);
  const hole = (x: number, z: number) => { c.fillStyle = '#4A4842'; c.beginPath(); c.roundRect(X(x) - 0.55 * px, Z(z) - 0.55 * px, 1.1 * px, 1.1 * px, 3); c.fill(); };
  for (let col = 1; col <= COLUMNS; col++) for (const z of Object.values(ROW)) hole(colX(col), z);
  for (let col = 1; col <= COLUMNS; col++) if (isRailColumn(col)) for (const z of RAIL_Z) hole(colX(col), z);
  const stripe = (z: number, color: string) => { c.fillStyle = color; c.fillRect(X(-38), Z(z) - 2, 76 * px, 4); };
  stripe(-26.2, '#4C78DA'); stripe(-19.3, '#E2483D'); stripe(19.3, '#4C78DA'); stripe(26.2, '#E2483D');
  c.fillStyle = '#A39A88'; c.font = '700 20px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let col = 1; col <= COLUMNS; col += col === 1 ? 4 : 5) { c.fillText(String(col), X(colX(col)), Z(-16.6)); c.fillText(String(col), X(colX(col)), Z(16.6)); }
  for (const [k, z] of Object.entries(ROW)) { c.fillText(k, X(-39.6), Z(z)); c.fillText(k, X(39.6), Z(z)); }
  c.font = '800 22px system-ui';
  c.fillStyle = '#E2483D'; c.fillText('+', X(-39.6), Z(-19.3)); c.fillText('+', X(-39.6), Z(26.2));
  c.fillStyle = '#4C78DA'; c.fillText('−', X(-39.6), Z(-26.2)); c.fillText('−', X(-39.6), Z(19.3));
}

type Props = { position?: [number, number, number]; highlight?: { cols: number[]; side?: 'top' | 'bottom'; level: number }; children?: React.ReactNode };

// Children are positioned in breadboard-local millimetres (see holeLocal).
export function Breadboard({ position = [50, 0, 8], highlight, children }: Props) {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const body = useMemo(() => {
    const g = new THREE.Group();
    const box = rbox(BB.L, BB.H, BB.W, 1.4, MATERIALS.breadboard, 3); box.position.y = BB.H / 2;
    const groove = rbox(BB.L - 0.6, 1.2, 2.6, 0.3, std('#E7DFCD', 0.9)); groove.position.y = BB.H - 0.45;
    const px = 16;
    const tex = makeCanvasTexture(BB.L * px, BB.W * px, (c) => drawTop(c, px), anisotropy);
    tex.repeat.set((BB.L - 2.8) / BB.L, (BB.W - 2.8) / BB.W);
    tex.offset.set(1.4 / BB.L, 1.4 / BB.W);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(BB.L - 2.8, BB.W - 2.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88 }));
    top.rotation.x = -Math.PI / 2; top.position.y = BB.H + 0.01; top.receiveShadow = true;
    g.add(box, groove, top);
    return g;
  }, [anisotropy]);
  useEffect(() => () => body.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }), [body]);

  // Glowing bars over the metal strips that carry current (5 holes per strip).
  const colsKey = highlight?.cols.join(',') ?? '';
  const side = highlight?.side ?? 'top';
  const strips = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: FLOW_COLOR, transparent: true, opacity: 0, depthWrite: false });
    const [r0, r1]: Row[] = side === 'bottom' ? ['f', 'j'] : ['a', 'e'];
    const g = new THREE.Group();
    for (const col of colsKey ? colsKey.split(',').map(Number) : []) {
      const bar = rbox(1.9, 0.1, ROW[r1] - ROW[r0] + 2.2, 0.04, mat);
      bar.castShadow = bar.receiveShadow = false;
      bar.position.set(colX(col), BB.H + 0.06, (ROW[r0] + ROW[r1]) / 2);
      g.add(bar);
    }
    return { group: noOutline(g), mat };
  }, [colsKey, side]);
  useEffect(() => () => { strips.mat.dispose(); strips.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }, [strips]);
  const level = highlight?.level ?? 0;
  strips.mat.opacity = 0.55 * level;
  strips.group.visible = level > 0.01;

  return (
    <group position={position}>
      <primitive object={body} />
      <primitive object={strips.group} />
      {children}
    </group>
  );
}
