import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PartInstance, PinRef } from '../../circuit/types';
import { disposeOwned } from '../shared/geometry';
import { noOutline } from '../shared/layers';
import { isTestMode } from '../shared/motion';
import { pinWorld } from './pinPoints';
import { TouchHold } from './touchHold';

const SNAP_PX = 22; // a press or release this close (on screen) to a pin or hole counts as on it
const DRAG_PLANE_Y = 14; // the loose end of a wire being dragged floats at this height (mm)

// Drag a wire in 3D: press near a UNO pin or a free breadboard hole, drag, release near another one. With a finger,
// press and hold the point first (a quick drag orbits the camera, two fingers pinch).
// A press on a part (to turn a knob, press a button, select it) belongs to the part; presses that are not near a
// point are left to the camera controls (orbit).
export function WireDragger({ targets, parts, color, onWire }: { targets: PinRef[]; parts: readonly PartInstance[]; color: string; onWire(from: PinRef, to: PinRef): void }) {
  const { camera, gl, scene } = useThree();
  const cameraControls = useThree((s) => s.controls);
  const useThreeControls = useRef(cameraControls);
  useThreeControls.current = cameraControls;
  const points = useMemo(() => targets.map((ref) => ({ ref, world: pinWorld(ref, parts) })), [targets, parts]);
  const latest = useRef({ points, onWire, parts });
  latest.current = { points, onWire, parts };

  const fx = useMemo(() => {
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = noOutline(new THREE.Line(geo, new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false })));
    line.renderOrder = 20;
    line.visible = false;
    const ring = noOutline(new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.35, 8, 24), new THREE.MeshBasicMaterial({ color, depthTest: false })));
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 21;
    ring.visible = false;
    return { line, ring, geo };
  }, [color]);
  useEffect(() => () => { disposeOwned(fx.line); disposeOwned(fx.ring); }, [fx]);

  useEffect(() => {
    const el = gl.domElement;
    const screen = (v: THREE.Vector3) => {
      const p = v.clone().project(camera), r = el.getBoundingClientRect();
      return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
    };
    const nearest = (x: number, y: number) => {
      let best: { ref: PinRef; world: THREE.Vector3 } | null = null, bestD = SNAP_PX * SNAP_PX;
      for (const p of latest.current.points) {
        const s = screen(p.world), d = (s.x - x) ** 2 + (s.y - y) ** 2;
        if (d <= bestD) { bestD = d; best = p; }
      }
      return best;
    };
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y), hit = new THREE.Vector3();
    const looseEnd = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
      return ray.ray.intersectPlane(plane, hit) ?? hit;
    };
    const setLine = (a: THREE.Vector3, b: THREE.Vector3) => {
      const pos = fx.geo.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
      fx.geo.computeBoundingSphere();
    };

    const onPart = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
      const tagOf = (o: THREE.Object3D | null) => { for (; o; o = o.parent) { if (o.userData?.buildPart) return 'part'; if (o.userData?.buildWire) return 'wire'; } return null; };
      // the first thing under the pointer, looking through wires (a wire arching in front of a knob doesn't take the knob's press)
      const first = ray.intersectObjects(scene.children, true).find((h) => h.object.visible && h.object.type !== 'Line' && tagOf(h.object) !== 'wire');
      return tagOf(first?.object ?? null) === 'part'; // the learner's parts only (the UNO's pieces are tagged partId for Home's inspect)
    };
    // The wire follows one pointer only (its pointerId); another finger landing ends it, so pinch still works.
    const drag = (start: { ref: PinRef; world: THREE.Vector3 }, pointerId: number, afterwards: () => void) => {
      fx.line.visible = true;
      setLine(start.world, start.world);
      let over: typeof start | null = null;
      const move = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        over = nearest(e.clientX, e.clientY);
        if (over?.ref === start.ref) over = null;
        fx.ring.visible = !!over;
        if (over) fx.ring.position.copy(over.world).setY(over.world.y + 0.3);
        setLine(start.world, over ? over.world : looseEnd(e.clientX, e.clientY));
      };
      const finish = (e: PointerEvent) => {
        if (e.type === 'pointerdown' ? e.pointerId === pointerId : e.pointerId !== pointerId) return;
        if (e.type === 'pointerdown') over = null; // a second finger: cancel the wire
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        window.removeEventListener('pointerdown', finish);
        fx.line.visible = fx.ring.visible = false;
        afterwards();
        if (over) latest.current.onWire(start.ref, over.ref);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
      window.addEventListener('pointerdown', finish);
    };
    const controls = () => (useThreeControls.current as { enabled: boolean } | null);

    const down = (ev: PointerEvent) => {
      if (ev.button !== 0 || onPart(ev.clientX, ev.clientY)) return;
      const start = nearest(ev.clientX, ev.clientY);
      if (!start) return; // not near a point: let the camera orbit
      if (ev.pointerType !== 'touch') { // mouse and pen: a press on a point starts the wire at once
        ev.stopImmediatePropagation();
        ev.preventDefault();
        drag(start, ev.pointerId, () => {});
        return;
      }
      // touch: the camera keeps the finger (orbit / pinch) unless it is held still on the point
      const hold = new TouchHold(() => {
        cleanup();
        const c = controls();
        if (c) c.enabled = false;
        drag(start, ev.pointerId, () => { if (c) c.enabled = true; });
      });
      const track = (e: PointerEvent) => {
        if (e.pointerId !== ev.pointerId) { if (e.type === 'pointerdown') { hold.second(); cleanup(); } return; }
        if (e.type === 'pointerdown') return; // the press that started the hold, reaching the window
        if (e.type === 'pointermove') hold.move(e.clientX, e.clientY); else { hold.up(); cleanup(); }
      };
      const cleanup = () => { for (const t of ['pointermove', 'pointerup', 'pointercancel', 'pointerdown'] as const) window.removeEventListener(t, track); };
      for (const t of ['pointermove', 'pointerup', 'pointercancel', 'pointerdown'] as const) window.addEventListener(t, track);
      hold.down(ev.clientX, ev.clientY);
    };
    el.addEventListener('pointerdown', down, { capture: true }); // before the camera controls see the press
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.buildPinScreen = (ref: string) => screen(pinWorld(ref, latest.current.parts));
    return () => el.removeEventListener('pointerdown', down, { capture: true });
  }, [camera, gl, scene, fx]);

  return <><primitive object={fx.line} /><primitive object={fx.ring} /></>;
}
