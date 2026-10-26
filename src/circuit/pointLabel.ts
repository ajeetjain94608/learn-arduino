import { t, type StringKey } from '../i18n/en';
import type { PinRef } from './types';

// A connection point in words: "UNO D13", "Hole 12c", "Top + rail 9", "LED 1 › anode".
export function pinLabel(ref: PinRef): string {
  const [part, pin] = [ref.slice(0, ref.indexOf('.')), ref.slice(ref.indexOf('.') + 1)];
  if (part === 'uno') return `UNO ${pin}`;
  if (part !== 'bb') { const type = part.replace(/\d+$/, ''); return `${t(`build.part.${type}` as StringKey)} ${part.slice(type.length)} › ${pin}`; } // a module's pin
  const rail = pin.match(/^([TB][+-])(\d+)$/);
  if (rail) return `${t(`build.wiring.rail.${rail[1]}` as StringKey)} ${rail[2]}`;
  return `Hole ${pin}`;
}
