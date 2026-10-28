import { connectedHoles } from '../three/breadboard/breadboardGeometry';
import { buildNets } from './nets';
import { boardOf, DEFAULT_BOARD, footprintOf, isFree } from './parts';
import type { CircuitSpec, PartInstance, PinRef, Row } from './types';

// What the schematic (the wiring tab's 2D drawing) needs to know about the circuit: which pins are on the same net, what to call
// each net, and where a jumper goes when two pins are joined on the drawing.

const legs = (p: PartInstance) => Object.fromEntries(Object.entries(footprintOf(p) ?? {}).map(([pin, hole]) => [pin, `${boardOf(p) ?? DEFAULT_BOARD}.${hole}`]));
// the names a net takes from the UNO pin it is joined to, most telling first
const RANK = ['GND', '5V', '3V3', 'VIN'];

// The net of every pin of every part ("led1.A") and UNO pin ("uno.D13"), and a name for each net that joins two or more of them:
// the UNO pin it ends at (GND, 5V, D13…), or N1, N2… when it joins parts only. A pin alone on its net has no name.
export function schematicNets(spec: CircuitSpec, refs: PinRef[]): { netOf(ref: PinRef): number; nameOf(ref: PinRef): string | null; colorOf(ref: PinRef): string | null } {
  const nets = buildNets(spec, legs);
  const groups = new Map<number, PinRef[]>();
  for (const r of refs) { const n = nets.netOf(r); (groups.get(n) ?? groups.set(n, []).get(n)!).push(r); }
  const names = new Map<number, string>();
  let k = 0;
  for (const [n, rs] of groups) {
    if (rs.length < 2) continue;
    const unos = rs.filter((r) => r.startsWith('uno.')).map((r) => r.slice(4));
    const best = [...RANK, ...unos].find((p) => unos.includes(p));
    names.set(n, best ?? `N${++k}`);
  }
  const colors = new Map<number, string>();
  for (const w of spec.wires) { const n = nets.netOf(w.from); if (!colors.has(n)) colors.set(n, w.color); }
  return { netOf: (r) => nets.netOf(r), nameOf: (r) => names.get(nets.netOf(r)) ?? null, colorOf: (r) => colors.get(nets.netOf(r)) ?? null };
}

// Where a jumper goes to join this pin of this part: a pin of a part on the table takes it directly; a leg in a breadboard hole
// takes it in a free hole of the same strip (the five holes are joined inside). Null when there is no room.
export function jumperPoint(p: PartInstance, pin: string, used: Set<PinRef>): PinRef | null {
  if (isFree(p)) { const ref = `${p.id}.${pin}`; return used.has(ref) ? null : ref; }
  const hole = footprintOf(p)?.[pin];
  if (!hole) return null;
  const board = boardOf(p) ?? DEFAULT_BOARD;
  const col = Number(hole.replace(/[a-j]$/, '')), row = hole.slice(-1) as Row;
  for (const h of connectedHoles(col, row)) { const ref = `${board}.${h.col}${h.row}`; if (!used.has(ref)) return ref; }
  return null;
}
