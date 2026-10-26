import { useCallback, useState } from 'react';
import { PROJECTS } from '../../content/projects';
import { projectThumb } from '../../content/projects/thumbs';
import type { PartType } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { AboutSheet } from '../explorer/InfoSheet';
import { NavBar, type Screen } from '../explorer/NavBar';
import { Header, SettingsPanel } from '../explorer/TopBar';
import '../explorer/explorer.css';
import '../explorer/layout.css';
import '../pages.css';

// the parts a project uses, once each, in words ("LED, Resistor ×2")
export function partsInWords(types: PartType[]): string[] {
  const count = new Map<PartType, number>();
  for (const ty of types) count.set(ty, (count.get(ty) ?? 0) + 1);
  return [...count].map(([ty, n]) => `${t(`build.part.${ty}` as StringKey)}${n > 1 ? ` ×${n}` : ''}`);
}

// Projects: every ready-made project as a card; opening one shows it on the bench, ready to run.
export function ProjectsScreen({ onNavigate, onOpen }: { onNavigate(s: Screen): void; onOpen(id: string): void }) {
  const [settings, setSettings] = useState(false);
  const [about, setAbout] = useState(false);
  const closeSettings = useCallback(() => setSettings(false), []);
  return (
    <main className="app page" data-testid="projects-screen">
      <NavBar current="projects" onNavigate={onNavigate} onSettings={() => setSettings(true)} />
      <Header />
      <div className="page__body">
        <div className="page__intro">
          <h2>{t('projects.page.title')}</h2>
          <p>{t('projects.page.text')}</p>
        </div>
        <ul className="cards" aria-label={t('projects.page.title')} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {PROJECTS.map((p, i) => (
            <li key={p.id} className="tile">
              <img className="tile__pic" src={projectThumb(p.id)} alt="" width={480} height={336} loading="lazy" draggable={false} />
              <div className="tile__top"><div><span className="tile__num">{t('projects.page.number').replace('{n}', String(i + 1))}</span><h3>{p.title}</h3></div></div>
              <p>{p.summary}</p>
              <ul className="chips" aria-label={t('projects.page.parts')}>
                <li>{t('build.uno')}</li>
                {partsInWords(p.build.parts.map((x) => x.type)).map((s) => <li key={s}>{s}</li>)}
              </ul>
              <button type="button" className="tile__open" aria-label={t('projects.page.open').replace('{name}', p.title)} onClick={() => onOpen(p.id)}>
                {t('projects.page.openShort')}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <SettingsPanel open={settings} onClose={closeSettings} onAbout={() => setAbout(true)} />
    </main>
  );
}
