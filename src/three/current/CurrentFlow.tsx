import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCanvasTexture } from '../shared/canvasTexture';
import { noOutline } from '../shared/layers';
import { isTestMode, useReducedMotion } from '../shared/motion';
import { buildLoop, electronPositions, FLOW_COLOR } from './flowPath';

const ELECTRONS_PER_WIRE = 24;
const SPEED_MM_S = 23;

const pulseShader = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float time, opacity; uniform vec3 color; varying vec2 vUv;
    void main(){ float s = fract(vUv.x * 7.0 - time * 1.2);
      float a = smoothstep(0.0, 0.08, s) * smoothstep(0.32, 0.12, s);
      gl_FragColor = vec4(mix(color, vec3(1.0), a * 0.55), a * opacity); }`,
};

type Wire = { wire: THREE.CatmullRomCurve3; path: THREE.Curve<THREE.Vector3>[] };

declare global { interface Window { __rq?: { debug: Record<string, unknown> } } }

// Current shown on wires only: moving pulses over each jumper and electrons travelling along it.
// Fades in/out toward `active`; frozen (but visible) under reduced motion.
export function CurrentFlow({ wires, active }: { wires: Wire[]; active: boolean }) {
  const reduced = useReducedMotion();
  const level = useRef(0);
  const clock = useRef(0);

  const fx = useMemo(() => {
    const pulseMat = new THREE.ShaderMaterial({
      ...pulseShader,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(FLOW_COLOR) }, opacity: { value: 0 } },
      transparent: true, depthWrite: false,
    });
    const group = new THREE.Group();
    for (const w of wires) {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(w.wire, 160, 1.05, 14), pulseMat);
      tube.renderOrder = 3;
      group.add(tube);
    }
    const paths = wires.map((w) => buildLoop(w.path));
    const lengths = paths.map((p) => p.getLength());
    const count = ELECTRONS_PER_WIRE * paths.length;
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const dot = makeCanvasTexture(64, 64, (c) => {
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(120,240,255,0.95)'); gr.addColorStop(1, 'rgba(60,220,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    });
    const electrons = new THREE.Points(geo, new THREE.PointsMaterial({ map: dot, size: 13, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false }));
    electrons.renderOrder = 10;
    electrons.frustumCulled = false;
    group.add(electrons);
    group.visible = false;
    return { group: noOutline(group), pulseMat, electrons, geo, paths, lengths };
  }, [wires]);

  useEffect(() => () => {
    fx.pulseMat.dispose(); fx.geo.dispose();
    fx.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
  }, [fx]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    level.current += ((active ? 1 : 0) - level.current) * Math.min(1, dt * 12);
    const on = level.current > 0.02;
    fx.group.visible = on;
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.electronsVisible = on;
    if (!on) return;
    if (!reduced) clock.current += dt;
    fx.pulseMat.uniforms.time.value = clock.current;
    fx.pulseMat.uniforms.opacity.value = level.current * 0.95;
    (fx.electrons.material as THREE.PointsMaterial).opacity = level.current;
    const arr = fx.geo.attributes.position.array as Float32Array;
    fx.paths.forEach((p, i) => electronPositions(p, ELECTRONS_PER_WIRE, (clock.current * SPEED_MM_S) / fx.lengths[i], arr.subarray(i * ELECTRONS_PER_WIRE * 3, (i + 1) * ELECTRONS_PER_WIRE * 3)));
    fx.geo.attributes.position.needsUpdate = true;
  });

  return <primitive object={fx.group} />;
}
