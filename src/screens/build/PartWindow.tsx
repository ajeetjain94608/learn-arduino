import { useEffect, useRef, useState } from 'react';
import { PART_DEFS, paramsOf, type InputDef } from '../../circuit/parts';
import type { Row } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { useBuildStore } from '../../state/buildStore';
import { commitNumber } from './numberInput';

// How an input is shown: the knob's 0…1 is shown as the 0–1023 reading it gives on A0 with 5 V across it.
const SHOWN: Record<string, { label: StringKey; scale: number }> = {
  position: { label: 'build.input.knob', scale: 1023 },
};
const ohmsLabel = (v: number) => (v >= 1000 ? `${v / 1000} kΩ` : `${v} Ω`);
const ROWS: Row[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const MOVES = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]] as const;

// A slider and a number box for one input, always showing the same value as the 3D part.
function SliderInput({ partId, def }: { partId: string; def: InputDef }) {
  const value = useBuildStore((s) => s.inputs[partId]?.[def.key] ?? def.default);
  const setInput = useBuildStore((s) => s.setInput);
  const shown = SHOWN[def.key] ?? { label: 'build.input.value' as StringKey, scale: 1 };
  const display = Math.round(value * shown.scale * 1000) / 1000;
  const [text, setText] = useState(String(display));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(String(Math.round(value * shown.scale))); }, [value, editing, shown.scale]);
  const commit = () => { setEditing(false); setInput(partId, def.key, commitNumber(text, def.min * shown.scale, def.max * shown.scale, value * shown.scale) / shown.scale); };
  return (
    <div className="part-window__input">
      <label className="part-window__label">{t(shown.label)}</label>
      <input type="range" min={def.min} max={def.max} step={def.step} value={value} aria-label={t(shown.label)}
        onChange={(e) => setInput(partId, def.key, Number(e.target.value))} />
      <input type="number" inputMode="decimal" min={def.min * shown.scale} max={def.max * shown.scale} value={text}
        aria-label={`${t(shown.label)} ${t('build.input.valueSuffix')}`}
        onFocus={() => setEditing(true)} onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }} />
      {def.unit && <span className="part-window__unit">{def.unit}</span>}
    </div>
  );
}

// On/off inputs (a push button): hold to press, or keep it pressed. The switch shows the button as it is, however it
// was pressed (here, in 3D or by the switch).
function PressInput({ partId }: { partId: string }) {
  const pressed = useBuildStore((s) => (s.inputs[partId]?.pressed ?? 0) >= 0.5);
  const setInput = useBuildStore((s) => s.setInput);
  const press = (on: boolean) => setInput(partId, 'pressed', on ? 1 : 0);
  const holding = useRef(false);
  const hold = (on: boolean) => { if (on || holding.current) press(on); holding.current = on; };
  return (
    <div className="part-window__press">
      <button type="button" className={`part-window__hold${pressed ? ' is-on' : ''}`}
        onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') hold(true); }} onKeyUp={() => hold(false)}>{t('build.input.hold')}</button>
      <label className="part-window__keep">
        <input type="checkbox" role="switch" checked={pressed} onChange={(e) => press(e.target.checked)} />
        {t('build.input.keep')}
      </label>
    </div>
  );
}

// The window for the selected part: its options (resistor value, LED colour) and its inputs, three ways in sync with
// the part in 3D. Opens when a part is tapped.
export function PartWindow() {
  const selected = useBuildStore((s) => s.selected);
  const part = useBuildStore((s) => s.parts.find((p) => p.id === s.selected));
  const setParam = useBuildStore((s) => s.setParam);
  const movePart = useBuildStore((s) => s.movePart);
  const canMove = useBuildStore((s) => s.canMove);
  useBuildStore((s) => s.parts); // the arrows' state follows every part (another part may free or take a spot)
  const ref = useRef<HTMLElement>(null);
  // opening the window moves focus into it (keyboard and screen readers follow); Escape closes it
  useEffect(() => { if (selected && part) ref.current?.focus(); }, [selected, !!part]); // eslint-disable-line react-hooks/exhaustive-deps
  const removePart = useBuildStore((s) => s.removePart);
  const select = useBuildStore((s) => s.select);
  if (!selected || !part) return null;
  const def = PART_DEFS[part.type];
  const params = paramsOf(part.type, part.params);
  const name = `${t(`build.part.${part.type}` as StringKey)} ${part.id.slice(part.type.length)}`;
  return (
    <section className="part-window" role="dialog" aria-label={name} data-testid="part-window" ref={ref} tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') select(null); }}>
      <header className="part-window__head">
        <b>{name}</b>
        <button type="button" className="part-window__close" aria-label={t('build.close')} onClick={() => select(null)}>×</button>
      </header>
      <div className="part-window__place">
        <span>{t('build.legs')} <b>{Object.values(def.footprint(part.at, part.params) ?? {}).join(' · ')}</b></span>
        <div className="part-window__moves">
          {MOVES.map(([dir, dc, dr]) => {
            const r = ROWS.indexOf(part.at.row) + dr;
            const to = r >= 0 && r < ROWS.length ? { col: part.at.col + dc, row: ROWS[r] } : null;
            return (
              <button key={dir} type="button" aria-label={t(`build.move.${dir}` as StringKey)} disabled={!to || !canMove(part.id, to)}
                onClick={() => { if (to) movePart(part.id, to); }}>
                {{ left: '◀', right: '▶', up: '▲', down: '▼' }[dir]}
              </button>
            );
          })}
        </div>
      </div>
      {def.params.map((p) => (
        <div key={p.key} className="part-window__param" role="radiogroup" aria-label={t(`build.param.${p.key}` as StringKey)}>
          {p.options.map((o) => (
            <button key={String(o)} type="button" role="radio" aria-checked={params[p.key] === o} className={params[p.key] === o ? 'is-on' : ''}
              onClick={() => setParam(part.id, p.key, o)}>
              {p.key === 'ohms' ? ohmsLabel(Number(o)) : t(`build.color.${o}` as StringKey)}
            </button>
          ))}
        </div>
      ))}
      {def.inputs.map((d) => (d.step >= 1 ? <PressInput key={d.key} partId={part.id} /> : <SliderInput key={d.key} partId={part.id} def={d} />))}
      <button type="button" className="part-window__remove" onClick={() => removePart(part.id)}>{t('build.removePart')}</button>
    </section>
  );
}
