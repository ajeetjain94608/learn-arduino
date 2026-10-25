import { useCallback, useMemo, useState } from 'react';
import { t, type StringKey } from '../../i18n/en';
import { SimClock } from '../../sim/SimClock';
import { useInspectStore } from '../../state/inspectStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { Inspectable } from '../../three/inspect/Inspectable';
import { kindOf } from '../../three/inspect/partCatalog';
import { PartTooltip } from '../../three/inspect/PartTooltip';
import { BlinkCircuit } from '../../three/scenes/BlinkCircuit';
import { GlGuardCard, useContextGuard } from '../../three/workbench/ContextGuard';
import { GlErrorBoundary } from '../../three/workbench/GlErrorBoundary';
import { Workbench } from '../../three/workbench/Workbench';
import { CalloutLayer, CalloutProjector, createCalloutBridge } from '../../ui/callouts/CalloutLayer';
import { HOTSPOTS } from '../../ui/callouts/hotspots';
import { CodeCard } from './CodeCard';
import type { Panel } from './ExpandButton';
import { StatusPill, ViewerToolbar } from './Dock';
import { AboutSheet, InfoCard } from './InfoSheet';
import { NavBar, type Screen } from './NavBar';
import { ProjectsRow } from './ProjectsRow';
import { FpsProbe, Header, SettingsPanel, SHOW_FPS } from './TopBar';
import './explorer.css';
import './layout.css';

// Home screen. The 3D view sits in its own card with its toolbar; projects, the explanation tabs and the
// code sit beside it (landscape / desktop) or below it (phone held upright).
export function ExplorerScreen({ onNavigate }: { onNavigate?(s: Screen): void } = {}) {
  const view = useWorkbenchStore((s) => s.view);
  const pinHigh = useWorkbenchStore((s) => s.pinHigh);
  const showCurrent = useWorkbenchStore((s) => s.showCurrent);
  const bootLed = useWorkbenchStore((s) => s.bootLed);
  const rxLed = useWorkbenchStore((s) => s.rxLed);
  const txLed = useWorkbenchStore((s) => s.txLed);
  const selectedPart = useInspectStore((s) => s.selected);
  const selectPart = useInspectStore((s) => s.select);
  const [callout, setCallout] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [settings, setSettings] = useState(false);
  const [panel, setPanel] = useState<Panel>(null); // the side panel given extra room, if any
  const closeSettings = useCallback(() => setSettings(false), []);
  const bridge = useMemo(createCalloutBridge, []);
  const guard = useContextGuard();

  const focus = useMemo(() => {
    const kind = selectedPart ? kindOf(selectedPart) : null;
    if (kind) return { title: t(`part.${kind}.name` as StringKey), text: t(`part.${kind}.text` as StringKey) };
    const h = HOTSPOTS.find((x) => x.id === callout);
    return h ? { title: t(h.nameKey), text: t(h.textKey) } : null;
  }, [selectedPart, callout]);

  const clearAll = () => { setCallout(null); setAbout(false); selectPart(null); };

  return (
    <main className="app layout">
      <NavBar current="home" onNavigate={onNavigate} onSettings={() => setSettings(true)} />
      <Header />
      <section className="viewer" data-testid="viewer" aria-label={t('viewer.toolbar')}>
        <GlErrorBoundary onReload={guard.reload}>
          <Workbench key={guard.canvasKey} onCanvas={guard.onCanvas} onBackgroundTap={clearAll}>
            <SimClock />
            <Inspectable onEmptyTap={clearAll}>
              <BlinkCircuit pinHigh={pinHigh} bootLed={bootLed} rx={rxLed} tx={txLed} showCircuit={view === 'circuit'} showCurrent={showCurrent} />
            </Inspectable>
            <CalloutProjector hotspots={HOTSPOTS} bridge={bridge} />
            {SHOW_FPS && <FpsProbe />}
          </Workbench>
        </GlErrorBoundary>
        <div className="overlay">
          <CalloutLayer hotspots={HOTSPOTS} bridge={bridge} selected={callout}
            onSelect={(id) => { setAbout(false); selectPart(null); setCallout(id === callout ? null : id); }} />
          <PartTooltip />
        </div>
        <StatusPill />
        <ViewerToolbar />
        <GlGuardCard state={guard.state} onReload={guard.reload} />
      </section>
      <div className="side" data-expand={panel ?? undefined}>
        <InfoCard project={view} focus={focus} expanded={panel === 'info'} onExpand={() => setPanel(panel === 'info' ? null : 'info')} />
        <CodeCard panel={panel} onPanel={setPanel} />
      </div>
      <ProjectsRow />
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <SettingsPanel open={settings} onClose={closeSettings} onAbout={() => { setCallout(null); selectPart(null); setAbout(true); }} />
    </main>
  );
}
