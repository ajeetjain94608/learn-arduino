import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCanvasTexture } from '../../../shared/canvasTexture';
import { noOutline } from '../../../shared/layers';
import { UNO } from '../layout';
import { drawPinGlow } from './surfaceTexture';

// Glowing copper route of one header pin, drawn just above the board surface. Opacity = level (0..1).
export function PinTraceGlow({ pin, level, px = 36 }: { pin: string; level: number; px?: number }) {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const mesh = useMemo(() => {
    const tex = makeCanvasTexture(Math.round(UNO.L * px), Math.round(UNO.W * px), (c) => drawPinGlow(c, px, pin), anisotropy);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(UNO.L, UNO.W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = UNO.T + 0.02;
    m.renderOrder = 2;
    return noOutline(m);
  }, [pin, px, anisotropy]);
  useEffect(() => () => { (mesh.material as THREE.MeshBasicMaterial).map?.dispose(); mesh.geometry.dispose(); }, [mesh]);
  const mat = mesh.material as THREE.MeshBasicMaterial;
  mat.opacity = level;
  mesh.visible = level > 0.01;
  return <primitive object={mesh} />;
}
