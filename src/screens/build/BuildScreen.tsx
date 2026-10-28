import { useCallback, useEffect, useMemo, useState } from 'react';
import { BB_HOLES, UNO_PINS } from '../../circuit/board';
import { partPoints } from '../../circuit/parts';
import type { PartInstance, PartType } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { BuzzerSound } from '../../sim/buzzerSound';
import { SimClock } from '../../sim/SimClock';
import { BuildStoreContext, useBuild, useBuildApi } from '../../state/buildContext';
import { useBuildStore, type BuildStore } from '../../state/buildStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { isTestMode } from '../../three/shared/motion';
import { BuildScene } from '../../three/build/BuildScene';
import { WireDragger } from '../../three/build/WireDragger';
import { GlErrorBoundary } from '../../three/workbench/GlErrorBoundary';
import { GlGuardCard, useContextGuard } from '../../three/workbench/ContextGuard';
import { Workbench } from '../../three/workbench/Workbench';
import { CodeCard } from '../explorer/CodeCard';
import { StatusPill, ViewerToolbar } from '../explorer/Dock';
import type { Panel } from '../explorer/ExpandButton';
import { AboutSheet } from '../explorer/InfoSheet';
import { NavBar, type Screen } from '../explorer/NavBar';
import { Header, SettingsPanel } from '../explorer/TopBar';
import '../explorer/explorer.css';
import '../explorer/layout.css';
import type { Project } from '../../content/projects';
import { BurnCard, WiringWarnings } from './BurnCard';
import { ProjectAbout } from './ProjectAbout';
import { PartWindow } from './PartWindow';
import { WiringTable } from './WiringTable';
import './build.css';

type Tab = 'about' | 'parts' | 'wiring' | 'code';
// the parts library, in the order a beginner meets them
const CATEGORIES: { key: string; types: PartType[] }[] = [
  { key: 'basic', types: ['breadboard', 'led', 'resistor', 'button', 'pot', 'diode', 'npn'] },
  { key: 'output', types: ['rgb', 'buzzer', 'traffic', 'motor', 'servo', 'stepper', 'oled'] },
  { key: 'sensor', types: ['ldr', 'tmp36', 'fsr', 'hcsr04', 'soil'] },
];
// where a part is, in words: its first leg's hole, or "On the bench"
const placeLabel = (p: PartInstance) => ('x' in p.at ? t('build.onBench') : `${p.at.col}${p.at.row}${p.at.board && p.at.board !== 'bb' ? ` · board ${p.at.board.slice(10)}` : ''}`);
const partName = (type: PartType) => t(`build.part.${type}` as StringKey);
const fill = (s: string, name: string) => s.replace('{name}', name);
const label = (id: string, type: PartType) => `${partName(type)} ${id.slice(type.length)}`;

// Build: the learner's own circuit (or a project's own copy, given its store). Same frame as Home — the 3D bench on
// the left, Parts · Wiring · Code on the right.
// With a project: its own copy of the project's build, and an About tab first.
export function BuildScreen({ onNavigate, store = useBuildStore, project }: { onNavigate(s: Screen): void; store?: BuildStore; project?: Project }) {
  return <BuildStoreContext.Provider value={store}><Workspace onNavigate={onNavigate} project={project} /></BuildStoreContext.Provider>;
}

function Workspace({ onNavigate, project }: { onNavigate(s: Screen): void; project?: Project }) {
  const api = useBuildApi();
  const parts = useBuild((s) => s.parts);
  const wires = useBuild((s) => s.wires);
  const inputs = useBuild((s) => s.inputs);
  const select = useBuild((s) => s.select);
  const dragPart = useBuild((s) => s.dragPart);
  const selected = useBuild((s) => s.selected);
  const setInput = useBuild((s) => s.setInput);
  const addWire = useBuild((s) => s.addWire);
  const burns = useBuild((s) => s.burns);
  const setBurns = useBuild((s) => s.setBurns);
  const message = useBuild((s) => s.message);
  const circuitState = useWorkbenchStore((s) => s.circuitState);
  const pinHigh = useWorkbenchStore((s) => s.pinHigh);
  const labels = useWorkbenchStore((s) => s.labels);
  const running = useWorkbenchStore((s) => s.running);
  const rxLed = useWorkbenchStore((s) => s.rxLed);
  const txLed = useWorkbenchStore((s) => s.txLed);
  const [tab, setTab] = useState<Tab>(project ? 'about' : 'parts');
  const tabs: Tab[] = project ? ['about', 'parts', 'wiring', 'code'] : ['parts', 'wiring', 'code'];
  const [panel, setPanel] = useState<Panel>(null);
  const [settings, setSettings] = useState(false);
  const [about, setAbout] = useState(false);
  const closeSettings = useCallback(() => setSettings(false), []);
  const guard = useContextGuard();
  const circuit = useMemo(() => ({ parts, wires }), [parts, wires]); // sent to the simulator only when it changes
  // points a wire can be dragged from/to: every UNO pin, and the holes nothing sits in yet
  const targets = useMemo(() => {
    const used = api.getState().usedPins();
    const holes = parts.filter((p) => p.type === 'breadboard').flatMap((b) => BB_HOLES.map((h) => `${b.id}.${h}`));
    return [...UNO_PINS.map((p) => `uno.${p}`), ...[...holes, ...parts.flatMap(partPoints)].filter((h) => !used.has(h))];
  }, [api, parts, wires]);

  // While Build is open the board runs the build's program: code, compiled program and compiler messages are
  // swapped in, and Home gets its own back afterwards.
  useEffect(() => {
    const wb = useWorkbenchStore.getState();
    const home = { code: wb.code, program: wb.program, diagnostics: wb.diagnostics, showCurrent: wb.showCurrent, view: wb.view };
    wb.setRunning(false);
    wb.setView(api.getState().parts.some((p) => 'x' in p.at) ? 'bench' : 'circuit'); // modules on the bench: show it all
    useWorkbenchStore.setState({ diagnostics: [], showCurrent: false });
    wb.setCode(api.getState().code);
    const unsub = useWorkbenchStore.subscribe((s) => { if (s.code !== api.getState().code) api.getState().setCode(s.code); });
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.build = () => api.getState();
    return () => {
      unsub();
      const w = useWorkbenchStore.getState();
      w.setRunning(false);
      useWorkbenchStore.setState({ code: home.code, program: home.program, diagnostics: home.diagnostics, showCurrent: home.showCurrent, circuitState: null, view: home.view === 'bench' ? 'circuit' : home.view });
    };
  }, [api]);

  return (
    <main className="app layout" data-testid="build-screen">
      <NavBar current={project ? 'projects' : 'build'} onNavigate={onNavigate} onSettings={() => setSettings(true)} />
      <Header />
      <section className="viewer" data-testid="viewer" aria-label={t('viewer.toolbar')}>
        <GlErrorBoundary onReload={guard.reload}>
          <Workbench key={guard.canvasKey} onCanvas={guard.onCanvas} onBackgroundTap={() => select(null)}>
            <SimClock circuit={circuit} inputs={inputs} burns={burns} onBurns={setBurns} />
            <WireDragger targets={targets} parts={parts} color="#F28C16" onWire={(a, b) => { if (addWire(a, b)) setTab('wiring'); }} />
            <BuildScene burns={burns} parts={parts} wires={wires} inputs={inputs} partStates={circuitState?.parts ?? {}} wireVolts={labels && running ? circuitState?.wireVolts : undefined} pin13={pinHigh} rx={rxLed} tx={txLed} onPick={select} onMove={dragPart} selected={selected} onInput={setInput} />
          </Workbench>
        </GlErrorBoundary>
        <StatusPill pin13={false} />
        <ViewerToolbar showCurrentButton={false} soundButton />
        <BuzzerSound />
        <GlGuardCard state={guard.state} onReload={guard.reload} />
      </section>
      <div className="side build-side" data-expand={panel ?? undefined}>
        <BurnCard />
        {message && <p className="build-message" role="status">{message}</p>}
        <PartWindow />
        <section className={`card build-card${tab === 'code' ? ' build-card--tabs-only' : ''}`}>
          <div className="tabs" role="tablist" aria-label={t('build.tabs')}>
            {tabs.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{t(`build.tab.${k}` as StringKey)}</button>
            ))}
          </div>
          {tab === 'about' && project && <ProjectAbout project={project} onRun={() => setTab('code')} />}
          {tab === 'parts' && <PartsPanel />}
          {tab === 'wiring' && <><WiringWarnings /><WiringTable /></>}
        </section>
        {tab === 'code' && <><WiringWarnings /><CodeCard panel={panel} onPanel={setPanel} /></>}
      </div>
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <SettingsPanel open={settings} onClose={closeSettings} onAbout={() => setAbout(true)} />
    </main>
  );
}

function PartsPanel() {
  const parts = useBuild((s) => s.parts);
  const addPart = useBuild((s) => s.addPart);
  const removePart = useBuild((s) => s.removePart);
  const select = useBuild((s) => s.select);
  return (
    <div className="parts-panel">
      <h3>{t('build.library')}</h3>
      <p className="build-note">{t('build.dragHint')}</p>
      {CATEGORIES.map((c) => (
        <section key={c.key} className="part-library__group" aria-label={t(`build.cat.${c.key}` as StringKey)}>
          <h4>{t(`build.cat.${c.key}` as StringKey)}</h4>
          <ul className="part-library">
            {c.types.map((type) => (
              <li key={type} className="part-card">
                <span><b>{partName(type)}</b><small>{t(`build.part.${type}.text` as StringKey)}</small></span>
                <button type="button" className="part-card__add" aria-label={fill(t('build.add'), partName(type))} onClick={() => { const id = addPart(type); if (id) select(id); }}>+</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <h3>{t('build.bench')}</h3>
      <ul className="bench-list" aria-label={t('build.bench')}>
        <li>{t('build.uno')}</li>
        {parts.map((p) => (
          <li key={p.id}>
            <button type="button" className="bench-list__name" onClick={() => select(p.id)}>{label(p.id, p.type)} <small>{placeLabel(p)}</small></button>
            <button type="button" className="bench-list__remove" aria-label={fill(t('build.remove'), label(p.id, p.type))} onClick={() => removePart(p.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
