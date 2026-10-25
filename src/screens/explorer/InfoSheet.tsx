import { useState } from 'react';
import { t, type StringKey } from '../../i18n/en';
import { CREDITS } from '../../legal/credits';

type Tab = 'overview' | 'pinout' | 'example' | 'specs';
const TABS: Tab[] = ['overview', 'pinout', 'example', 'specs'];
const SPECS = ['mcu', 'clock', 'voltage', 'input', 'digital', 'analog', 'flash', 'sram', 'eeprom', 'current'];
const PINOUT = ['digital', 'analog', 'power', 'serial', 'i2c'];

// Tabbed explanation card. Overview shows the tapped part or label, otherwise the board itself.
export function InfoCard({ focus }: { focus: { title: string; text: string } | null }) {
  const [tab, setTab] = useState<Tab>('overview');
  const shown = focus ? 'overview' : tab;
  return (
    <section className="card info-card" data-testid="info-card" aria-label={t('info.tabs')}>
      <div className="tabs" role="tablist">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={shown === k} className={shown === k ? 'is-on' : ''} onClick={() => setTab(k)}>
            {t(`info.${k}` as StringKey)}
          </button>
        ))}
      </div>
      <div className="info-card__body" role="tabpanel">
        {shown === 'overview' && (focus ? (
          <div data-testid="info-sheet" aria-live="polite"><h2>{focus.title}</h2><p>{focus.text}</p></div>
        ) : (
          <div>
            <h2>{t('board.name')}</h2>
            <p>{t('board.overview')}</p>
            <ul className="points">{(['board.point1', 'board.point2', 'board.point3'] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul>
          </div>
        ))}
        {shown === 'pinout' && <ul className="points">{PINOUT.map((k) => <li key={k}>{t(`pinout.${k}` as StringKey)}</li>)}</ul>}
        {shown === 'example' && <p>{t('example.text')}</p>}
        {shown === 'specs' && (
          <dl className="specs">
            {SPECS.map((k) => (<div key={k}><dt>{t(`spec.${k}` as StringKey)}</dt><dd>{t(`spec.${k}.v` as StringKey)}</dd></div>))}
          </dl>
        )}
      </div>
    </section>
  );
}

export function AboutSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  if (!open) return null;
  return (
    <section className="sheet sheet--about" role="dialog" aria-label={t('about.title')}>
      <h2>{t('about.title')}</h2>
      <p>{t('about.body')}</p>
      <ul>{CREDITS.map((c) => <li key={c}>{c}</li>)}</ul>
      <button type="button" className="sheet__close" onClick={onClose}>{t('about.close')}</button>
    </section>
  );
}
