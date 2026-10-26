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
  const scene = useThree((s) => s.scene);
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
    const toT = cameraCmd.kind === 'focus' && cameraCmd.target ? new THREE.Vector3(...cameraCmd.target) : c.target.clone();
    const toP = cameraCmd.kind === 'rotate' ? new THREE.Vector3(...orbitAround(camera.position.toArray() as [number, number, number], t, cameraCmd.amount))
      : cameraCmd.kind === 'focus' ? toT.clone().add(camera.position.clone().sub(c.target)) : camera.position.clone();
    const toZ = cameraCmd.kind === 'zoom' ? clampZoom(camera.zoom * cameraCmd.amount) : cameraCmd.kind === 'focus' ? clampZoom(cameraCmd.amount) : camera.zoom;
    if (reduced) { camera.position.copy(toP); c.target.copy(toT); camera.zoom = toZ; camera.updateProjectionMatrix(); c.update(); return; }
    tween.current = { t: 0, fromP: camera.position.clone(), fromT: c.target.clone(), fromZ: camera.zoom, toP, toT, toZ };
  }, [cameraCmd, camera, reduced]);

  useEffect(() => {
    if (!isTestMode()) return;
    (window.__rq ??= { debug: {} }).debug.camera = () => {
      const t = controls.current?.target ?? new THREE.Vector3();
      return { azimuth: Math.atan2(camera.position.x - t.x, camera.position.z - t.z), zoom: camera.zoom };
    };
    // fit everything drawn (meshes on the outline layer) tightly in view (baking the project pictures)
    window.__rq.debug.frameAll = (pad = 0.08) => {
      const c = controls.current;
      if (!c) return;
      camera.updateMatrixWorld();
      const box = new THREE.Box3();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.visible && m.layers.isEnabled(0)) box.expandByObject(m); });
      if (box.isEmpty()) return;
      const dir = camera.position.clone().sub(c.target).normalize();
      camera.position.copy(c.target).addScaledVector(dir, 600);
      camera.lookAt(c.target);
      camera.updateMatrixWorld();
      const v = new THREE.Vector3(), lo = new THREE.Vector2(Infinity, Infinity), hi = new THREE.Vector2(-Infinity, -Infinity);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        lo.min(new THREE.Vector2(v.x, v.y)); hi.max(new THREE.Vector2(v.x, v.y));
      }
      const { halfW, halfH } = fitOrtho(size.width / size.height);
      const zoom = Math.min(halfW / (((hi.x - lo.x) / 2) * (1 + pad)), halfH / (((hi.y - lo.y) / 2) * (1 + pad)));
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      // the camera looks at the target: moving the target by the bounds' offset (in view space) centres them
      const centre = c.target.clone().addScaledVector(right, (hi.x + lo.x) / 2).addScaledVector(up, (hi.y + lo.y) / 2);
      c.target.copy(centre);
      camera.position.copy(centre).addScaledVector(dir, 600);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      c.update();
      tween.current = null;
    };
    // look at a point (world mm) from the same direction, at this zoom (previews and screenshots)
    window.__rq.debug.lookAt = (x: number, y: number, z: number, zoom: number) => {
      const c = controls.current;
      if (!c) return;
      const dir = camera.position.clone().sub(c.target);
      c.target.set(x, y, z);
      camera.position.copy(c.target).add(dir);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      c.update();
      tween.current = null;
    };
  }, [camera, scene, size.width, size.height]);

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
