import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

// Dragging a part across the bench with the pointer, like pushing something over a table: the part keeps the spot you
// grabbed it by (it does not jump to the pointer), and stays where it last fitted when the pointer goes somewhere it can't.
type Controls = { enabled: boolean } | null;

export const DRAG_SLOP_PX = 6; // a press that moves less than this is a tap (select), not a drag

// the part's new place: where it was, moved by how far the pointer's point on the bench moved since the grab
export function dragTarget(at: { x: number; z: number }, grabbed: { x: number; z: number }, now: { x: number; z: number }) {
  return { x: Math.round(at.x + (now.x - grabbed.x)), z: Math.round(at.z + (now.z - grabbed.z)) }; // a millimetre at a time
}

// A finger on a part that is not selected yet belongs to the camera (orbit, pinch): select it first, then drag it.
export const mayStartDrag = (pointerType: string, selected: boolean) => pointerType !== 'touch' || selected;

// Handler for a part's pointer-down. `getAt` gives the part's place now; `onMove` is told each new place (it may refuse:
// then the part stays where it last fitted); `selected` says whether the part is the selected one (needed for touch).
export function useMoveDrag(getAt: () => { x: number; z: number }, onMove: (at: { x: number; z: number }) => boolean | void, selected: boolean) {
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as Controls;
  return (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || !mayStartDrag(e.pointerType, selected)) return;
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const point = (cx: number, cy: number) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null;
    };
    const down = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, id: e.pointerId };
    const start = getAt(), grabbed = point(down.x, down.y);
    if (!grabbed) return;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== down.id) return;
      if (!dragging) {
        if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < DRAG_SLOP_PX) return;
        dragging = true;
        if (controls) controls.enabled = false; // the camera stays still while a part is carried
        document.body.style.cursor = 'grabbing';
      }
      const now = point(ev.clientX, ev.clientY);
      if (now) onMove(dragTarget(start, grabbed, now));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== down.id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (dragging) { if (controls) controls.enabled = true; document.body.style.cursor = ''; }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
}
