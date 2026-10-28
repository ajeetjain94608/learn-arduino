import { useMemo, useState } from 'react';
import { BB_HOLES, UNO_PINS } from '../../circuit/board';
import { partPoints } from '../../circuit/parts';
import type { PartInstance, PinRef } from '../../circuit/types';
import { t } from '../../i18n/en';
import { pinLabel } from '../../circuit/pointLabel';

export { pinLabel };
import { useBuild, useBuildApi } from '../../state/buildContext';

const COLORS: { value: string; name: string }[] = [
  { value: '#F28C16', name: 'Orange' }, { value: '#2563EB', name: 'Blue' }, { value: '#10B981', name: 'Green' },
  { value: '#E2483D', name: 'Red' }, { value: '#8B5CF6', name: 'Purple' }, { value: '#2B2F38', name: 'Black' },
];

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
      {parts.filter((p) => p.type === 'breadboard').flatMap((b) => {
        const name = b.id === 'bb' ? '' : `Board ${b.id.slice(10)} · `;
        return [
          ...HOLE_COLS.map((c) => <optgroup key={`${b.id}${c}`} label={name + t('build.wiring.col').replace('{n}', String(c))}>{strip(c).map((h) => opt(`${b.id}.${h}`))}</optgroup>),
          <optgroup key={`${b.id}r`} label={name + t('build.wiring.rails')}>{rails.map((h) => opt(`${b.id}.${h}`))}</optgroup>,
        ];
      })}
    </select>
  );
}

// Wiring tab: the list of connections (recolour, delete) and a From → To row to add one.
export function WiringTable() {
  const wires = useBuild((s) => s.wires);
  const selected = useBuild((s) => s.selected);
  const addWire = useBuild((s) => s.addWire);
  const removeWire = useBuild((s) => s.removeWire);
  const setWireColor = useBuild((s) => s.setWireColor);
  const select = useBuild((s) => s.select);
  const parts = useBuild((s) => s.parts);
  const api = useBuildApi();
  const used = useMemo(() => api.getState().usedPins(), [api, parts, wires]); // in-use marks follow the parts and wires
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
