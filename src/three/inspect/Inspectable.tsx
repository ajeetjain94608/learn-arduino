import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useInspectStore } from '../../state/inspectStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { isTestMode, useReducedMotion } from '../shared/motion';
import { findPart } from './findPart';
import { approach, LIFT } from './lift';

const shown = (o: THREE.Object3D | null): boolean => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const firstPart = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
  for (const hit of e.intersections) {
    if (!shown(hit.object)) continue;
    return findPart(hit.object); // nearest visible thing decides: the bare PCB or bench means "no part"
  }
  return null;
};

// Wraps scene content whose parts (pivots made by makePart / PartGroup) can be inspected:
// mouse hover lifts a part slightly and shows its name; a click or tap selects it.
type Motion = { lift: number; zoom: number; baseY: number; pressedUntil?: number };

// Parts you operate rather than lift: tapping one presses it and runs its action.
const PRESS_DEPTH = -0.45, PRESS_S = 0.18;
const ACTIONS: Record<string, () => void> = {
  reset: () => useWorkbenchStore.getState().resetBoard(),
};

export function Inspectable({ children, onEmptyTap }: { children: ReactNode; onEmptyTap?(): void }) {
  const root = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const reduced = useReducedMotion();
  const pivots = useRef<Map<string, THREE.Object3D>>(new Map());
  // Animation state lives here, not in userData: React re-renders may replace a pivot's userData.
  const motion = useRef(new WeakMap<THREE.Object3D, Motion>());

  // Pivots are created once with the scene; index them after mount.
  useEffect(() => {
    const map = new Map<string, THREE.Object3D>();
    root.current?.traverse((o) => { if (o.userData?.partId) map.set(o.userData.partId, o); });
    pivots.current = map;
    if (isTestMode()) {
      const debug = ((window.__rq ??= { debug: {} }).debug);
      const v = new THREE.Vector3();
      debug.partScreenPos = (id: string) => {
        const p = map.get(id);
        if (!p) return null;
        p.getWorldPosition(v).project(camera);
        return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height };
      };
      debug.lift = (id: string) => { const p = map.get(id); return (p && motion.current.get(p)?.lift) ?? 0; };
    }
  }, [camera, size.width, size.height]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const { hovered, selected } = useInspectStore.getState();
    for (const [id, p] of pivots.current) {
      let m = motion.current.get(p);
      if (!m) { m = { lift: 0, zoom: 1, baseY: p.userData.baseY ?? p.position.y }; motion.current.set(p, m); }
      const pressable = p.userData.kind in ACTIONS;
      const target = pressable
        ? { y: (m.pressedUntil ?? 0) > performance.now() ? PRESS_DEPTH : 0, scale: 1 }
        : id === selected ? LIFT.selected : id === hovered ? LIFT.hover : LIFT.idle;
      const lift = reduced ? target.y : approach(m.lift, target.y, dt);
      const zoom = reduced ? target.scale : approach(m.zoom, target.scale, dt);
      m.lift = lift; m.zoom = zoom;
      // always re-apply: a re-render can reset the pivot's position from its props
      p.position.y = m.baseY + lift;
      p.scale.setScalar(zoom);
    }
  });

  const setCursor = (c: string) => { document.body.style.cursor = c; };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const store = useInspectStore.getState();
    const hit = e.pointerType === 'mouse' ? firstPart(e) : null;
    if (!hit) { if (store.hovered) store.unhover(store.hovered); setCursor(''); return; }
    store.hover(hit.partId, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    setCursor('pointer');
  };
  const onLeave = () => { const s = useInspectStore.getState(); if (s.hovered) s.unhover(s.hovered); setCursor(''); };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const hit = firstPart(e);
    // Hidden circuit parts and the bare PCB still intercept the raycast, so R3F won't report a "miss":
    // a tap that reaches no visible part is a tap on empty bench.
    if (!hit) { onEmptyTap?.(); return; }
    const action = ACTIONS[hit.kind];
    if (action) {
      const m = motion.current.get(hit.pivot);
      if (m) m.pressedUntil = performance.now() + PRESS_S * 1000;
      action();
      // keep the name card up without toggling it off on a second press
      if (useInspectStore.getState().selected === hit.partId) return;
    }
    useInspectStore.getState().select(hit.partId, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  };

  return (
    <group ref={root} onPointerMove={onMove} onPointerLeave={onLeave} onClick={onClick}>
      {children}
    </group>
  );
}

// Declarative pivot for scene parts built as React components (circuit view parts).
export function PartGroup({ id, kind, center, children }: { id: string; kind: string; center: [number, number, number]; children: ReactNode }) {
  const [x, y, z] = center;
  const userData = useMemo(() => ({ partId: id, kind, baseY: y }), [id, kind, y]);
  const pos = useMemo(() => [x, y, z] as const, [x, y, z]);
  const back = useMemo(() => [-x, -y, -z] as const, [x, y, z]);
  return (
    <group position={pos} userData={userData}>
      <group position={back}>{children}</group>
    </group>
  );
}
