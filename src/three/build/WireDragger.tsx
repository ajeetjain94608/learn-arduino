import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PinRef } from '../../circuit/types';
import { noOutline } from '../shared/layers';
import { isTestMode } from '../shared/motion';
import { pinWorld } from './pinPoints';

const SNAP_PX = 22; // a press or release this close (on screen) to a pin or hole counts as on it
const DRAG_PLANE_Y = 14; // the loose end of a wire being dragged floats at this height (mm)

// Drag a wire in 3D: press near a UNO pin or a free breadboard hole, drag, release near another one.
// A press on a part (to turn a knob, press a button, select it) belongs to the part; presses that are not near a
// point are left to the camera controls (orbit).
export function WireDragger({ targets, color, onWire }: { targets: PinRef[]; color: string; onWire(from: PinRef, to: PinRef): void }) {
  const { camera, gl, scene } = useThree();
  const points = useMemo(() => targets.map((ref) => ({ ref, world: pinWorld(ref) })), [targets]);
  const latest = useRef({ points, onWire });
  latest.current = { points, onWire };

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
  useEffect(() => () => { fx.geo.dispose(); }, [fx]);

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
      const first = ray.intersectObjects(scene.children, true).find((h) => h.object.visible && h.object.type !== 'Line');
      for (let o: THREE.Object3D | null = first?.object ?? null; o; o = o.parent) if (o.userData?.buildPart) return true; // the learner's parts only (the UNO's pieces are tagged partId for Home's inspect)
      return false;
    };
    const down = (ev: PointerEvent) => {
      if (ev.button !== 0 || onPart(ev.clientX, ev.clientY)) return;
      const start = nearest(ev.clientX, ev.clientY);
      if (!start) return; // not near a point: let the camera orbit
      ev.stopImmediatePropagation();
      ev.preventDefault();
      fx.line.visible = true;
      setLine(start.world, start.world);
      let over: typeof start | null = null;
      const move = (e: PointerEvent) => {
        over = nearest(e.clientX, e.clientY);
        if (over?.ref === start.ref) over = null;
        fx.ring.visible = !!over;
        if (over) fx.ring.position.copy(over.world).setY(over.world.y + 0.3);
        setLine(start.world, over ? over.world : looseEnd(e.clientX, e.clientY));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        fx.line.visible = fx.ring.visible = false;
        if (over) latest.current.onWire(start.ref, over.ref);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };
    el.addEventListener('pointerdown', down, { capture: true }); // before the camera controls see the press
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.buildPinScreen = (ref: string) => screen(pinWorld(ref));
    return () => el.removeEventListener('pointerdown', down, { capture: true });
  }, [camera, gl, scene, fx]);

  return <><primitive object={fx.line} /><primitive object={fx.ring} /></>;
}
