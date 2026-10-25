import { useCallback, useEffect, useMemo, useState } from 'react';
import { PART_DEFS } from '../../circuit/parts';
import type { PartType } from '../../circuit/types';
import { t, type StringKey } from '../../i18n/en';
import { SimClock } from '../../sim/SimClock';
import { useBuildStore } from '../../state/buildStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { isTestMode } from '../../three/shared/motion';
import { BuildScene } from '../../three/build/BuildScene';
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
import { PartWindow } from './PartWindow';
import './build.css';

type Tab = 'parts' | 'wiring' | 'code';
const PART_TYPES = Object.keys(PART_DEFS) as PartType[];
const partName = (type: PartType) => t(`build.part.${type}` as StringKey);
const fill = (s: string, name: string) => s.replace('{name}', name);
const label = (id: string, type: PartType) => `${partName(type)} ${id.slice(type.length)}`;

// Build: the learner's own circuit. Same frame as Home — the 3D bench on the left, Parts · Wiring · Code on the right.
export function BuildScreen({ onNavigate }: { onNavigate(s: Screen): void }) {
  const parts = useBuildStore((s) => s.parts);
  const wires = useBuildStore((s) => s.wires);
  const inputs = useBuildStore((s) => s.inputs);
  const select = useBuildStore((s) => s.select);
  const setInput = useBuildStore((s) => s.setInput);
  const circuitState = useWorkbenchStore((s) => s.circuitState);
  const pinHigh = useWorkbenchStore((s) => s.pinHigh);
  const rxLed = useWorkbenchStore((s) => s.rxLed);
  const txLed = useWorkbenchStore((s) => s.txLed);
  const [tab, setTab] = useState<Tab>('parts');
  const [panel, setPanel] = useState<Panel>(null);
  const [settings, setSettings] = useState(false);
  const [about, setAbout] = useState(false);
  const closeSettings = useCallback(() => setSettings(false), []);
  const guard = useContextGuard();
  const circuit = useMemo(() => ({ parts, wires }), [parts, wires]); // sent to the simulator only when it changes

  // While Build is open the code card edits the build's code; Home gets its own code back afterwards.
  useEffect(() => {
    const wb = useWorkbenchStore.getState();
    const homeCode = wb.code;
    wb.setRunning(false);
    wb.setView('circuit');
    wb.setCode(useBuildStore.getState().code);
    const unsub = useWorkbenchStore.subscribe((s) => { if (s.code !== useBuildStore.getState().code) useBuildStore.getState().setCode(s.code); });
    if (isTestMode()) (window.__rq ??= { debug: {} }).debug.build = () => useBuildStore.getState();
    return () => { unsub(); const w = useWorkbenchStore.getState(); w.setRunning(false); w.setCode(homeCode); w.setCircuitState(null); };
  }, []);

  return (
    <main className="app layout" data-testid="build-screen">
      <NavBar current="build" onNavigate={onNavigate} onSettings={() => setSettings(true)} />
      <Header />
      <section className="viewer" data-testid="viewer" aria-label={t('viewer.toolbar')}>
        <GlErrorBoundary onReload={guard.reload}>
          <Workbench key={guard.canvasKey} onCanvas={guard.onCanvas} onBackgroundTap={() => select(null)}>
            <SimClock circuit={circuit} inputs={inputs} />
            <BuildScene parts={parts} wires={wires} inputs={inputs} partStates={circuitState?.parts ?? {}} pin13={pinHigh} rx={rxLed} tx={txLed} onPick={select} onInput={setInput} />
          </Workbench>
        </GlErrorBoundary>
        <StatusPill />
        <ViewerToolbar />
        <GlGuardCard state={guard.state} onReload={guard.reload} />
      </section>
      <div className="side build-side" data-expand={panel ?? undefined}>
        <PartWindow />
        <section className="card build-card">
          <div className="tabs" role="tablist" aria-label={t('build.tabs')}>
            {(['parts', 'wiring', 'code'] as Tab[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{t(`build.tab.${k}` as StringKey)}</button>
            ))}
          </div>
          {tab === 'parts' && <PartsPanel />}
          {tab === 'wiring' && <p className="build-note">{t('build.wiringSoon')}</p>}
        </section>
        {tab === 'code' && <CodeCard panel={panel} onPanel={setPanel} />}
      </div>
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <SettingsPanel open={settings} onClose={closeSettings} onAbout={() => setAbout(true)} />
    </main>
  );
}

function PartsPanel() {
  const parts = useBuildStore((s) => s.parts);
  const addPart = useBuildStore((s) => s.addPart);
  const removePart = useBuildStore((s) => s.removePart);
  const select = useBuildStore((s) => s.select);
  const message = useBuildStore((s) => s.message);
  return (
    <div className="parts-panel">
      <h3>{t('build.library')}</h3>
      <ul className="part-library">
        {PART_TYPES.map((type) => (
          <li key={type} className="part-card">
            <span><b>{partName(type)}</b><small>{t(`build.part.${type}.text` as StringKey)}</small></span>
            <button type="button" className="part-card__add" aria-label={fill(t('build.add'), partName(type))} onClick={() => { const id = addPart(type); if (id) select(id); }}>+</button>
          </li>
        ))}
      </ul>
      {message && <p className="build-message" role="status">{message}</p>}
      <h3>{t('build.bench')}</h3>
      <ul className="bench-list" aria-label={t('build.bench')}>
        <li>{t('build.uno')}</li>
        <li>{t('build.breadboard')}</li>
        {parts.map((p) => (
          <li key={p.id}>
            <button type="button" className="bench-list__name" onClick={() => select(p.id)}>{label(p.id, p.type)} <small>{p.at.col}{p.at.row}</small></button>
            <button type="button" className="bench-list__remove" aria-label={fill(t('build.remove'), label(p.id, p.type))} onClick={() => removePart(p.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
