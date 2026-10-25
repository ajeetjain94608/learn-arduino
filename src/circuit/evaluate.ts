import { buildNets } from './nets';
import { LED_VF, PART_DEFS, paramsOf, POT_OHMS } from './parts';
import { solve, type Element } from './solver';
import type { CircuitSpec, PartInstance } from './types';

// What the chip is doing on each UNO pin (0–19, A0 = 14).
export type PinDrive = { mode: 'output' | 'input' | 'input-pullup'; high: boolean; duty: number | null };
export type InputValues = Record<string, Record<string, number>>;
export type PartState = { brightness?: number; burnt?: boolean; current?: number };
export type Burn = { id: string; reason: 'led-overcurrent' | 'pin-overcurrent' | 'short' };
export type CircuitResult = {
  pinVolts: number[];
  parts: Record<string, PartState>;
  newBurns: Burn[];
  board: { shorted: boolean; burntPins: number[] };
};

// The UNO's electrical behaviour (spec §5.3, plan Global Constraints)
const PIN_OHMS = 25, PULLUP_OHMS = 35_000;
const SUPPLIES = [{ pin: '5V', volts: 5, ohms: 0.05 }, { pin: '3V3', volts: 3.3, ohms: 0.5 }];
const LED_RON = 15, LED_FULL_A = 0.02;
const LED_BURN_A = 0.05, PIN_BURN_A = 0.04, SHORT_A = 1;
const unoPinName = (n: number) => (n < 14 ? `D${n}` : `A${n - 14}`);

// Nets depend only on the circuit, which changes far less often than the pins: work them out once per circuit.
const netCache = new WeakMap<CircuitSpec, ReturnType<typeof buildNets>>();

const legs = (p: PartInstance): Record<string, string> =>
  Object.fromEntries(Object.entries(PART_DEFS[p.type].footprint(p.at, p.params) ?? {}).map(([pin, hole]) => [pin, `bb.${hole}`]));

// Solves the circuit for the chip's current pin states and the learner's inputs, applying the burn rules.
// `burnt` holds everything already burnt: part ids, 'uno.D<n>' pins, 'uno' (a shorted board).
export function evaluate(spec: CircuitSpec, pins: PinDrive[], inputs: InputValues, burnt: Set<string>): CircuitResult {
  let nets = netCache.get(spec);
  if (!nets) { nets = buildNets(spec, legs); netCache.set(spec, nets); }
  const net = (ref: string) => nets.netOf(ref);
  const ground = net('uno.GND');
  const burns = new Set(burnt);
  const newBurns: Burn[] = [];
  const shortedBefore = burns.has('uno');

  type Tagged = { el: Element; tag: string };
  const build = (pwmLow: number | null): Tagged[] => {
    const out: Tagged[] = [];
    if (!burns.has('uno')) for (const s of SUPPLIES) out.push({ tag: `supply:${s.pin}`, el: { kind: 'V', node: net(`uno.${s.pin}`), volts: s.volts, ohms: s.ohms } });
    pins.forEach((d, n) => {
      if (burns.has(`uno.${unoPinName(n)}`) || burns.has('uno')) return;
      const node = net(`uno.${unoPinName(n)}`);
      const high = n === pwmLow ? false : d.duty !== null ? d.duty > 0 : d.high;
      if (d.mode === 'output') out.push({ tag: `pin:${n}`, el: { kind: 'V', node, volts: high ? 5 : 0, ohms: PIN_OHMS } });
      else if (d.mode === 'input-pullup') out.push({ tag: `pull:${n}`, el: { kind: 'V', node, volts: 5, ohms: PULLUP_OHMS } });
    });
    for (const p of spec.parts) {
      if (!PART_DEFS[p.type].footprint(p.at, p.params)) continue; // not on the board: not connected
      const pin = (name: string) => net(`${p.id}.${name}`);
      const prm = paramsOf(p.type, p.params);
      if (p.type === 'led' && !burns.has(p.id)) out.push({ tag: `led:${p.id}`, el: { kind: 'D', a: pin('A'), k: pin('K'), vf: LED_VF[String(prm.color)] ?? 1.9, ron: LED_RON } });
      else if (p.type === 'resistor') out.push({ tag: `r:${p.id}`, el: { kind: 'R', a: pin('1'), b: pin('2'), ohms: Number(prm.ohms) } });
      else if (p.type === 'button') {
        out.push({ tag: `b:${p.id}`, el: { kind: 'R', a: pin('1'), b: pin('3'), ohms: 0.01 } }, { tag: `b:${p.id}`, el: { kind: 'R', a: pin('2'), b: pin('4'), ohms: 0.01 } });
        if ((inputs[p.id]?.pressed ?? 0) >= 0.5) out.push({ tag: `b:${p.id}`, el: { kind: 'R', a: pin('1'), b: pin('2'), ohms: 0.1 } });
      } else if (p.type === 'pot') {
        const pos = Math.min(1, Math.max(0, inputs[p.id]?.position ?? 0.5));
        out.push({ tag: `p:${p.id}`, el: { kind: 'R', a: pin('1'), b: pin('W'), ohms: POT_OHMS * (1 - pos) + 1 } }, { tag: `p:${p.id}`, el: { kind: 'R', a: pin('W'), b: pin('2'), ohms: POT_OHMS * pos + 1 } });
      }
    }
    return out;
  };
  const run = (pwmLow: number | null = null) => { const t = build(pwmLow); return { t, r: solve(t.map((x) => x.el), nets.count, ground) }; };
  const currentOf = (s: ReturnType<typeof run>, tag: string) => { const i = s.t.findIndex((x) => x.tag === tag); return i < 0 ? 0 : s.r.current[i]; };

  // burn rules, most fragile first; each burn changes the circuit, so solve again
  let s = run();
  for (let guard = 0; guard < 20; guard++) {
    const led = s.t.find((x) => x.tag.startsWith('led:') && currentOf(s, x.tag) > LED_BURN_A);
    if (led) { const id = led.tag.slice(4); burns.add(id); newBurns.push({ id, reason: 'led-overcurrent' }); s = run(); continue; }
    const pin = s.t.find((x) => x.tag.startsWith('pin:') && Math.abs(currentOf(s, x.tag)) > PIN_BURN_A);
    if (pin && !SUPPLIES.some((sp) => Math.abs(currentOf(s, `supply:${sp.pin}`)) > SHORT_A)) {
      const id = `uno.${unoPinName(Number(pin.tag.slice(4)))}`; burns.add(id); newBurns.push({ id, reason: 'pin-overcurrent' }); s = run(); continue;
    }
    if (!burns.has('uno') && SUPPLIES.some((sp) => Math.abs(currentOf(s, `supply:${sp.pin}`)) > SHORT_A)) {
      burns.add('uno'); newBurns.push({ id: 'uno', reason: 'short' }); s = run(); continue;
    }
    break;
  }

  // PWM: an LED's brightness is the time average of the pin's HIGH and LOW states
  const pwmPins = pins.flatMap((d, n) => (d.mode === 'output' && d.duty !== null && d.duty > 0 && d.duty < 1 ? [n] : []));
  const parts: Record<string, PartState> = {};
  const lowRuns = new Map<number, ReturnType<typeof run>>(); // one extra solve per PWM pin, shared by all LEDs
  for (const p of spec.parts) {
    if (p.type !== 'led') continue;
    if (burns.has(p.id)) { parts[p.id] = { burnt: true, brightness: 0, current: 0 }; continue; }
    const iHigh = Math.max(0, currentOf(s, `led:${p.id}`));
    let i = iHigh;
    for (const n of pwmPins) {
      if (!lowRuns.has(n)) lowRuns.set(n, run(n));
      const iLow = Math.max(0, currentOf(lowRuns.get(n)!, `led:${p.id}`));
      if (Math.abs(iLow - iHigh) > 1e-6) { const d = pins[n].duty!; i = d * iHigh + (1 - d) * iLow; break; }
    }
    parts[p.id] = { brightness: Math.min(1, i / LED_FULL_A), current: i };
  }

  return {
    pinVolts: pins.map((_, n) => s.r.volts[net(`uno.${unoPinName(n)}`)]),
    parts,
    newBurns,
    board: {
      shorted: burns.has('uno') || shortedBefore,
      burntPins: pins.flatMap((_, n) => (burns.has(`uno.${unoPinName(n)}`) ? [n] : [])),
    },
  };
}
