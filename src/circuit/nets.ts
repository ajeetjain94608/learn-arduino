import { BB_HOLES, bbInternalNets, UNO_PINS } from './board';
import type { CircuitSpec, PartInstance, PinRef } from './types';

// Which connection points are electrically the same (a "net"): breadboard strips and rails, wires, and part legs
// sitting in holes. `legs(p)` gives each of a part's pins the breadboard hole it sits in (as "bb.<hole>").
export function buildNets(spec: CircuitSpec, legs: (p: PartInstance) => Record<string, PinRef>): { netOf(ref: PinRef): number; count: number } {
  const index = new Map<PinRef, number>();
  const parent: number[] = [];
  const id = (ref: PinRef) => {
    let i = index.get(ref);
    if (i === undefined) { i = parent.length; index.set(ref, i); parent.push(i); }
    return i;
  };
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a: PinRef, b: PinRef) => { const ra = find(id(a)), rb = find(id(b)); if (ra !== rb) parent[ra] = rb; };

  for (const p of UNO_PINS) id(`uno.${p}`);
  for (const h of BB_HOLES) id(`bb.${h}`);
  for (const group of bbInternalNets()) for (let k = 1; k < group.length; k++) join(`bb.${group[0]}`, `bb.${group[k]}`);
  for (const w of spec.wires) join(w.from, w.to);
  for (const p of spec.parts) for (const [pin, hole] of Object.entries(legs(p))) join(`${p.id}.${pin}`, hole);

  // number the nets 0…count-1
  const netNo = new Map<number, number>();
  for (let i = 0; i < parent.length; i++) { const r = find(i); if (!netNo.has(r)) netNo.set(r, netNo.size); }
  return {
    netOf(ref) { const r = find(id(ref)); if (!netNo.has(r)) netNo.set(r, netNo.size); return netNo.get(r)!; }, // an unknown point is its own net
    get count() { return netNo.size; },
  };
}
