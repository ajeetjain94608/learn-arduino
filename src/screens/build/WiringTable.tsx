import { useMemo, useState } from 'react';
import { BB_HOLES, UNO_PINS } from '../../circuit/board';
import { partPoints } from '../../circuit/parts';
import type { PartInstance, PinRef } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { useBuildStore } from '../../state/buildStore';

const COLORS: { value: string; name: string }[] = [
  { value: '#F28C16', name: 'Orange' }, { value: '#2563EB', name: 'Blue' }, { value: '#10B981', name: 'Green' },
  { value: '#E2483D', name: 'Red' }, { value: '#8B5CF6', name: 'Purple' }, { value: '#2B2F38', name: 'Black' },
];

// A connection point in words: "UNO D13", "Hole 12c", "Top + rail, column 9".
export function pinLabel(ref: PinRef): string {
  const [part, pin] = [ref.slice(0, ref.indexOf('.')), ref.slice(ref.indexOf('.') + 1)];
  if (part === 'uno') return `UNO ${pin}`;
  if (part !== 'bb') { const type = part.replace(/\d+$/, ''); return `${t(`build.part.${type}` as StringKey)} ${part.slice(type.length)} › ${pin}`; } // a module's pin
  const rail = pin.match(/^([TB][+-])(\d+)$/);
  if (rail) return `${t(`build.wiring.rail.${rail[1]}` as StringKey)} ${rail[2]}`;
  return `Hole ${pin}`;
}

const HOLE_COLS = Array.from({ length: 30 }, (_, i) => i + 1);
const strip = (col: number) => BB_HOLES.filter((h) => h.match(/^(\d+)[a-j]$/)?.[1] === String(col));
const rails = BB_HOLES.filter((h) => /^[TB][+-]\d+$/.test(h));

// The From / To pickers: UNO pins, then the breadboard column by column, then the rails. Used points say so.
function PointSelect({ label, value, onChange, used, parts }: { label: string; value: string; onChange(v: string): void; used: Set<PinRef>; parts: PartInstance[] }) {
  const opt = (ref: PinRef) => <option key={ref} value={ref}>{pinLabel(ref)}{used.has(ref) ? ` ${t('build.wiring.inUse')}` : ''}</option>;
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('build.wiring.choose')}</option>
      <optgroup label={t('build.wiring.uno')}>{UNO_PINS.map((p) => opt(`uno.${p}`))}</optgroup>
      {parts.filter((p) => partPoints(p).length).map((p) => (
        <optgroup key={p.id} label={t('build.wiring.module').replace('{name}', pinLabel(`${p.id}.x`).split(' › ')[0])}>{partPoints(p).map(opt)}</optgroup>
      ))}
      {HOLE_COLS.map((c) => <optgroup key={c} label={t('build.wiring.col').replace('{n}', String(c))}>{strip(c).map((h) => opt(`bb.${h}`))}</optgroup>)}
      <optgroup label={t('build.wiring.rails')}>{rails.map((h) => opt(`bb.${h}`))}</optgroup>
    </select>
  );
}

// Wiring tab: the list of connections (recolour, delete) and a From → To row to add one.
export function WiringTable() {
  const wires = useBuildStore((s) => s.wires);
  const selected = useBuildStore((s) => s.selected);
  const addWire = useBuildStore((s) => s.addWire);
  const removeWire = useBuildStore((s) => s.removeWire);
  const setWireColor = useBuildStore((s) => s.setWireColor);
  const select = useBuildStore((s) => s.select);
  const parts = useBuildStore((s) => s.parts);
  const used = useMemo(() => useBuildStore.getState().usedPins(), [parts, wires]); // in-use marks follow the parts and wires
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const connect = () => { if (from && to && addWire(from, to)) { setFrom(''); setTo(''); } };
  return (
    <div className="wiring">
      <div className="wiring__new">
        <PointSelect label={t('build.wiring.from')} value={from} onChange={setFrom} used={used} parts={parts} />
        <span aria-hidden>→</span>
        <PointSelect label={t('build.wiring.to')} value={to} onChange={setTo} used={used} parts={parts} />
        <button type="button" className="wiring__connect" disabled={!from || !to} onClick={connect}>{t('build.wiring.connect')}</button>
      </div>
      {wires.length === 0 ? <p className="build-note">{t('build.wiring.none')}</p> : (
        <ul className="wiring__list" aria-label={t('build.wiring.list')}>
          {wires.map((w) => (
            <li key={w.id} className={selected === w.id ? 'is-selected' : ''}>
              <button type="button" className="wiring__name" onClick={() => select(w.id)}>
                <i style={{ background: w.color }} aria-hidden />{pinLabel(w.from)} → {pinLabel(w.to)}
              </button>
              <select aria-label={t('build.wiring.color')} value={w.color} onChange={(e) => setWireColor(w.id, e.target.value)}>
                {COLORS.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
              </select>
              <button type="button" className="wiring__delete" aria-label={t('build.wiring.delete')} onClick={() => removeWire(w.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
