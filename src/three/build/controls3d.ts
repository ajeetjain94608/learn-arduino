import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

// Direct 3D controls for parts and props: press and hold, turn a knob, drag something along the bench.
// Each one stops the camera while the pointer is down, and follows the pointer anywhere on the page until it lifts.

type Controls = { enabled: boolean } | null;
export type OnInput = (key: string, value: number) => void;

function track(controls: Controls, move: ((e: PointerEvent) => void) | null, end?: () => void) {
  if (controls) controls.enabled = false;
  const up = () => {
    if (controls) controls.enabled = true;
    if (move) window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    end?.();
  };
  if (move) window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

// Press-and-hold: `key` is 1 while the pointer is down (anywhere it goes), 0 when it lifts.
export function useHold(onInput: OnInput, key = 'pressed') {
  const controls = useThree((s) => s.controls) as Controls;
  return (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInput(key, 1);
    track(controls, null, () => onInput(key, 0));
  };
}

// Turn a knob: drag around its centre, like turning a real one — it turns by how far the pointer goes round
// (wherever you grab it), and stops at the ends. The full range is 270°.
export const pointerAngle = (dx: number, dy: number) => (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° = top, clockwise
export function turnKnob(position: number, fromAngle: number, toAngle: number): number {
  let d = toAngle - fromAngle;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.min(1, Math.max(0, position + d / 270));
}
export function useTurn(knob: THREE.Object3D, position: number, onInput: OnInput) {
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as Controls;
  return (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const v = knob.getWorldPosition(new THREE.Vector3()).project(camera);
    const r = gl.domElement.getBoundingClientRect();
    const cx = r.left + (v.x * 0.5 + 0.5) * r.width, cy = r.top + (-v.y * 0.5 + 0.5) * r.height;
    let pos = position, angle: number | null = null;
    track(controls, (ev) => {
      const dx = ev.clientX - cx, dy = ev.clientY - cy;
      if (dx * dx + dy * dy < 36) return; // too close to the centre to tell the angle
      const a = pointerAngle(dx, dy);
      if (angle !== null) { const p = turnKnob(pos, angle, a); if (p !== pos) { pos = p; onInput('position', p); } }
      angle = a;
    });
  };
}

// Drag something across the bench (a lamp, a hairdryer, an obstacle): `onMove` gets the world point under the
// pointer on the horizontal plane at height `y` (mm), every time the pointer moves while held.
export function useBenchDrag(onMove: (world: THREE.Vector3) => void, y = 0) {
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as Controls;
  return (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit = new THREE.Vector3();
    track(controls, (ev) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      if (ray.ray.intersectPlane(plane, hit)) onMove(hit.clone());
    });
  };
}

// Press down and drag: how far the pointer goes down the screen (px) since the press, from 0 — a harder push.
export function usePressDrag(onDepth: (px: number) => void, onRelease?: () => void) {
  const controls = useThree((s) => s.controls) as Controls;
  return (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const y0 = e.nativeEvent.clientY;
    onDepth(0);
    track(controls, (ev) => onDepth(Math.max(0, ev.clientY - y0)), onRelease);
  };
}
