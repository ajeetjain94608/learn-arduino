import { useMemo, useState, type ReactNode } from 'react';
import { UNO_PINS } from '../../circuit/board';
import { PART_DEFS } from '../../circuit/parts';
import { jumperPoint, schematicNets } from '../../circuit/schematic';
import type { PartInstance, PinRef } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { useBuild, useBuildApi } from '../../state/buildContext';

// The wiring as a schematic, the way a PCB tool draws it: a symbol for every part (resistor, LED, switch, transistor…), the UNO as a
// block with its pins, and net labels instead of crossing lines — pins with the same label are connected. Press a pin, then another,
// and a jumper joins them (in a free hole of the leg's strip when the part is in a breadboard).

type Term = { pin: string; x: number; y: number; dx: number; dy: number };      // a pin's end: where it is, and which way its lead runs out
type Symbol = { h: number; body: ReactNode; terms: Term[] };
const W = 170, LINE = 'currentColor';
const lead = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} />;
const L = (pin: string, y = 40, x = 25): Term => ({ pin, x, y, dx: -1, dy: 0 });
const R = (pin: string, y = 40, x = 145): Term => ({ pin, x, y, dx: 1, dy: 0 });
const twoPin = (a: string, b: string): Term[] => [L(a), R(b)];
const arrows = (x: number, y: number) => <path d={`M${x} ${y}l8 -8m-5 0h5v5M${x + 9} ${y + 4}l8 -8m-5 0h5v5`} fill="none" />;

// IC box: any part without a symbol of its own — pins down the two sides, named inside
function box(pins: string[]): Symbol {
  const left = pins.slice(0, Math.ceil(pins.length / 2)), right = pins.slice(left.length), rows = left.length, h = 24 + rows * 18 + 16;
  return {
    h,
    body: (
      <>
        <rect x={50} y={22} width={70} height={rows * 18 + 8} rx={2} fill="none" />
        {left.map((p, i) => <g key={p}>{lead(25, 36 + i * 18, 50, 36 + i * 18)}<text x={53} y={39 + i * 18} className="schem__pin">{p}</text></g>)}
        {right.map((p, i) => <g key={p}>{lead(120, 36 + i * 18, 145, 36 + i * 18)}<text x={117} y={39 + i * 18} textAnchor="end" className="schem__pin">{p}</text></g>)}
      </>
    ),
    terms: [...left.map((p, i) => L(p, 36 + i * 18)), ...right.map((p, i) => R(p, 36 + i * 18))],
  };
}

function symbolOf(p: PartInstance): Symbol {
  switch (p.type) {
    case 'resistor': return { h: 76, body: <>{lead(25, 40, 55, 40)}<rect x={55} y={32} width={60} height={16} fill="none" />{lead(115, 40, 145, 40)}</>, terms: twoPin('1', '2') };
    case 'ldr': return { h: 76, body: <>{lead(25, 40, 55, 40)}<rect x={55} y={32} width={60} height={16} fill="none" />{lead(115, 40, 145, 40)}{arrows(60, 28)}</>, terms: twoPin('1', '2') };
    case 'fsr': return { h: 76, body: <>{lead(25, 40, 55, 40)}<rect x={55} y={32} width={60} height={16} fill="none" />{lead(115, 40, 145, 40)}{lead(70, 56, 100, 24)}</>, terms: twoPin('1', '2') };
    case 'led': return { h: 76, body: <>{lead(25, 40, 70, 40)}<path d="M70 28V52L100 40Z" fill="none" />{lead(100, 28, 100, 52)}{lead(100, 40, 145, 40)}{arrows(76, 24)}</>, terms: twoPin('A', 'K') };
    case 'diode': return { h: 76, body: <>{lead(25, 40, 70, 40)}<path d="M70 28V52L100 40Z" fill="none" />{lead(100, 28, 100, 52)}{lead(100, 40, 145, 40)}</>, terms: twoPin('A', 'K') };
    case 'buzzer': return { h: 76, body: <>{lead(25, 40, 67, 40)}<circle cx={85} cy={40} r={18} fill="none" />{lead(103, 40, 145, 40)}<text x={70} y={37} className="schem__pin">+</text></>, terms: twoPin('+', '-') };
    case 'motor': return { h: 76, body: <>{lead(25, 40, 67, 40)}<circle cx={85} cy={40} r={18} fill="none" />{lead(103, 40, 145, 40)}<text x={80} y={44} className="schem__pin">M</text></>, terms: twoPin('+', '-') };
    case 'button': return {
      h: 76,
      body: <>{lead(25, 32, 40, 32)}{lead(25, 48, 40, 48)}{lead(40, 32, 40, 48)}{lead(130, 32, 130, 48)}{lead(130, 32, 145, 32)}{lead(130, 48, 145, 48)}{lead(40, 40, 70, 40)}{lead(70, 40, 98, 28)}{lead(100, 40, 130, 40)}</>,
      terms: [L('1', 32), L('3', 48), R('2', 32), R('4', 48)],
    };
    case 'pot': return {
      h: 100,
      body: <>{lead(25, 40, 55, 40)}<rect x={55} y={32} width={60} height={16} fill="none" />{lead(115, 40, 145, 40)}{lead(85, 80, 85, 56)}<path d="M81 62l4 -6l4 6" fill="none" /></>,
      terms: [L('1'), R('2'), { pin: 'W', x: 85, y: 80, dx: 0, dy: 1 }],
    };
    case 'npn': return {
      h: 100,
      body: <>{lead(25, 48, 72, 48)}{lead(72, 34, 72, 62)}{lead(72, 41, 100, 26)}{lead(100, 26, 100, 8)}{lead(72, 55, 100, 70)}{lead(100, 70, 100, 88)}<circle cx={88} cy={48} r={26} fill="none" /><path d="M92 66l8 4l-2 -9" fill="none" /></>,
      terms: [L('B', 48), { pin: 'C', x: 100, y: 8, dx: 0, dy: -1 }, { pin: 'E', x: 100, y: 88, dx: 0, dy: 1 }],
    };
    default: return box(PART_DEFS[p.type].pins);
  }
}

const UNO_LEFT = Array.from({ length: 14 }, (_, i) => `D${i}`);
const UNO_RIGHT = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', '5V', '3V3', 'VIN', 'GND', 'AREF'].filter((p) => UNO_PINS.includes(p));
const partName = (p: PartInstance) => `${t(`build.part.${p.type}` as StringKey)} ${p.id.slice(p.type.length)}`.trim();

type Pick = { ref: PinRef; part?: PartInstance; pin: string; label: string };

export function Schematic() {
  const parts = useBuild((s) => s.parts);
  const wires = useBuild((s) => s.wires);
  const addWire = useBuild((s) => s.addWire);
  const api = useBuildApi();
  const [from, setFrom] = useState<Pick | null>(null);
  const shown = useMemo(() => parts.filter((p) => p.type !== 'breadboard'), [parts]);
  const refs = useMemo(() => [...UNO_PINS.map((p) => `uno.${p}`), ...shown.flatMap((p) => PART_DEFS[p.type].pins.map((pin) => `${p.id}.${pin}`))], [shown]);
  const nets = useMemo(() => schematicNets({ parts, wires }, refs), [parts, wires, refs]);
  const same = (r: PinRef) => !!from && nets.netOf(r) === nets.netOf(from.ref);

  const choose = (pick: Pick) => {
    if (!from) { setFrom(pick); return; }
    if (from.ref === pick.ref) { setFrom(null); return; }
    const used = api.getState().usedPins();
    const point = (x: Pick) => (x.part ? jumperPoint(x.part, x.pin, used) : x.ref);
    const a = point(from), b = point(pick);
    if (a && b) { if (addWire(a, b)) setFrom(null); }
    else api.setState({ message: t('build.msg.noRoom') });
  };

  // one drawn pin: its dot, its net label (or its name when it is on no net), and a button over it
  const pinMark = (label: string, ref: PinRef, x: number, y: number, dx: number, dy: number, pick: Pick) => {
    const net = nets.nameOf(ref), color = nets.colorOf(ref) ?? 'var(--ink-2)';
    const lx = x + dx * 4 + (dy ? 0 : 0), ly = y + dy * 9 + (dy ? 0 : 3);
    const anchor = dx < 0 ? 'end' : dx > 0 ? 'start' : 'middle';
    return (
      <g key={ref} className={`schem__term${from?.ref === ref ? ' is-from' : same(ref) ? ' is-net' : ''}`}>
        <circle cx={x} cy={y} r={2.4} fill={net ? color : 'none'} stroke={color} />
        <text x={lx} y={ly} textAnchor={anchor} className={net ? 'schem__net' : 'schem__free'} style={net ? { fill: color } : undefined}>{net ?? label}</text>
        <circle cx={x} cy={y} r={13} className="schem__hit" role="button" tabIndex={0} data-ref={ref}
          aria-label={`${pick.part ? partName(pick.part) : 'UNO'} ${label}${net ? ` — ${net}` : ''}`}
          aria-pressed={from?.ref === ref} onClick={() => choose(pick)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(pick); } }} />
      </g>
    );
  };

  const unoRows = Math.max(UNO_LEFT.length, UNO_RIGHT.length), unoH = 40 + unoRows * 18;
  return (
    <div className="schem" data-testid="schematic">
      <p className="build-note">{from ? t('build.schem.second').replace('{pin}', from.label) : t('build.schem.first')}</p>
      <figure className="schem__card">
        <figcaption>{t('build.uno')}</figcaption>
        <svg viewBox={`0 0 ${W + 20} ${unoH}`} role="group" aria-label={t('build.uno')} stroke={LINE} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <rect x={65} y={22} width={70} height={unoRows * 18 + 8} rx={3} />
          <text x={100} y={unoH - 4} textAnchor="middle" className="schem__pin">UNO</text>
          {UNO_LEFT.map((p, i) => <g key={p}>{lead(40, 36 + i * 18, 65, 36 + i * 18)}<text x={68} y={39 + i * 18} className="schem__pin">{p}</text></g>)}
          {UNO_RIGHT.map((p, i) => <g key={p}>{lead(135, 36 + i * 18, 160, 36 + i * 18)}<text x={132} y={39 + i * 18} textAnchor="end" className="schem__pin">{p}</text></g>)}
          {UNO_LEFT.map((p, i) => pinMark(p, `uno.${p}`, 40, 36 + i * 18, -1, 0, { ref: `uno.${p}`, pin: p, label: `UNO ${p}` }))}
          {UNO_RIGHT.map((p, i) => pinMark(p, `uno.${p}`, 160, 36 + i * 18, 1, 0, { ref: `uno.${p}`, pin: p, label: `UNO ${p}` }))}
        </svg>
      </figure>
      {shown.map((p) => {
        const s = symbolOf(p);
        return (
          <figure key={p.id} className="schem__card">
            <figcaption>{partName(p)}</figcaption>
            <svg viewBox={`0 0 ${W} ${s.h}`} role="group" aria-label={partName(p)} stroke={LINE} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
              {s.body}
              {s.terms.map((tm) => pinMark(tm.pin, `${p.id}.${tm.pin}`, tm.x, tm.y, tm.dx, tm.dy, { ref: `${p.id}.${tm.pin}`, part: p, pin: tm.pin, label: `${partName(p)} ${tm.pin}` }))}
            </svg>
          </figure>
        );
      })}
      {shown.length === 0 && <p className="build-note">{t('build.schem.empty')}</p>}
    </div>
  );
}
