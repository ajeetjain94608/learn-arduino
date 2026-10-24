import { useCallback, useMemo, useState } from 'react';
import { t, type StringKey } from '../../i18n/en';
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
import { DemoClock } from './DemoClock';
import { Dock, StatusPill } from './Dock';
import { AboutSheet, InfoSheet } from './InfoSheet';
import { FpsProbe, SHOW_FPS, SideMenu, TopBar } from './TopBar';
import './explorer.css';

// Stage 1 screen: explore the Uno, switch to the wired blink circuit, run it, watch current flow,
// and inspect any part by hovering (mouse) or tapping it.
export function ExplorerScreen() {
  const view = useWorkbenchStore((s) => s.view);
  const pinHigh = useWorkbenchStore((s) => s.pinHigh);
  const showCurrent = useWorkbenchStore((s) => s.showCurrent);
  const bootLed = useWorkbenchStore((s) => s.bootLed);
  const resetView = useWorkbenchStore((s) => s.resetView);
  const selectedPart = useInspectStore((s) => s.selected);
  const selectPart = useInspectStore((s) => s.select);
  const [callout, setCallout] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const bridge = useMemo(createCalloutBridge, []);
  const guard = useContextGuard();

  const info = useMemo(() => {
    const kind = selectedPart ? kindOf(selectedPart) : null;
    if (kind) return { title: t(`part.${kind}.name` as StringKey), text: t(`part.${kind}.text` as StringKey) };
    const h = HOTSPOTS.find((x) => x.id === callout);
    return h ? { title: t(h.nameKey), text: t(h.textKey) } : null;
  }, [selectedPart, callout]);

  const clearAll = () => { setCallout(null); setAbout(false); selectPart(null); };

  return (
    <main className="app">
      <GlErrorBoundary onReload={guard.reload}>
      <Workbench key={guard.canvasKey} onCanvas={guard.onCanvas} onBackgroundTap={clearAll}>
        <DemoClock />
        <Inspectable onEmptyTap={clearAll}>
          <BlinkCircuit pinHigh={pinHigh} bootLed={bootLed} showCircuit={view === 'circuit'} showCurrent={showCurrent} />
        </Inspectable>
        <CalloutProjector hotspots={HOTSPOTS} bridge={bridge} />
        {SHOW_FPS && <FpsProbe />}
      </Workbench>
      </GlErrorBoundary>
      <div className="vignette" aria-hidden />
      <div className="overlay">
        <CalloutLayer hotspots={HOTSPOTS} bridge={bridge} selected={callout}
          onSelect={(id) => { setAbout(false); selectPart(null); setCallout(id === callout ? null : id); }} />
        <PartTooltip />
      </div>
      <TopBar onMenu={() => setMenu(true)} />
      <StatusPill />
      <InfoSheet info={about ? null : info} />
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <Dock onResetView={resetView} />
      <GlGuardCard state={guard.state} onReload={guard.reload} />
      <SideMenu open={menu} onClose={closeMenu} onAbout={() => { setCallout(null); selectPart(null); setAbout(true); }} />
    </main>
  );
}
