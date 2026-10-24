import { useMemo, useState } from 'react';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { BlinkCircuit } from '../../three/scenes/BlinkCircuit';
import { GlGuardCard, useContextGuard } from '../../three/workbench/ContextGuard';
import { Workbench } from '../../three/workbench/Workbench';
import { CalloutLayer, CalloutProjector, createCalloutBridge } from '../../ui/callouts/CalloutLayer';
import { HOTSPOTS } from '../../ui/callouts/hotspots';
import { DemoClock } from './DemoClock';
import { Dock, StatusPill } from './Dock';
import { AboutSheet, InfoSheet } from './InfoSheet';
import { FpsProbe, TopBar } from './TopBar';
import './explorer.css';

// Stage 1 screen: explore the Uno, switch to the wired blink circuit, run it and watch current flow.
export function ExplorerScreen() {
  const { view, pinHigh, showCurrent, resetView } = useWorkbenchStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const bridge = useMemo(createCalloutBridge, []);
  const guard = useContextGuard();

  return (
    <main className="app">
      <Workbench key={guard.canvasKey} onCanvas={guard.onCanvas} onBackgroundTap={() => { setSelected(null); setAbout(false); }}>
        <DemoClock />
        <BlinkCircuit pinHigh={pinHigh} showCircuit={view === 'circuit'} showCurrent={showCurrent} />
        <CalloutProjector hotspots={HOTSPOTS} bridge={bridge} />
        {import.meta.env.DEV && <FpsProbe />}
      </Workbench>
      <div className="vignette" aria-hidden />
      <div className="overlay">
        <CalloutLayer hotspots={HOTSPOTS} bridge={bridge} selected={selected} onSelect={(id) => { setAbout(false); setSelected(id === selected ? null : id); }} />
      </div>
      <TopBar onAbout={() => { setSelected(null); setAbout((a) => !a); }} />
      <StatusPill />
      <InfoSheet hotspot={HOTSPOTS.find((h) => h.id === selected) ?? null} />
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <Dock onResetView={resetView} />
      <GlGuardCard state={guard.state} onReload={guard.reload} />
    </main>
  );
}
