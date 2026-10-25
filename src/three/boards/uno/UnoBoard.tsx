import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useQualityStore } from '../../../state/qualityStore';
import { makeCanvasTexture } from '../../shared/canvasTexture';
import { noOutline } from '../../shared/layers';
import { UNO } from './layout';
import { buildConnectors } from './parts/Connectors';
import { buildCrystals } from './parts/Crystal';
import { buildHeaders } from './parts/Headers';
import { buildIcs } from './parts/Ics';
import { buildPassives, type StatusLeds } from './parts/Passives';
import { buildPcbMesh } from './parts/pcb';
import { drawSurface } from './parts/surfaceTexture';

// The whole board as plain three.js objects (also used by tools/bake-thumbs to render the project picture).
export function buildUnoBoard(surfacePx: number, anisotropy: number): { group: THREE.Group; leds: StatusLeds } {
  const g = new THREE.Group();
  g.add(buildPcbMesh());
  const tex = makeCanvasTexture(Math.round(UNO.L * surfacePx), Math.round(UNO.W * surfacePx), (c) => drawSurface(c, surfacePx), anisotropy);
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(UNO.L, UNO.W), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, depthWrite: false }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = UNO.T + 0.012;
  surface.receiveShadow = true;
  surface.renderOrder = 1;
  g.add(noOutline(surface)); // the PCB beneath supplies the outline; the plane is a plain rectangle
  buildHeaders(g);
  buildIcs(g);
  buildCrystals(g);
  const leds = buildPassives(g);
  buildConnectors(g);
  return { group: g, leds };
}

type Props = { position?: [number, number, number]; pin13?: boolean };

// The Uno R3, built from the official layout. `pin13` HIGH lights the built-in "L" LED.
export function UnoBoard({ position = [-38, 0, 2], pin13 = false }: Props) {
  const surfacePx = useQualityStore((s) => s.quality.surfacePx); // board texture resolution follows the quality tier
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const { group, leds } = useMemo(() => buildUnoBoard(surfacePx, anisotropy), [surfacePx, anisotropy]);

  leds.L.set(pin13 ? 1 : 0);

  return (
    <group position={position}>
      <primitive object={group} />
    </group>
  );
}
