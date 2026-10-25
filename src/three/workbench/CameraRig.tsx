import { useEffect, useLayoutEffect, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
import { useWorkbenchStore } from '../../state/workbenchStore';
import { LAYER_NO_OUTLINE } from '../shared/layers';
import { isTestMode, useReducedMotion } from '../shared/motion';
import { clampZoom, fitOrtho, MAX_ZOOM, MIN_ZOOM, orbitAround, VIEW_DIR, VIEWS } from './cameraViews';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TWEEN_S = 0.9;

type Tween = { t: number; fromP: THREE.Vector3; fromT: THREE.Vector3; fromZ: number; toP: THREE.Vector3; toT: THREE.Vector3; toZ: number };

// Orthographic camera framing (mm), orbit controls, and eased moves between views.
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const view = useWorkbenchStore((s) => s.view);
  const resetTick = useWorkbenchStore((s) => s.resetTick);
  const cameraCmd = useWorkbenchStore((s) => s.cameraCmd);
  const reduced = useReducedMotion();
  const tween = useRef<Tween | null>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const { halfW, halfH } = fitOrtho(size.width / size.height);
    Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useLayoutEffect(() => { camera.layers.enable(LAYER_NO_OUTLINE); }, [camera]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const to = VIEWS[view];
    const toT = new THREE.Vector3(...to.target);
    const toP = toT.clone().add(new THREE.Vector3(...VIEW_DIR));
    if (first.current || reduced) {
      first.current = false;
      camera.position.copy(toP);
      c.target.copy(toT);
      camera.zoom = to.zoom;
      camera.updateProjectionMatrix();
      c.update();
      tween.current = null;
      return;
    }
    tween.current = { t: 0, fromP: camera.position.clone(), fromT: c.target.clone(), fromZ: camera.zoom, toP, toT, toZ: to.zoom };
  }, [view, resetTick, reduced, camera]);

  // Toolbar rotate / zoom buttons: ease from where the camera is now.
  useEffect(() => {
    const c = controls.current;
    if (!c || !cameraCmd) return;
    const t = c.target.toArray() as [number, number, number];
    const toP = cameraCmd.kind === 'rotate' ? new THREE.Vector3(...orbitAround(camera.position.toArray() as [number, number, number], t, cameraCmd.amount)) : camera.position.clone();
    const toZ = cameraCmd.kind === 'zoom' ? clampZoom(camera.zoom * cameraCmd.amount) : camera.zoom;
    if (reduced) { camera.position.copy(toP); camera.zoom = toZ; camera.updateProjectionMatrix(); c.update(); return; }
    tween.current = { t: 0, fromP: camera.position.clone(), fromT: c.target.clone(), fromZ: camera.zoom, toP, toT: c.target.clone(), toZ };
  }, [cameraCmd, camera, reduced]);

  useEffect(() => {
    if (!isTestMode()) return;
    (window.__rq ??= { debug: {} }).debug.camera = () => {
      const t = controls.current?.target ?? new THREE.Vector3();
      return { azimuth: Math.atan2(camera.position.x - t.x, camera.position.z - t.z), zoom: camera.zoom };
    };
  }, [camera]);

  useFrame((_, dt) => {
    const tw = tween.current, c = controls.current;
    if (!tw || !c) return;
    tw.t = Math.min(1, tw.t + Math.min(dt, 0.1) / TWEEN_S);
    const k = ease(tw.t);
    camera.position.lerpVectors(tw.fromP, tw.toP, k);
    c.target.lerpVectors(tw.fromT, tw.toT, k);
    camera.zoom = THREE.MathUtils.lerp(tw.fromZ, tw.toZ, k);
    camera.updateProjectionMatrix();
    if (tw.t >= 1) tween.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxPolarAngle={1.3}
      screenSpacePanning
      zoomToCursor
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      onStart={() => { tween.current = null; }}
    />
  );
}
