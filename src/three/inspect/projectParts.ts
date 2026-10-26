import { COMPONENTS } from '../../content/components';

// The name card for a part of a project (hover and tap), from the component library: "LED — Lights when current flows …".
// Ids are the build's own: led2, hcsr041, servo1, wire-w12, breadboard.
export type PartCard = { name: string; line: string; text: string };

// the first sentence, kept short enough for the small hover card
const oneLine = (s: string) => {
  const first = s.split('. ')[0].replace(/\.$/, '');
  return (first.length > 100 ? `${first.slice(0, 97).trimEnd()}…` : `${first}.`);
};

export function cardOf(id: string): PartCard | null {
  if (id.startsWith('wire-')) {
    return { name: 'Jumper wire', line: 'Carries current from one point to another.', text: 'A jumper wire joins two points: the UNO’s pins, the breadboard’s holes or a module’s pins. Current flows along it only when both ends are connected to something.' };
  }
  // the component whose name starts the id, the rest being the build's own number (hcsr04 + 1, tmp36 + 1, led + 2)
  const type = (Object.keys(COMPONENTS) as (keyof typeof COMPONENTS)[])
    .filter((k) => id.startsWith(k) && /^\d*$/.test(id.slice(k.length)))
    .sort((a, b) => b.length - a.length)[0];
  const c = type ? COMPONENTS[type] : undefined;
  return c ? { name: c.name, line: oneLine(c.overview), text: c.overview } : null;
}
