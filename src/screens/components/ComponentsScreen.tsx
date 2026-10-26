import { useCallback, useEffect, useMemo, useState } from 'react';
import { PART_DEFS } from '../../circuit/parts';
import type { PartInstance, PartType } from '../../circuit/types';
import { COMPONENT_ORDER, COMPONENTS, type ComponentId } from '../../content/components';
import { PROJECTS } from '../../content/projects';
import { componentThumb, projectThumb } from '../../content/projects/thumbs';
import { t, type StringKey } from '../../i18n/en';
import { BuildStoreContext, useBuild } from '../../state/buildContext';
import { createBuildStore, useBuildStore } from '../../state/buildStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { BuildScene } from '../../three/build/BuildScene';
import { pinWorld } from '../../three/build/pinPoints';
import { GlGuardCard, useContextGuard } from '../../three/workbench/ContextGuard';
import { GlErrorBoundary } from '../../three/workbench/GlErrorBoundary';
import { Workbench } from '../../three/workbench/Workbench';
import { PartWindow } from '../build/PartWindow';
import { ViewerToolbar } from '../explorer/Dock';
import { AboutSheet } from '../explorer/InfoSheet';
import { NavBar, type Screen } from '../explorer/NavBar';
import { Header, SettingsPanel } from '../explorer/TopBar';
import '../build/build.css';
import '../explorer/explorer.css';
import '../explorer/layout.css';
import '../pages.css';

const isPart = (id: string): id is PartType => id in PART_DEFS;
const usedIn = (id: ComponentId) => PROJECTS.filter((p) => (id === 'uno' ? true : id === 'breadboard' ? p.build.parts.some((x) => !('x' in x.at)) : p.build.parts.some((x) => x.type === id)));

function usePageChrome() {
  const [settings, setSettings] = useState(false);
  const [about, setAbout] = useState(false);
  const closeSettings = useCallback(() => setSettings(false), []);
  const chrome = (
    <>
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <SettingsPanel open={settings} onClose={closeSettings} onAbout={() => setAbout(true)} />
    </>
  );
  return { openSettings: () => setSettings(true), chrome };
}

// Components: every part, grouped, each with what it is for.
export function ComponentsScreen({ onNavigate, onOpen }: { onNavigate(s: Screen): void; onOpen(id: string): void }) {
  const { openSettings, chrome } = usePageChrome();
  return (
    <main className="app page" data-testid="components-screen">
      <NavBar current="components" onNavigate={onNavigate} onSettings={openSettings} />
      <Header />
      <div className="page__body">
        <div className="page__intro"><h2>{t('components.title')}</h2><p>{t('components.text')}</p></div>
        {COMPONENT_ORDER.map((g) => (
          <section key={g.key} aria-label={t(`components.cat.${g.key}` as StringKey)}>
            <h3 className="page__group">{t(`components.cat.${g.key}` as StringKey)}</h3>
            <ul className="cards" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {g.ids.map((id) => {
                const c = COMPONENTS[id];
                return (
                  <li key={id} className="tile">
                    <img className="tile__pic" src={componentThumb(id)} alt="" width={480} height={336} loading="lazy" draggable={false} />
                    <div className="tile__top"><h3>{c.name}</h3></div>
                    <p>{c.overview.split('. ')[0]}.</p>
                    <button type="button" className="tile__open" aria-label={t('components.open').replace('{name}', c.name)} onClick={() => onOpen(id)}>{t('components.openShort')}</button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {chrome}
    </main>
  );
}

type Tab = 'overview' | 'pins' | 'specs' | 'example';

// One component: on the bench in 3D with its own controls (turn, press, move the lamp…), and its info tabs.
export function ComponentScreen({ type, onNavigate, onOpen, onUse }: { type: string; onNavigate(s: Screen): void; onOpen(id: string): void; onUse(): void }) {
  const id = (type in COMPONENTS ? type : 'uno') as ComponentId;
  const info = COMPONENTS[id];
  const { openSettings, chrome } = usePageChrome();
  const guard = useContextGuard();
  const [tab, setTab] = useState<Tab>('overview');
  // a bench of its own, not saved, with just this part on it
  const store = useMemo(() => {
    const parts: PartInstance[] = !isPart(id) ? [] : [{
      id: `${id}1`, type: id, params: {}, at: PART_DEFS[id].bench ? { x: 30, z: -72 } : { col: 13, row: id === 'button' ? 'e' : 'a' },
    }];
    return createBuildStore(undefined, `rq-sandbox-${id}`, { parts, wires: [], code: info.example });
  }, [id, info.example]);
  const projects = usedIn(id);

  useEffect(() => {
    const wb = useWorkbenchStore.getState();
    const homeView = wb.view === 'bench' ? 'circuit' : wb.view; // Home's own view comes back when this page closes
    const part = store.getState().parts[0];
    wb.setView(part && 'x' in part.at ? 'bench' : 'circuit');
    const at = !part ? (id === 'uno' ? [-38, 4, 2] : [50, 6, 8])
      : 'x' in part.at ? [part.at.x, 12, part.at.z] : pinWorld(`bb.${Object.values(PART_DEFS[part.type].footprint(part.at, part.params) ?? {})[0]}`).toArray();
    const timer = setTimeout(() => wb.focusCamera(at as [number, number, number], part ? 3 : 1.6), 60); // after the view settles
    if (part) store.getState().select(part.id);
    return () => { clearTimeout(timer); useWorkbenchStore.getState().setView(homeView); };
  }, [store, id]);

  const use = () => { if (isPart(id)) { const added = useBuildStore.getState().addPart(id); if (added) useBuildStore.getState().select(added); } onUse(); };

  return (
    <BuildStoreContext.Provider value={store}>
      <main className="app layout component-page" data-testid="component-screen">
        <NavBar current="components" onNavigate={onNavigate} onSettings={openSettings} />
        <Header />
        <section className="viewer" data-testid="viewer" aria-label={t('viewer.toolbar')}>
          <GlErrorBoundary onReload={guard.reload}>
            <Workbench key={guard.canvasKey} onCanvas={guard.onCanvas} onBackgroundTap={() => {}}>
              <SandboxScene />
            </Workbench>
          </GlErrorBoundary>
          <ViewerToolbar showCurrentButton={false} />
          <GlGuardCard state={guard.state} onReload={guard.reload} />
        </section>
        <div className="side">
          <PartWindow fixed />
          <section className="card component-info">
            <h2>{info.name}</h2>
            <div className="tabs" role="tablist" aria-label={t('components.tabs')}>
              {(['overview', 'pins', 'specs', 'example'] as Tab[]).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{t(`components.tab.${k}` as StringKey)}</button>
              ))}
            </div>
            {tab === 'overview' && <><p>{info.overview}</p><ul>{info.points.map((s) => <li key={s}>{s}</li>)}</ul></>}
            {tab === 'pins' && <table className="project-about__wiring"><tbody>{info.pins.map((p) => <tr key={p.pin}><th scope="row">{p.pin}</th><td>{p.does}</td></tr>)}</tbody></table>}
            {tab === 'specs' && <dl className="component-info__specs">{info.specs.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>}
            {tab === 'example' && <pre className="component-info__code"><code>{info.example}</code></pre>}
            {isPart(id) && <button type="button" className="tile__open component-info__use" onClick={use}>{t('components.use')}</button>}
          </section>
        </div>
        <section className="projects" aria-label={t('components.usedIn')}>
          <div className="projects__head"><h2>{t('components.usedIn')}</h2></div>
          <div className="projects__row">
            {projects.map((p) => (
              <button key={p.id} type="button" className="project" onClick={() => onOpen(p.id)}>
                <img className="project__thumb" src={projectThumb(p.id)} alt="" width={88} height={62} draggable={false} />
                <span className="project__text"><b>{p.title}</b></span>
              </button>
            ))}
          </div>
        </section>
        {chrome}
      </main>
    </BuildStoreContext.Provider>
  );
}

function SandboxScene() {
  const parts = useBuild((s) => s.parts);
  const inputs = useBuild((s) => s.inputs);
  const setInput = useBuild((s) => s.setInput);
  const select = useBuild((s) => s.select);
  return <BuildScene burns={[]} parts={parts} wires={[]} inputs={inputs} partStates={{}} pin13={false} rx={false} tx={false} onPick={select} onInput={setInput} />;
}
