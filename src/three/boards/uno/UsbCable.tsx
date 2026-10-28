import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorkbenchStore } from '../../../state/workbenchStore';
import { castAll, rbox } from '../../shared/geometry';
import { MATERIALS, std } from '../../shared/materials';
import { isTestMode, useReducedMotion } from '../../shared/motion';
import { element, UNO } from './layout';

const PLUG_IN_S = 0.9;   // how long the plug takes to go in
const PULLBACK = 22;     // how far the plug waits in front of the port (mm)
const CABLE_R = 1.6;
const rubber = std('#1C1E24', 0.55);

// The USB cable that powers the board and carries the sketch: a plug (metal tip, black boot) and a cable lying on the table.
// It waits in front of the USB port; pressing Run slides only the little front part of the plug into the port, and it stays in
// (the board has power while it is). Drawn in the board's own coordinates, so it follows the board wherever it stands.
export function UsbCable() {
  const usb = useWorkbenchStore((s) => s.usb);
  const reduced = useReducedMotion();
  const p = useRef(usb ? 1 : 0);          // 0 = waiting in front of the port, 1 = in
  const shown = useRef(-1);

  const zc = UNO.W / 2 - element('X2').y;  // the port's centre across the board
  const yc = UNO.T + 5.45;                 // …and above the table
  const x0 = -6.45 - UNO.L / 2 + 0.2;      // the port's opening along the board
  const fx = useMemo(() => {
    const plug = new THREE.Group();
    const tip = rbox(11.5, 10.2, 7.6, 0.8, MATERIALS.metal, 3); tip.position.x = 5.75;           // the part that goes into the port
    const boot = rbox(18, 13.5, 11.5, 2.2, rubber, 3); boot.position.x = -9;                      // the plastic grip
    const relief = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.6, 8, 20), rubber); relief.rotation.z = Math.PI / 2; relief.position.x = -22;
    plug.add(tip, boot, relief);
    castAll(plug);
    const cable = new THREE.Mesh(new THREE.BufferGeometry(), rubber);
    cable.castShadow = true;
    cable.raycast = () => {};
    const root = new THREE.Group();
    root.add(plug, cable);
    root.userData.noFit = true;
    return { root, plug, cable };
  }, []);
  useEffect(() => () => { fx.cable.geometry.dispose(); }, [fx]);

  const place = (k: number) => {
    // eased 0…1 → how far in; a small hop up and over the port's lip on the way
    const e = k * k * (3 - 2 * k), back = (1 - e) * PULLBACK;
    const x = x0 - back, y = yc + (1 - e) * 2.5;
    fx.plug.position.set(x, y, zc);
    const start = new THREE.Vector3(x - 26, y - 0.4, zc);
    const curve = new THREE.CatmullRomCurve3([start, new THREE.Vector3(x - 44, 4.2 + (1 - e) * 1.5, zc + 5), new THREE.Vector3(x - 80, CABLE_R, zc + 24), new THREE.Vector3(x0 - 128, CABLE_R, zc + 34)], false, 'centripetal');
    fx.cable.geometry.dispose();
    fx.cable.geometry = new THREE.TubeGeometry(curve, 40, CABLE_R, 10);
  };
  place(p.current);
  shown.current = p.current;

  useFrame((_, dtRaw) => {
    const want = usb ? 1 : 0;
    if (p.current === want) return;
    p.current = reduced ? want : p.current + Math.sign(want - p.current) * Math.min(Math.abs(want - p.current), Math.min(dtRaw, 0.1) / PLUG_IN_S);
    place(p.current);
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.usbProgress = p.current;
  });
  return <primitive object={fx.root} />;
}
