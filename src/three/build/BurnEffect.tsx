import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCanvasTexture } from '../shared/canvasTexture';
import { disposeOwned } from '../shared/geometry';
import { noOutline } from '../shared/layers';
import { useReducedMotion } from '../shared/motion';

const PUFF_S = 1.8;  // how long the smoke rises
const PUFFS = 6;

// A small, friendly "burnt" moment: a quick flash, a few soft smoke puffs rising and fading, and a dark scorch mark that
// stays. Reduced motion: just the scorch mark.
export function BurnEffect({ position }: { position: [number, number, number] }) {
  const reduced = useReducedMotion();
  const t = useRef(0);
  const fx = useMemo(() => {
    const soft = makeCanvasTexture(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    const group = new THREE.Group();
    const puffs = Array.from({ length: PUFFS }, (_, i) => {
      const s = noOutline(new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#6B6B70', transparent: true, depthWrite: false, opacity: 0 })));
      s.userData = { delay: i * 0.18, dx: (i % 3 - 1) * 1.2 };
      group.add(s);
      return s;
    });
    const flash = noOutline(new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#FFD27A', transparent: true, depthWrite: false, opacity: 0 })));
    group.add(flash);
    const scorch = noOutline(new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshBasicMaterial({ map: soft, color: '#1A1A1A', transparent: true, opacity: 0.55, depthWrite: false })));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = -6;
    group.add(scorch);
    for (const o of group.children) o.raycast = () => {}; // decoration: never in the way of taps
    return { group, puffs, flash };
  }, []);

  useEffect(() => () => disposeOwned(fx.group), [fx]);

  useFrame((_, dt) => {
    if (reduced || t.current > PUFF_S + 1) { fx.flash.visible = false; for (const p of fx.puffs) p.visible = false; return; }
    t.current += Math.min(dt, 0.1);
    const f = (fx.flash.material as THREE.SpriteMaterial);
    f.opacity = Math.max(0, 1 - t.current / 0.25);
    fx.flash.scale.setScalar(6 + 10 * t.current);
    for (const p of fx.puffs) {
      const k = (t.current - p.userData.delay) / PUFF_S;
      const m = p.material as THREE.SpriteMaterial;
      if (k <= 0 || k >= 1) { m.opacity = 0; continue; }
      p.position.set(p.userData.dx * k * 3, 4 + 22 * k, 0);
      p.scale.setScalar(4 + 9 * k);
      m.opacity = 0.6 * Math.sin(Math.PI * k);
    }
  });
  return <primitive object={fx.group} position={position} />;
}
