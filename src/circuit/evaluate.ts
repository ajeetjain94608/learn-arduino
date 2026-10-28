import { buildNets } from './nets';
import {
  boardOf, DEFAULT_BOARD, footprintOf, fsrOhms, isPlaced, ldrOhms, LED_VF, MOTOR_FULL_A, MOTOR_OHMS, PART_DEFS, paramsOf, POT_OHMS, RGB_VF, soilVolts,
  tmp36Volts, TRAFFIC_OHMS, TRAFFIC_VF,
} from './parts';
import { solve, type Element } from './solver';
import type { CircuitSpec, PartInstance, PartType } from './types';

// What the chip is doing on each UNO pin (0–19, A0 = 14).
export type PinDrive = { mode: 'output' | 'input' | 'input-pullup'; high: boolean; duty: number | null };
export type InputValues = Record<string, Record<string, number>>;
export type PartState = {
  brightness?: number; burnt?: boolean; current?: number;
  rgb?: [number, number, number];               // an RGB LED's red, green, blue (0–1 each)
  lights?: { R: number; Y: number; G: number }; // the traffic-light module's three LEDs
  speed?: number;                               // a motor, 0–1
  powered?: boolean;                            // a module with its supply and ground wired
};
export type Burn = { id: string; reason: 'led-overcurrent' | 'pin-overcurrent' | 'short' | 'reversed'; supply?: string }; // supply: which one was shorted
export type CircuitResult = {
  pinVolts: number[];
  wireVolts: Record<string, number>; // each wire's voltage (the live wire tags)
  parts: Record<string, PartState>;
  newBurns: Burn[];
  board: { shorted: boolean; burntPins: number[] };
};

// The UNO's electrical behaviour (spec §5.3, plan Global Constraints)
const PIN_OHMS = 25, PULLUP_OHMS = 35_000;
const SUPPLIES = [{ pin: '5V', volts: 5, ohms: 0.05 }, { pin: '3V3', volts: 3.3, ohms: 0.5 }, { pin: 'VIN', volts: 4.7, ohms: 0.6 }];
const LED_RON = 15, LED_FULL_A = 0.02;
const LED_BURN_A = 0.05, PIN_BURN_A = 0.04, SHORT_A = 1;
const unoPinName = (n: number) => (n < 14 ? `D${n}` : `A${n - 14}`);

// Modules that need power: their supply and ground pins, what they draw, and the least voltage they work on.
const POWER: Partial<Record<PartType, { vcc: string; gnd: string; ohms: number; min: number }>> = {
  tmp36: { vcc: 'VS', gnd: 'GND', ohms: 100_000, min: 2.7 },
  servo: { vcc: 'V+', gnd: 'GND', ohms: 500, min: 4.5 },
  hcsr04: { vcc: 'VCC', gnd: 'GND', ohms: 333, min: 4.5 },
  stepper: { vcc: '+', gnd: '-', ohms: 200, min: 4.5 },
  oled: { vcc: 'VCC', gnd: 'GND', ohms: 250, min: 3 },
  soil: { vcc: 'VCC', gnd: 'GND', ohms: 1000, min: 3.0 }, // runs from 3.3 V too (the pin's supply droops to ~3.298 V under load)
};
const REVERSED_V = 2.5; // how far below its ground a module's supply pin may be before it burns
const TIP120 = { vbe: 1.4, rbe: 50, ron: 2, ibOn: 1e-4 };

// Nets depend only on the circuit, which changes far less often than the pins: work them out once per circuit.
const netCache = new WeakMap<CircuitSpec, ReturnType<typeof buildNets>>();
const legs = (p: PartInstance): Record<string, string> =>
  Object.fromEntries(Object.entries(footprintOf(p) ?? {}).map(([pin, hole]) => [pin, `${boardOf(p) ?? DEFAULT_BOARD}.${hole}`]));
const netsOf = (spec: CircuitSpec) => {
  let nets = netCache.get(spec);
  if (!nets) {
    nets = buildNets(spec, legs);
    for (const p of spec.parts) for (const pin of PART_DEFS[p.type].pins) nets.netOf(`${p.id}.${pin}`); // every pin numbered up front
    netCache.set(spec, nets);
  }
  return nets;
};

// For every pin of every part, the UNO pin (0–19) it is wired to, 'GND' when it is on ground, or null — what timing
// modules listen to or drive.
export type Link = number | 'GND' | null;
export function unoLinks(spec: CircuitSpec): Record<string, Record<string, Link>> {
  const nets = netsOf(spec);
  const unoNet = new Map<number, Link>();
  for (let n = 19; n >= 0; n--) unoNet.set(nets.netOf(`uno.${unoPinName(n)}`), n);
  unoNet.set(nets.netOf('uno.GND'), 'GND');
  return Object.fromEntries(spec.parts.map((p) => [p.id, Object.fromEntries(PART_DEFS[p.type].pins.map((pin) => [pin, unoNet.get(nets.netOf(`${p.id}.${pin}`)) ?? null]))]));
}

// Solves the circuit for the chip's current pin states and the learner's inputs, applying the burn rules (unless
// `burnRules` is false). The board is powered from USB the moment it is plugged in, so supply shorts and an LED on a
// supply burn with no program running; with the board stopped every pin is an input, so pin drives cannot burn.
// `burnt` holds everything already burnt: part ids,
// 'uno.D<n>' pins, 'uno' (a shorted board).
export function evaluate(spec: CircuitSpec, pins: PinDrive[], inputs: InputValues, burnt: Set<string>, burnRules = true, usb = true): CircuitResult {
  const nets = netsOf(spec);
  const net = (ref: string) => nets.netOf(ref);
  const ground = net('uno.GND');
  const burns = new Set(burnt);
  const newBurns: Burn[] = [];
  const shortedBefore = burns.has('uno');
  const input = (id: string, key: string, def: number) => inputs[id]?.[key] ?? def;
  const placed = spec.parts.filter(isPlaced);

  type Tagged = { el: Element; tag: string };
  // every element of the circuit; nodes beyond the nets are inside parts (the traffic light's LED–resistor joints)
  const build = (pwmLow: number | null, powered: Set<string>): { t: Tagged[]; nodes: number } => {
    const out: Tagged[] = [];
    let nodes = nets.count;
    const add = (tag: string, el: Element) => out.push({ tag, el });
    if (!usb) return { t: out, nodes }; // the USB cable is not plugged in: the board has no power at all
    if (!burns.has('uno')) for (const s of SUPPLIES) add(`supply:${s.pin}`, { kind: 'V', node: net(`uno.${s.pin}`), volts: s.volts, ohms: s.ohms });
    pins.forEach((d, n) => {
      if (burns.has(`uno.${unoPinName(n)}`) || burns.has('uno')) return;
      const node = net(`uno.${unoPinName(n)}`);
      const high = n === pwmLow ? false : d.duty !== null ? d.duty > 0 : d.high;
      if (d.mode === 'output') add(`pin:${n}`, { kind: 'V', node, volts: high ? 5 : 0, ohms: PIN_OHMS });
      else if (d.mode === 'input-pullup') add(`pull:${n}`, { kind: 'V', node, volts: 5, ohms: PULLUP_OHMS });
    });
    for (const p of placed) {
      const pin = (name: string) => net(`${p.id}.${name}`);
      const prm = paramsOf(p.type, p.params);
      const R = (tag: string, a: number, b: number, ohms: number) => add(tag, { kind: 'R', a, b, ohms });
      const power = POWER[p.type];
      if (power && !burns.has(p.id)) R(`load:${p.id}`, pin(power.vcc), pin(power.gnd), power.ohms);
      switch (p.type) {
        case 'led': if (!burns.has(p.id)) add(`led:${p.id}`, { kind: 'D', a: pin('A'), k: pin('K'), vf: LED_VF[String(prm.color)] ?? 1.9, ron: LED_RON }); break;
        case 'resistor': R(`r:${p.id}`, pin('1'), pin('2'), Number(prm.ohms)); break;
        case 'button':
          R(`b:${p.id}`, pin('1'), pin('3'), 0.01); R(`b:${p.id}`, pin('2'), pin('4'), 0.01);
          if (input(p.id, 'pressed', 0) >= 0.5) R(`b:${p.id}`, pin('1'), pin('2'), 0.1);
          break;
        case 'pot': {
          const pos = Math.min(1, Math.max(0, input(p.id, 'position', 0.5)));
          R(`p:${p.id}`, pin('1'), pin('W'), POT_OHMS * (1 - pos) + 1); R(`p:${p.id}`, pin('W'), pin('2'), POT_OHMS * pos + 1);
          break;
        }
        case 'rgb':
          if (!burns.has(p.id)) for (const c of ['R', 'G', 'B'] as const) add(`rgb:${p.id}:${c}`, { kind: 'D', a: pin(c), k: pin('K'), vf: RGB_VF[c], ron: LED_RON });
          break;
        case 'buzzer': R(`bz:${p.id}`, pin('+'), pin('-'), 1e6); break; // a piezo passes no steady current
        case 'ldr': R(`ldr:${p.id}`, pin('1'), pin('2'), ldrOhms(input(p.id, 'lux', 300))); break;
        case 'fsr': R(`fsr:${p.id}`, pin('1'), pin('2'), fsrOhms(input(p.id, 'grams', 0))); break;
        case 'diode': add(`d:${p.id}`, { kind: 'D', a: pin('A'), k: pin('K'), vf: 0.7, ron: 0.2 }); break;
        case 'npn': add(`q:${p.id}`, { kind: 'Q', b: pin('B'), c: pin('C'), e: pin('E'), ...TIP120 }); break;
        case 'traffic':
          for (const c of ['R', 'Y', 'G'] as const) {
            const joint = nodes++;
            R(`tlr:${p.id}:${c}`, pin(c), joint, TRAFFIC_OHMS);
            add(`tl:${p.id}:${c}`, { kind: 'D', a: joint, k: pin('GND'), vf: TRAFFIC_VF[c], ron: LED_RON });
          }
          break;
        case 'motor': R(`m:${p.id}`, pin('+'), pin('-'), MOTOR_OHMS); break;
        case 'tmp36': if (powered.has(p.id)) add(`src:${p.id}`, { kind: 'V', node: pin('OUT'), volts: tmp36Volts(input(p.id, 'celsius', 22)), ohms: 50 }); break;
        case 'soil': if (powered.has(p.id)) add(`src:${p.id}`, { kind: 'V', node: pin('AOUT'), volts: soilVolts(input(p.id, 'moisture', 50)), ohms: 1000 }); break;
        case 'stepper': for (const i of ['IN1', 'IN2', 'IN3', 'IN4']) R(`in:${p.id}`, pin(i), pin('-'), 5000); break;
        default: break; // servo, HC-SR04, OLED: their signals are handled by the simulator, cycle by cycle
      }
    }
    return { t: out, nodes };
  };

  // which modules have power: a first solve with every module's own outputs off
  const probe = (() => { const b = build(null, new Set()); return solve(b.t.map((x) => x.el), b.nodes, ground); })();
  // a module wired with its supply and ground swapped burns the moment it is powered
  for (const p of placed) {
    const pw = POWER[p.type];
    if (!burnRules || !pw || burns.has(p.id)) continue;
    if (probe.volts[net(`${p.id}.${pw.vcc}`)] - probe.volts[net(`${p.id}.${pw.gnd}`)] <= -REVERSED_V) { burns.add(p.id); newBurns.push({ id: p.id, reason: 'reversed' }); }
  }
  const powered = new Set(placed.filter((p) => {
    const pw = POWER[p.type];
    if (!pw || burns.has(p.id)) return false;
    const vcc = probe.volts[net(`${p.id}.${pw.vcc}`)], gnd = probe.volts[net(`${p.id}.${pw.gnd}`)];
    return vcc - gnd >= pw.min && Math.abs(gnd) < 0.5;
  }).map((p) => p.id));

  const run = (pwmLow: number | null = null) => { const b = build(pwmLow, powered); return { t: b.t, r: solve(b.t.map((x) => x.el), b.nodes, ground) }; };
  const currentOf = (s: ReturnType<typeof run>, tag: string) => { const i = s.t.findIndex((x) => x.tag === tag); return i < 0 ? 0 : s.r.current[i]; };

  // burn rules, most fragile first; each burn changes the circuit, so solve again
  let s = run();
  for (let guard = 0; burnRules && guard < 20; guard++) {
    const led = s.t.find((x) => (x.tag.startsWith('led:') || x.tag.startsWith('rgb:')) && currentOf(s, x.tag) > LED_BURN_A);
    if (led) { const id = led.tag.split(':')[1]; burns.add(id); newBurns.push({ id, reason: 'led-overcurrent' }); s = run(); continue; }
    const pin = s.t.find((x) => x.tag.startsWith('pin:') && Math.abs(currentOf(s, x.tag)) > PIN_BURN_A);
    if (pin && !SUPPLIES.some((sp) => Math.abs(currentOf(s, `supply:${sp.pin}`)) > SHORT_A)) {
      const id = `uno.${unoPinName(Number(pin.tag.slice(4)))}`; burns.add(id); newBurns.push({ id, reason: 'pin-overcurrent' }); s = run(); continue;
    }
    const shorted = burns.has('uno') ? undefined : SUPPLIES.find((sp) => Math.abs(currentOf(s, `supply:${sp.pin}`)) > SHORT_A);
    if (shorted) { burns.add('uno'); newBurns.push({ id: 'uno', reason: 'short', supply: shorted.pin }); s = run(); continue; }
    break;
  }

  // PWM: what a part shows is the time average of the pin's HIGH and LOW states (one extra solve per PWM pin)
  const pwmPins = pins.flatMap((d, n) => (d.mode === 'output' && d.duty !== null && d.duty > 0 && d.duty < 1 ? [n] : []));
  const lowRuns = new Map<number, ReturnType<typeof run>>();
  const averaged = (tag: string) => {
    const iHigh = Math.max(0, currentOf(s, tag));
    for (const n of pwmPins) {
      if (!lowRuns.has(n)) lowRuns.set(n, run(n));
      const iLow = Math.max(0, currentOf(lowRuns.get(n)!, tag));
      if (Math.abs(iLow - iHigh) > 1e-6) { const d = pins[n].duty!; return d * iHigh + (1 - d) * iLow; }
    }
    return iHigh;
  };
  const glow = (i: number) => Math.min(1, i / LED_FULL_A);

  const parts: Record<string, PartState> = {};
  for (const p of spec.parts) {
    const burnt = burns.has(p.id);
    switch (p.type) {
      case 'led': {
        const i = burnt ? 0 : averaged(`led:${p.id}`);
        parts[p.id] = burnt ? { burnt: true, brightness: 0, current: 0 } : { brightness: glow(i), current: i };
        break;
      }
      case 'rgb':
        parts[p.id] = burnt ? { burnt: true, rgb: [0, 0, 0] }
          : { rgb: (['R', 'G', 'B'] as const).map((c) => glow(averaged(`rgb:${p.id}:${c}`))) as [number, number, number] };
        break;
      case 'traffic':
        parts[p.id] = { lights: { R: glow(averaged(`tl:${p.id}:R`)), Y: glow(averaged(`tl:${p.id}:Y`)), G: glow(averaged(`tl:${p.id}:G`)) } };
        break;
      case 'motor': {
        const i = averaged(`m:${p.id}`);
        parts[p.id] = { speed: i < 0.01 ? 0 : Math.min(1, i / MOTOR_FULL_A), current: i };
        break;
      }
      case 'diode': parts[p.id] = { current: Math.max(0, currentOf(s, `d:${p.id}`)) }; break;
      default:
        if (POWER[p.type]) parts[p.id] = burnt ? { powered: false, burnt: true } : { powered: powered.has(p.id) };
    }
  }

  return {
    pinVolts: pins.map((_, n) => s.r.volts[net(`uno.${unoPinName(n)}`)]),
    wireVolts: Object.fromEntries(spec.wires.map((w) => [w.id, s.r.volts[net(w.from)]])),
    parts,
    newBurns,
    board: {
      shorted: burns.has('uno') || shortedBefore,
      burntPins: pins.flatMap((_, n) => (burns.has(`uno.${unoPinName(n)}`) ? [n] : [])),
    },
  };
}

// Whether anything in the solved circuit is drawing current (a lit LED, a spinning motor, a powered module…): when nothing is,
// there is no current to show on the wires.
export const anyCurrent = (parts: Record<string, PartState>): boolean => Object.values(parts).some((p) =>
  (p.brightness ?? 0) > 0.01 || (p.speed ?? 0) > 0.01 || (p.current ?? 0) > 0.002 || !!p.powered
  || !!p.rgb?.some((v) => v > 0.01) || (!!p.lights && Object.values(p.lights).some((v) => v > 0.01)));
