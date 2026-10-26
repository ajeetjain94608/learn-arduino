import { COMPONENTS } from './components';
import type { Icon, ProjectInfo, Rich } from './en/projects';
import type { Project } from './projects';
import { pinLabel } from '../circuit/pointLabel';
import type { PinRef } from '../circuit/types';

const PWM = new Set([3, 5, 6, 9, 10, 11]);

// What a wire is for, from the points it joins.
export function wireMeaning(from: PinRef, to: PinRef): string {
  const pins = [from, to].filter((r) => r.startsWith('uno.')).map((r) => r.slice(4));
  const bus = [from, to].find((r) => /\.(SDA|SCL)$/.test(r));
  if (bus) return bus.endsWith('SDA') ? 'I²C data: the screen and the UNO talk over this wire.' : 'I²C clock: keeps the two in step.';
  if (pins.includes('GND')) return 'Ground: current returns to the board here.';
  if (pins.includes('5V')) return 'Power: 5 V from the board.';
  if (pins.includes('3V3')) return 'Power: 3.3 V from the board.';
  const analog = pins.find((p) => /^A[0-5]$/.test(p));
  if (analog) return 'Analog input: reads 0–5 V as a number from 0 to 1023.';
  const digital = pins.find((p) => /^D\d+$/.test(p));
  if (digital) return PWM.has(Number(digital.slice(1))) ? 'Digital pin with PWM: the sketch switches it, or dims with analogWrite().' : 'Digital pin: the sketch switches it or reads it.';
  return 'Connects the two points.';
}

const ICONS: Icon[] = ['chip', 'bolt', 'output', 'resistor', 'serial', 'community'];
const side = (r: PinRef) => (r.startsWith('uno.') ? 0 : 1); // the UNO's end first

// The four tabs of Home's info card for a project, from the project's own data (its text, its wires, its parts).
export function buildProjectInfo(project: Project): ProjectInfo {
  const types = [...new Set(project.build.parts.map((p) => p.type))];
  const specs = types.flatMap((ty) => COMPONENTS[ty].specs.slice(0, 2).map((s) => ({ label: `${COMPONENTS[ty].name} · ${s.label}`, value: s.value })));
  return {
    title: project.title,
    overview: { text: project.about, points: project.learn.map((text, i): { icon: Icon; text: Rich } => ({ icon: ICONS[i % ICONS.length], text: [text] })) },
    pinout: {
      subtitle: 'How this circuit is wired.',
      rows: project.build.wires.map((w) => {
        const [a, b] = side(w.from) <= side(w.to) ? [w.from, w.to] : [w.to, w.from];
        return { pin: pinLabel(a), color: w.color, to: pinLabel(b), does: wireMeaning(w.from, w.to) };
      }),
    },
    example: project.tryIt.map((s): Rich => [s]),
    specs: specs.length ? specs : [{ label: 'Board', value: 'UNO R3, ATmega328P' }],
  };
}
