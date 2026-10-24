import { useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { isTestMode } from '../shared/motion';
import { ROOM_ENV } from './roomEnvironment';
import { CameraRig } from './CameraRig';
import { Ground } from './Ground';
import { Lights } from './Lights';
import { OutlineRenderer } from './OutlineRenderer';
import { useQualityStore } from '../../state/qualityStore';

// The 3D workbench: orthographic camera, soft light, floor, ink outlines. Scene content goes in children.
type Props = { children?: ReactNode; onCanvas?(c: HTMLCanvasElement): void; onBackgroundTap?(): void };

export function Workbench({ children, onCanvas, onBackgroundTap }: Props) {
  const quality = useQualityStore((s) => s.quality);
  const dpr = useMemo(() => Math.min(window.devicePixelRatio || 1, quality.pixelRatio), [quality.pixelRatio]);
  return (
    <Canvas
      className="workbench"
      onPointerMissed={onBackgroundTap}
      orthographic
      dpr={dpr}
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ near: 1, far: 1500, manual: true }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: isTestMode(), toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.92 }}
      scene={{ environment: ROOM_ENV, environmentIntensity: 0.5 }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.engine = 'three';
        onCanvas?.(gl.domElement);
      }}
    >
      <Lights quality={quality} />
      <Ground />
      <CameraRig />
      <OutlineRenderer quality={quality} />
      {children}
    </Canvas>
  );
}
