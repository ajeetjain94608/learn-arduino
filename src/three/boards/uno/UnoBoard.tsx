import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { noOutline } from '../../shared/layers';
import { UNO } from './layout';
import { buildConnectors } from './parts/Connectors';
import { buildCrystals } from './parts/Crystal';
import { buildHeaders } from './parts/Headers';
import { buildIcs } from './parts/Ics';
import { buildPassives } from './parts/Passives';
import { buildPcbMesh } from './parts/pcb';
import { PinTraceGlow } from './parts/PinTraceGlow';
import { drawSurface } from './parts/surfaceTexture';

type Props = { position?: [number, number, number]; pin13Level?: number; surfacePx?: number };

// The Uno R3, built from the official layout. pin13Level (0..1) lights the "L" LED and the pin 13 route.
export function UnoBoard({ position = [-38, 0, 2], pin13Level = 0, surfacePx = 36 }: Props) {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const { group, leds } = useMemo(() => {
    const g = new THREE.Group();
    g.add(buildPcbMesh());
    const tex = makeCanvasTexture(Math.round(UNO.L * surfacePx), Math.round(UNO.W * surfacePx), (c) => drawSurface(c, surfacePx), anisotropy);
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(UNO.L, UNO.W), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, depthWrite: false }));
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = UNO.T + 0.012;
    surface.receiveShadow = true;
    surface.renderOrder = 1;
    g.add(noOutline(surface)); // the PCB beneath supplies the outline; the plane is a plain rectangle
    g.add(buildHeaders());
    buildIcs(g);
    buildCrystals(g);
    const leds = buildPassives(g);
    buildConnectors(g);
    return { group: g, leds };
  }, [surfacePx, anisotropy]);

  leds.L.set(pin13Level > 0.5 ? 1 : 0);

  return (
    <group position={position}>
      <primitive object={group} />
      <PinTraceGlow pin="13" level={pin13Level} px={surfacePx} />
    </group>
  );
}
