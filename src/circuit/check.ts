import { UNO_PINS, unoPinNumber } from './board';
import { buildNets } from './nets';
import { PART_DEFS } from './parts';
import type { CircuitSpec, PartInstance } from './types';

export type Warning = { kind: 'short'; supply: '5V' | '3V3' } | { kind: 'pin'; pin: string; to: '5V' | '3V3' | 'GND' };

const legs = (p: PartInstance) =>
  Object.fromEntries(Object.entries(PART_DEFS[p.type].footprint(p.at, p.params) ?? {}).map(([pin, hole]) => [pin, `bb.${hole}`]));

// Dangerous wiring that can be seen before running (spec §5.4): a supply wired straight to GND, or an I/O pin wired
// straight to a supply or GND with no part in between (it burns as soon as the code drives it the other way).
export function checkWiring(spec: CircuitSpec): Warning[] {
  const nets = buildNets(spec, legs);
  const net = (pin: string) => nets.netOf(`uno.${pin}`);
  const out: Warning[] = [];
  for (const supply of ['5V', '3V3'] as const) if (net(supply) === net('GND')) out.push({ kind: 'short', supply });
  for (const pin of UNO_PINS) {
    if (unoPinNumber(pin) === null) continue;
    const to = (['5V', '3V3', 'GND'] as const).find((s) => net(s) === net(pin));
    if (to) out.push({ kind: 'pin', pin, to });
  }
  return out;
}
