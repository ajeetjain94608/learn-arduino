// The schematic symbols (standard shapes: resistor, LED, switch, transistor…), the UNO's full symbol, and the names on a sheet:
// designators (R1, LED1, SW1, Q1, U2…) and values (220Ω, Red, 10kΩ…), the way a schematic in an EDA tool labels its parts.
import type { ReactNode } from 'react';
import { PART_DEFS, paramsOf } from '../../circuit/parts';
import type { PartInstance, PartType } from '../../circuit/types';
import type { Sym, SymTerm } from './schematicSheet';

const lead = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} />;
const L = (pin: string, y = 40, x = 20): SymTerm => ({ pin, x, y, dx: -1, dy: 0 });
const R = (pin: string, y = 40, x = 140): SymTerm => ({ pin, x, y, dx: 1, dy: 0 });
const arrows = (x: number, y: number) => <path d={`M${x} ${y}l8 -8m-5 0h5v5M${x + 9} ${y + 4}l8 -8m-5 0h5v5`} fill="none" />;
const W = 160;

// a module without a symbol of its own: a box with its pins down the left, named inside
function box(pins: string[]): Sym & { body: ReactNode } {
  const GAP = 20, top = 30, h = top + pins.length * GAP;
  return {
    w: W, h,
    body: (
      <>
        <rect x={40} y={top - 14} width={90} height={pins.length * GAP + 8} fill="none" />
        {pins.map((p, i) => <g key={p}>{lead(20, top + i * GAP, 40, top + i * GAP)}<text x={45} y={top + 4 + i * GAP} className="schem__pinname">{p}</text></g>)}
      </>
    ),
    terms: pins.map((p, i) => L(p, top + i * GAP)),
  };
}

export function symbolOf(type: PartType): Sym & { body: ReactNode } {
  switch (type) {
    case 'resistor': return { w: W, h: 80, body: <>{lead(20, 40, 50, 40)}<rect x={50} y={32} width={60} height={16} fill="none" />{lead(110, 40, 140, 40)}</>, terms: [L('1'), R('2')] };
    case 'ldr': return { w: W, h: 80, body: <>{lead(20, 40, 50, 40)}<rect x={50} y={32} width={60} height={16} fill="none" />{lead(110, 40, 140, 40)}{arrows(55, 26)}</>, terms: [L('1'), R('2')] };
    case 'fsr': return { w: W, h: 80, body: <>{lead(20, 40, 50, 40)}<rect x={50} y={32} width={60} height={16} fill="none" />{lead(110, 40, 140, 40)}{lead(65, 56, 95, 24)}</>, terms: [L('1'), R('2')] };
    case 'led': return { w: W, h: 80, body: <>{lead(20, 40, 65, 40)}<path d="M65 28V52L95 40Z" fill="none" />{lead(95, 28, 95, 52)}{lead(95, 40, 140, 40)}{arrows(72, 24)}</>, terms: [L('A'), R('K')] };
    case 'diode': return { w: W, h: 80, body: <>{lead(20, 40, 65, 40)}<path d="M65 28V52L95 40Z" fill="none" />{lead(95, 28, 95, 52)}{lead(95, 40, 140, 40)}</>, terms: [L('A'), R('K')] };
    case 'buzzer': return { w: W, h: 80, body: <>{lead(20, 40, 62, 40)}<circle cx={80} cy={40} r={18} fill="none" />{lead(98, 40, 140, 40)}<text x={66} y={36} className="schem__pinname">+</text></>, terms: [L('+'), R('-')] };
    case 'motor': return { w: W, h: 80, body: <>{lead(20, 40, 62, 40)}<circle cx={80} cy={40} r={18} fill="none" />{lead(98, 40, 140, 40)}<text x={74} y={45} className="schem__sym">M</text></>, terms: [L('+'), R('-')] };
    case 'button': return {
      w: W, h: 80, // a push switch: legs 1 and 3 are one contact inside the button, 2 and 4 the other
      body: <>{lead(20, 40, 57, 40)}<circle cx={60} cy={40} r={3} />{lead(63, 38, 95, 26)}<circle cx={100} cy={40} r={3} />{lead(103, 40, 140, 40)}{lead(79, 32, 79, 22)}{lead(71, 22, 87, 22)}</>,
      terms: [L('1'), L('3'), R('2'), R('4')],
    };
    case 'pot': return {
      w: W, h: 100,
      body: <>{lead(20, 40, 50, 40)}<rect x={50} y={32} width={60} height={16} fill="none" />{lead(110, 40, 140, 40)}{lead(80, 80, 80, 56)}<path d="M76 62l4 -6l4 6" fill="none" /></>,
      terms: [L('1'), R('2'), { pin: 'W', x: 80, y: 80, dx: 0, dy: 1 }],
    };
    case 'npn': return {
      w: W, h: 100,
      body: <>{lead(20, 50, 67, 50)}{lead(67, 36, 67, 64)}{lead(67, 43, 95, 28)}{lead(95, 28, 95, 10)}{lead(67, 57, 95, 72)}{lead(95, 72, 95, 90)}<circle cx={83} cy={50} r={26} fill="none" /><path d="M87 68l8 4l-2 -9" fill="none" /></>,
      terms: [L('B', 50), { pin: 'C', x: 95, y: 10, dx: 0, dy: -1 }, { pin: 'E', x: 95, y: 90, dx: 0, dy: 1 }],
    };
    default: return box(PART_DEFS[type].pins);
  }
}

// the UNO: every pin it has, power and analog down the left, digital down the right (~ marks a PWM pin)
export const UNO_LEFT = ['VIN', '5V', '3V3', 'AREF', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
export const UNO_RIGHT = Array.from({ length: 14 }, (_, i) => `D${i}`);
const PWM = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11']);
const PITCH = 20, TOP = 40;
export function unoSymbol(): Sym & { body: ReactNode } {
  const h = TOP + UNO_RIGHT.length * PITCH;
  return {
    w: 160, h,
    body: (
      <>
        <rect x={30} y={10} width={100} height={h - 10} fill="none" />
        {UNO_LEFT.map((p, i) => <g key={p}>{lead(10, TOP + i * PITCH, 30, TOP + i * PITCH)}<text x={34} y={TOP + 4 + i * PITCH} className="schem__pinname">{p}</text></g>)}
        {UNO_RIGHT.map((p, i) => <g key={p}>{lead(130, TOP + i * PITCH, 150, TOP + i * PITCH)}<text x={126} y={TOP + 4 + i * PITCH} textAnchor="end" className="schem__pinname">{PWM.has(p) ? `~${p}` : p}</text></g>)}
      </>
    ),
    terms: [...UNO_LEFT.map((p, i) => ({ pin: p, x: 10, y: TOP + i * PITCH, dx: -1, dy: 0 })), ...UNO_RIGHT.map((p, i) => ({ pin: p, x: 150, y: TOP + i * PITCH, dx: 1, dy: 0 }))],
  };
}

// designators, as an EDA tool numbers them
const PREFIX: Partial<Record<PartType, string>> = { resistor: 'R', led: 'LED', rgb: 'LED', button: 'SW', pot: 'RV', diode: 'D', npn: 'Q', buzzer: 'BZ', ldr: 'LDR', fsr: 'FSR', motor: 'M', servo: 'M', stepper: 'M' };
export function designators(parts: PartInstance[]): Map<string, string> {
  const n = new Map<string, number>([['U', 1]]); // U1 is the UNO
  const out = new Map<string, string>([['uno', 'U1']]);
  for (const p of parts) { const pre = PREFIX[p.type] ?? 'U'; const k = (n.get(pre) ?? 0) + 1; n.set(pre, k); out.set(p.id, `${pre}${k}`); }
  return out;
}
const VALUE: Partial<Record<PartType, string>> = { pot: '10kΩ', diode: '1N4007', npn: 'TIP120', rgb: 'RGB', buzzer: 'Buzzer', ldr: 'LDR', tmp36: 'TMP36', fsr: 'FSR', traffic: 'Traffic light', motor: 'DC motor', servo: 'SG90 servo', stepper: '28BYJ-48', oled: 'SSD1306 OLED', hcsr04: 'HC-SR04', soil: 'Soil sensor', button: 'Push button' };
export function valueOf(p: PartInstance): string {
  const params = paramsOf(p.type, p.params);
  if (p.type === 'resistor') { const o = Number(params.ohms); return o >= 1000 ? `${o / 1000}kΩ` : `${o}Ω`; }
  if (p.type === 'led') { const c = String(params.color ?? 'red'); return `${c[0].toUpperCase()}${c.slice(1)}`; }
  return VALUE[p.type] ?? p.type;
}
