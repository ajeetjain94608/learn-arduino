import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Icon, ProjectInfo, Rich } from '../../content/en/projects';
import { t, type StringKey } from '../../i18n/en';
import { CREDITS } from '../../legal/credits';
import { ExpandButton } from './ExpandButton';

type Tab = 'overview' | 'pinout' | 'example' | 'specs';
const TABS: Tab[] = ['overview', 'pinout', 'example', 'specs'];

const ICONS: Record<Icon, string> = {
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  community: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 11a2.5 2.5 0 1 0 0-5M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 15c2.8 0 5 1.4 5 4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  output: 'M12 3v8M8 7l4 4 4-4M5 14h14v6H5z',
  resistor: 'M2 12h4l1.5-3 3 6 3-6 3 6 1.5-3h4',
  serial: 'M4 5h16v11H4zM8 20h8M7 9h6M7 12h9',
};

const RichText = ({ parts }: { parts: Rich }) => <>{parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <code key={i}>{p.code}</code>))}</>;
const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

// Tabbed explanation card in four formats (overview, wiring table, code steps, spec cards) for the open project.
// Tapping a part or label shows that instead, in the Overview tab. `infoKey` names the project (the card re-plays its entrance
// when it changes); `footer` is for an action under the tabs (Edit in Build).
export function InfoCard({ info, infoKey, focus, expanded, onExpand, footer }: { info: ProjectInfo; infoKey: string; focus: { title: string; text: string } | null; expanded: boolean; onExpand(): void; footer?: ReactNode }) {
  const [tab, setTab] = useState<Tab>('overview');
  const shown = focus ? 'overview' : tab;
  const project = infoKey;
  return (
    <section className="card info-card" data-testid="info-card" aria-label={t('info.tabs')}>
      <div className="info-card__head">
        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={shown === k} className={shown === k ? 'is-on' : ''} onClick={() => setTab(k)}>
              {t(`info.${k}` as StringKey)}
            </button>
          ))}
        </div>
        <ExpandButton expanded={expanded} expandLabel={t('panel.expand')} shrinkLabel={t('panel.shrink')} onToggle={onExpand} />
      </div>
      {/* keyed so the entrance animation replays when the project, tab or focused part changes */}
      <div className="info-card__body" role="tabpanel" key={`${project}-${shown}-${focus?.title ?? ''}`}>
        {shown === 'overview' && (focus ? (
          <div data-testid="info-sheet" aria-live="polite"><h2 className="reveal" style={stagger(0)}>{focus.title}</h2><p className="reveal" style={stagger(1)}>{focus.text}</p></div>
        ) : (
          <div>
            <h2 className="reveal" style={stagger(0)}>{info.title}</h2>
            <p className="reveal" style={stagger(1)}>{info.overview.text}</p>
            <ul className="overview__points">
              {info.overview.points.map((pt, i) => (
                <li key={i} className="overview__point reveal" style={stagger(i + 2)}>
                  <span className="overview__icon" aria-hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[pt.icon]} /></svg></span>
                  <span><RichText parts={pt.text} /></span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {shown === 'pinout' && (
          <div>
            <h2 className="reveal" style={stagger(0)}>{t('info.pinout')}</h2>
            <p className="info-card__sub reveal" style={stagger(1)}>{info.pinout.subtitle}</p>
            <table className="pinout">
              <thead className="reveal" style={stagger(2)}><tr><th>{t('pinout.pin')}</th><th>{t('pinout.to')}</th><th>{t('pinout.does')}</th></tr></thead>
              <tbody>
                {info.pinout.rows.map((r, i) => (
                  <tr key={r.pin} className="reveal" style={stagger(i + 3)}>
                    <td><span className="pinout__pin"><i style={{ background: r.color }} aria-hidden />{r.pin}</span></td>
                    <td>{r.to}</td>
                    <td>{r.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shown === 'example' && (
          <div>
            <h2 className="reveal" style={stagger(0)}>{t('example.title')}</h2>
            <ol className="steps">
              {info.example.map((step, i) => (
                <li key={i} className="reveal" style={stagger(i + 1)}><span className="steps__no" aria-hidden>{i + 1}</span><span><RichText parts={step} /></span></li>
              ))}
            </ol>
          </div>
        )}
        {shown === 'specs' && (
          <div>
            <h2 className="reveal" style={stagger(0)}>{t('info.specs')}</h2>
            <div className="spec-grid">
              {info.specs.map((c, i) => (
                <div key={c.label} className="spec-card reveal" style={stagger(i + 1)}><small>{c.label}</small><b>{c.value}</b></div>
              ))}
            </div>
          </div>
        )}
        {footer && <div className="info-card__footer">{footer}</div>}
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
      <p className="sheet__links">
        <a href="/privacy.html" target="_blank" rel="noopener">{t('about.privacy')}</a>
        <a href="/terms.html" target="_blank" rel="noopener">{t('about.terms')}</a>
      </p>
      <button type="button" className="sheet__close" onClick={onClose}>{t('about.close')}</button>
    </section>
  );
}
