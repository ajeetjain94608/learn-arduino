import { useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { isTestMode } from '../shared/motion';
import { CameraRig } from './CameraRig';
import { Ground } from './Ground';
import { Lights } from './Lights';
import { OutlineRenderer } from './OutlineRenderer';
import { deviceQuality, type Quality } from './quality';

// The 3D workbench: orthographic camera, soft light, floor, ink outlines. Scene content goes in children.
export function Workbench({ children, quality: forced }: { children?: ReactNode; quality?: Quality }) {
  const quality = useMemo(() => forced ?? deviceQuality(), [forced]);
  return (
    <Canvas
      className="workbench"
      orthographic
      dpr={quality.pixelRatio}
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ near: 1, far: 1500, manual: true }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: isTestMode() }}
      onCreated={({ gl, scene }) => {
        gl.domElement.dataset.engine = 'three';
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 0.92;
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.5;
        pmrem.dispose();
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
