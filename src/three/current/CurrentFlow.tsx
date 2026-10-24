import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCanvasTexture } from '../shared/canvasTexture';
import { noOutline } from '../shared/layers';
import { isTestMode, useReducedMotion } from '../shared/motion';
import { buildLoop, electronPositions, FLOW_COLOR } from './flowPath';

const DOTS_PER_WIRE = 24;
const SPEED_MM_S = 23;
const DOT_PX = 6;

type Wire = { path: THREE.Curve<THREE.Vector3>[] };

declare global { interface Window { __rq?: { debug: Record<string, unknown> } } }

// Current, shown the way the owner asked: small plain dots travelling along each jumper wire.
// No glow and nothing inside components. Fades in/out toward `active`; frozen under reduced motion.
export function CurrentFlow({ wires, active }: { wires: Wire[]; active: boolean }) {
  const reduced = useReducedMotion();
  const level = useRef(0);
  const clock = useRef(0);

  const fx = useMemo(() => {
    const paths = wires.map((w) => buildLoop(w.path));
    const lengths = paths.map((p) => p.getLength());
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(DOTS_PER_WIRE * paths.length * 3), 3));
    const round = makeCanvasTexture(32, 32, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(16, 16, 14, 0, Math.PI * 2); c.fill(); });
    const mat = new THREE.PointsMaterial({ color: FLOW_COLOR, map: round, alphaTest: 0.5, size: DOT_PX, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const dots = noOutline(new THREE.Points(geo, mat));
    dots.renderOrder = 10;
    dots.raycast = () => {}; // decoration: never intercepts taps on the wires
    dots.frustumCulled = false;
    dots.visible = false;
    return { dots, geo, mat, round, paths, lengths };
  }, [wires]);

  useEffect(() => () => { fx.geo.dispose(); fx.mat.dispose(); fx.round.dispose(); }, [fx]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    level.current += ((active ? 1 : 0) - level.current) * Math.min(1, dt * 12);
    const on = level.current > 0.02;
    fx.dots.visible = on;
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.electronsVisible = on;
    if (!on) return;
    if (!reduced) clock.current += dt;
    fx.mat.opacity = level.current;
    const arr = fx.geo.attributes.position.array as Float32Array;
    fx.paths.forEach((p, i) => electronPositions(p, DOTS_PER_WIRE, (clock.current * SPEED_MM_S) / fx.lengths[i], arr.subarray(i * DOTS_PER_WIRE * 3, (i + 1) * DOTS_PER_WIRE * 3)));
    fx.geo.attributes.position.needsUpdate = true;
  });

  return <primitive object={fx.dots} />;
}
