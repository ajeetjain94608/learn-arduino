import { useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { isTestMode } from '../shared/motion';
import { ROOM_ENV } from './roomEnvironment';
import { CameraRig } from './CameraRig';
import { Ground } from './Ground';
import { Lights } from './Lights';
import { OutlineRenderer } from './OutlineRenderer';
import { deviceQuality, type Quality } from './quality';

// The 3D workbench: orthographic camera, soft light, floor, ink outlines. Scene content goes in children.
type Props = { children?: ReactNode; quality?: Quality; onCanvas?(c: HTMLCanvasElement): void; onBackgroundTap?(): void };

export function Workbench({ children, quality: forced, onCanvas, onBackgroundTap }: Props) {
  const quality = useMemo(() => forced ?? deviceQuality(), [forced]);
  return (
    <Canvas
      className="workbench"
      onPointerMissed={onBackgroundTap}
      orthographic
      dpr={quality.pixelRatio}
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
