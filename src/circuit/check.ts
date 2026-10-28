import { UNO_PINS, unoPinNumber } from './board';
import { buildNets } from './nets';
import { boardOf, DEFAULT_BOARD, footprintOf } from './parts';
import type { CircuitSpec, PartInstance } from './types';

export type Supply = '5V' | '3V3' | 'VIN';
export type Warning = { kind: 'short'; supply: Supply } | { kind: 'clash'; a: Supply; b: Supply } | { kind: 'pin'; pin: string; to: Supply | 'GND' };

const legs = (p: PartInstance) =>
  Object.fromEntries(Object.entries(footprintOf(p) ?? {}).map(([pin, hole]) => [pin, `${boardOf(p) ?? DEFAULT_BOARD}.${hole}`]));

// Dangerous wiring that can be seen before running (spec §5.4): a supply wired straight to GND, or an I/O pin wired
// straight to a supply or GND with no part in between (it burns as soon as the code drives it the other way).
export function checkWiring(spec: CircuitSpec): Warning[] {
  const nets = buildNets(spec, legs);
  const net = (pin: string) => nets.netOf(`uno.${pin}`);
  const out: Warning[] = [];
  const supplies: Supply[] = ['5V', '3V3', 'VIN'];
  for (const supply of supplies) if (net(supply) === net('GND')) out.push({ kind: 'short', supply });
  // two supplies wired together fight each other
  supplies.forEach((a, i) => supplies.slice(i + 1).forEach((b) => { if (net(a) === net(b) && net(a) !== net('GND')) out.push({ kind: 'clash', a, b }); }));
  for (const pin of UNO_PINS) {
    if (unoPinNumber(pin) === null) continue;
    const to = (['5V', '3V3', 'VIN', 'GND'] as const).find((s) => net(s) === net(pin));
    if (to) out.push({ kind: 'pin', pin, to });
  }
  return out;
}
