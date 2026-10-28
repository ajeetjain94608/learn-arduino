import * as THREE from 'three';
import { footprintOf, PART_DEFS, usesBreadboard } from '../../circuit/parts';
import type { PartType } from '../../circuit/types';
import { COMPONENTS } from '../../content/components';
import type { Project } from '../../content/projects';
import { BB, colX, ROW } from '../../three/breadboard/breadboardGeometry';
import { BENCH, pinWorld } from '../../three/build/pinPoints';
import type { View } from '../../three/workbench/cameraViews';
import { HEIGHT } from '../../three/build/partBodies';
import type { Hotspot } from './hotspots';

// A second line under each name: what the part does, at a glance.
const SUB: Record<string, string> = {
  uno: 'Runs your code', breadboard: 'No soldering', led: 'Lights up', resistor: 'Limits current', button: 'Press me', pot: 'Turn me',
  diode: 'One-way valve', npn: 'Motor switch', rgb: 'Any colour', buzzer: 'Makes sound', traffic: 'Red, yellow, green', motor: 'Spins',
  servo: 'Turns to an angle', stepper: 'Exact steps', oled: 'Shows text', ldr: 'Senses light', tmp36: 'Senses heat', fsr: 'Senses force',
  hcsr04: 'Measures distance', soil: 'Senses moisture',
};
// where each card sits from its dot (px): spread around so labels start apart (they are pushed apart further if they overlap)
const OFFSETS: [number, number][] = [[-20, -95], [95, -60], [-110, 40], [60, 85], [150, -20], [-70, -150], [-150, -50], [20, 140], [130, 80], [-130, 110]];

// The labels for a project's circuit: one for each kind of part in it, the UNO and the breadboard. Each has the library's
// text for the info card when tapped.
export function projectHotspots(project: Project, view: View): Hotspot[] {
  const seen = new Set<PartType>();
  const spots: { id: string; type: string; anchor: () => THREE.Vector3 }[] = [];
  for (const p of project.build.parts) {
    if (seen.has(p.type)) continue;
    seen.add(p.type);
    const bench = PART_DEFS[p.type].bench;
    if (bench && 'x' in p.at) {
      const { x, z } = p.at;
      spots.push({ id: p.type, type: p.type, anchor: () => new THREE.Vector3(x, bench.h + 3, z) });
    } else if ('x' in p.at) { // a part standing on the table
      const { x, z } = p.at;
      spots.push({ id: p.type, type: p.type, anchor: () => new THREE.Vector3(x, (HEIGHT[p.type] ?? 8) + 4, z) });
    } else {
      const holes = Object.values(footprintOf(p) ?? {});
      const ref = holes[Math.floor(holes.length / 2)] ?? holes[0];
      spots.push({ id: p.type, type: p.type, anchor: () => (ref ? pinWorld(`bb.${ref}`).add(new THREE.Vector3(0, (HEIGHT[p.type] ?? 8) + 2, 0)) : new THREE.Vector3(0, BB.H + 10, 0)) });
    }
  }
  spots.push({ id: 'uno', type: 'uno', anchor: () => pinWorld('uno.D13').add(new THREE.Vector3(-12, 4, 14)) });
  if (usesBreadboard(project.build.parts, project.build.wires)) spots.push({ id: 'breadboard', type: 'breadboard', anchor: () => new THREE.Vector3(colX(24) + BENCH.breadboard[0], BB.H + BENCH.breadboard[1], ROW.h + BENCH.breadboard[2]) });
  return spots.map((s, i) => ({
    id: s.id, view, offset: OFFSETS[i % OFFSETS.length], anchor: s.anchor,
    name: COMPONENTS[s.type as keyof typeof COMPONENTS].name,
    sub: SUB[s.type] ?? '',
    text: COMPONENTS[s.type as keyof typeof COMPONENTS].overview,
  }));
}
