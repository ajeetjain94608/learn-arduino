import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UNO_PINS } from '../../circuit/board';
import { PART_DEFS } from '../../circuit/parts';
import { jumperPoint, schematicNets } from '../../circuit/schematic';
import type { PartInstance, PinRef } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { useBuild, useBuildApi } from '../../state/buildContext';
import { layoutSchematic, type Shape } from './schematicLayout';

// The wiring as a real schematic: the UNO as a block with its pins in use, a standard symbol for every part (resistor, LED, switch,
// transistor…), joined by drawn wires, with a ground symbol on every pin on GND and a supply flag on every pin on a supply. Press a
// pin, then another, and a jumper joins them (in a free hole of the leg's strip when the part is in a breadboard).

type Term = { pin: string; x: number; y: number; dx: number; dy: number };      // a pin's end: where it is, and which way its lead runs out
type Symbol = { h: number; body: ReactNode; terms: Term[] };
const W = 170, LINE = 'currentColor';
const lead = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} />;
const L = (pin: string, y = 40, x = 25): Term => ({ pin, x, y, dx: -1, dy: 0 });
const R = (pin: string, y = 40, x = 145): Term => ({ pin, x, y, dx: 1, dy: 0 });
const twoPin = (a: string, b: string): Term[] => [L(a), R(b)];
const arrows = (x: number, y: number) => <path d={`M${x} ${y}l8 -8m-5 0h5v5M${x + 9} ${y + 4}l8 -8m-5 0h5v5`} fill="none" />;


// IC box: any part without a symbol of its own (a module) — its pins down the left side, named inside, facing the UNO; far enough
// apart for a ground or supply symbol on each
function box(pins: string[]): Symbol {
  const GAP = 28, top = 34, h = top + pins.length * GAP;
  return {
    h,
    body: (
      <>
        <rect x={50} y={top - 16} width={80} height={pins.length * GAP + 4} rx={2} fill="none" />
        {pins.map((p, i) => <g key={p}>{lead(25, top + i * GAP, 50, top + i * GAP)}<text x={54} y={top + 4 + i * GAP} className="schem__pin">{p}</text></g>)}
      </>
    ),
    terms: pins.map((p, i) => L(p, top + i * GAP)),
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
      // a push switch: two contacts and the lever (legs 1 and 3 are one side inside the button, 2 and 4 the other)
      body: <>{lead(25, 40, 62, 40)}<circle cx={65} cy={40} r={3} />{lead(68, 38, 100, 26)}<circle cx={105} cy={40} r={3} />{lead(108, 40, 145, 40)}{lead(84, 32, 84, 22)}{lead(76, 22, 92, 22)}</>,
      terms: [L('1'), L('3'), R('2'), R('4')],
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

const partName = (p: PartInstance) => `${t(`build.part.${p.type}` as StringKey)} ${p.id.slice(p.type.length)}`.trim();
const FLIPPABLE = new Set(['resistor', 'ldr', 'fsr', 'led', 'diode', 'buzzer', 'motor', 'button']); // two-sided parts may face either way
// parts whose pins are named inside their box (modules): no names outside; the push button's second legs share the first ones' ends
const NAMED_INSIDE = (type: string) => !['resistor', 'ldr', 'fsr', 'led', 'diode', 'buzzer', 'motor', 'button', 'pot', 'npn'].includes(type);
const HIDDEN_NAME = new Set(['button.3', 'button.4']);
const shapeOf = (type: string): Shape => {
  const s = symbolOf({ id: 'x', type: type as PartInstance['type'], params: {}, at: { x: 0, z: 0 } });
  return { w: W, h: s.h, terms: s.terms, flippable: FLIPPABLE.has(type), through: !NAMED_INSIDE(type) };
};

type Pick = { ref: PinRef; part?: PartInstance; pin: string; label: string };

// a ground symbol (three shrinking bars) or a supply flag (a bar with its voltage) at the end of a pin's lead
function PowerFlag({ x, y, kind, label, side }: { x: number; y: number; kind: 'gnd' | 'supply'; label: string; side: number }) {
  if (side) { // sideways, pointing away from a module's pin
    const e = x + side * 8;
    if (kind === 'gnd') return <path className="schem__gnd" d={`M${x} ${y}H${e}M${e} ${y - 9}v18M${e + side * 4} ${y - 6}v12M${e + side * 8} ${y - 3}v6`} />;
    return <g className="schem__vcc"><path d={`M${x} ${y}H${e}M${e} ${y - 7}v14`} /><text x={e + side * 4} y={y + 4} textAnchor={side < 0 ? 'end' : 'start'} className="schem__net">{label}</text></g>;
  }
  if (kind === 'gnd') return <path className="schem__gnd" d={`M${x} ${y}V${y + 10}M${x - 9} ${y + 10}h18M${x - 6} ${y + 14}h12M${x - 3} ${y + 18}h6`} />;
  return <g className="schem__vcc"><path d={`M${x} ${y}V${y - 10}M${x - 8} ${y - 10}h16`} /><text x={x} y={y - 14} textAnchor="middle" className="schem__net">{label}</text></g>;
}

export function Schematic() {
  const parts = useBuild((s) => s.parts);
  const wires = useBuild((s) => s.wires);
  const addWire = useBuild((s) => s.addWire);
  const api = useBuildApi();
  const [from, setFrom] = useState<Pick | null>(null);
  // zoom: 1 = the drawing's own size; it starts fitted to the panel's width (never smaller than 60 %)
  const sheet = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState<number | null>(null); // null: fit the panel
  useEffect(() => {
    const el = sheet.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shown = useMemo(() => parts.filter((p) => p.type !== 'breadboard'), [parts]);
  const refs = useMemo(() => [...UNO_PINS.map((p) => `uno.${p}`), ...shown.flatMap((p) => PART_DEFS[p.type].pins.map((pin) => `${p.id}.${pin}`))], [shown]);
  const nets = useMemo(() => schematicNets({ parts, wires }, refs), [parts, wires, refs]);
  const lay = useMemo(() => layoutSchematic(shown.map((p) => ({ id: p.id, type: p.type, pins: PART_DEFS[p.type].pins })), shapeOf, nets), [shown, nets]);
  const fit = width ? Math.max(0.6, Math.min(1.4, (width - 2) / lay.width)) : 1;
  const zoom = scale ?? fit;
  const setZoom = (f: (z: number) => number) => setScale(f(zoom));
  const same = (r: PinRef) => !!from && nets.netOf(r) === nets.netOf(from.ref);
  const byId = new Map(shown.map((p) => [p.id, p]));

  const choose = (pick: Pick) => {
    if (!from) { setFrom(pick); return; }
    if (from.ref === pick.ref) { setFrom(null); return; }
    const used = api.getState().usedPins();
    const point = (x: Pick) => (x.part ? jumperPoint(x.part, x.pin, used) : x.ref);
    const a = point(from), b = point(pick);
    if (a && b) { if (addWire(a, b)) setFrom(null); }
    else api.setState({ message: t('build.msg.noRoom') });
  };

  // the UNO's unused pins are not drawn, so a pin can be picked from a short list under the drawing
  const unused = UNO_PINS.filter((p) => !p.startsWith('GND_P') && !lay.uno.pins.some((u) => u.pin === p));
  return (
    <div className="schem" data-testid="schematic">
      <div className="schem__bar">
        <p className="build-note">{from ? t('build.schem.second').replace('{pin}', from.label) : t('build.schem.first')}</p>
        <div className="schem__zoom">
          <button type="button" aria-label={t('viewer.zoomOut')} onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}>−</button>
          <button type="button" aria-label={t('viewer.zoomIn')} onClick={() => setZoom((z) => Math.min(3, z * 1.25))}>+</button>
        </div>
      </div>
      {shown.length === 0 && <p className="build-note">{t('build.schem.empty')}</p>}
      <div className="schem__sheet" ref={sheet}>
        <svg viewBox={`0 0 ${lay.width} ${lay.height}`} width={Math.round(lay.width * zoom)} height={Math.round(lay.height * zoom)} role="group" aria-label={t('build.schem.title')}
          stroke={LINE} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <rect x={lay.uno.x} y={lay.uno.y} width={lay.uno.w} height={lay.uno.h} rx={4} className="schem__chip" />
          <text x={lay.uno.x + lay.uno.w / 2} y={lay.uno.y + 18} textAnchor="middle" className="schem__name">ARDUINO UNO</text>
          {lay.uno.pins.map((u) => (
            <g key={u.pin}>
              {lead(lay.uno.x + lay.uno.w, u.y, lay.uno.x + lay.uno.w + 24, u.y)}
              <text x={lay.uno.x + lay.uno.w - 5} y={u.y + 3} textAnchor="end" className="schem__pin">{u.pin}</text>
            </g>
          ))}
          {/* wires first, so the symbols sit on top */}
          {lay.wires.map((w, i) => <polyline key={i} points={w.path.map((p) => p.join(',')).join(' ')} className="schem__wire" style={w.color ? { stroke: w.color } : undefined} />)}
          {lay.dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.8} className="schem__dot" />)}
          {lay.flags.map((f) => <PowerFlag key={f.ref} {...f} />)}
          {lay.parts.map((pl) => {
            const p = byId.get(pl.id)!, s = symbolOf(p);
            return (
              <g key={pl.id}>
                <g transform={`translate(${pl.x} ${pl.y})${pl.flip ? ` translate(${W} 0) scale(-1 1)` : ''}`}>{s.body}</g>
                <text x={pl.x + W / 2} y={pl.y + 12} textAnchor="middle" className="schem__name">{partName(p)}</text>
              </g>
            );
          })}
          {lay.terminals.map((tm) => {
            const part = tm.ref.startsWith('uno.') ? undefined : byId.get(tm.ref.slice(0, tm.ref.indexOf('.')));
            const pick: Pick = { ref: tm.ref, part, pin: tm.label, label: part ? `${partName(part)} ${tm.label}` : `UNO ${tm.label}` };
            const net = nets.nameOf(tm.ref);
            return (
              <g key={tm.ref} className={`schem__term${from?.ref === tm.ref ? ' is-from' : same(tm.ref) ? ' is-net' : ''}`}>
                <circle cx={tm.x} cy={tm.y} r={2.4} className={net ? 'schem__on' : 'schem__off'} />
                {part && !NAMED_INSIDE(part.type) && !HIDDEN_NAME.has(`${part.type}.${tm.label}`) && <text x={tm.x - tm.dx * 3 + (tm.dy ? 5 : 0)} y={tm.y + (tm.dy ? -tm.dy * 4 : -5)} textAnchor={tm.dx > 0 ? 'end' : 'start'} className="schem__pinname">{tm.label}</text>}
                <circle cx={tm.x} cy={tm.y} r={13} className="schem__hit" role="button" tabIndex={0} data-ref={tm.ref}
                  aria-label={`${pick.label}${net ? ` — ${net}` : ''}`} aria-pressed={from?.ref === tm.ref} onClick={() => choose(pick)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(pick); } }} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="schem__more" role="group" aria-label={t('build.schem.morePins')}>
        <span className="build-note">{t('build.schem.morePins')}</span>
        {unused.map((p) => (
          <button key={p} type="button" data-ref={`uno.${p}`} aria-pressed={from?.ref === `uno.${p}`} className={from?.ref === `uno.${p}` ? 'is-on' : ''}
            onClick={() => choose({ ref: `uno.${p}`, pin: p, label: `UNO ${p}` })}>{p}</button>
        ))}
      </div>
    </div>
  );
}
