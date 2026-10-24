import { useMemo, useState } from 'react';
import { t } from './i18n/en';
import { DemoClock } from './screens/explorer/DemoClock';
import { useWorkbenchStore } from './state/workbenchStore';
import { applyTestParams } from './testMode';
import { BlinkCircuit } from './three/scenes/BlinkCircuit';
import { Workbench } from './three/workbench/Workbench';
import { CalloutLayer, CalloutProjector, createCalloutBridge } from './ui/callouts/CalloutLayer';
import { HOTSPOTS } from './ui/callouts/hotspots';
import './theme/themeStore';

applyTestParams();

export default function App() {
  const { view, pinHigh, showCurrent } = useWorkbenchStore();
  const [selected, setSelected] = useState<string | null>(null);
  const bridge = useMemo(createCalloutBridge, []);
  return (
    <main className="app">
      <Workbench>
        <DemoClock />
        <BlinkCircuit pinHigh={pinHigh} showCircuit={view === 'circuit'} showCurrent={showCurrent} />
        <CalloutProjector hotspots={HOTSPOTS} bridge={bridge} />
      </Workbench>
      <div className="overlay">
        <CalloutLayer hotspots={HOTSPOTS} bridge={bridge} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
      </div>
      <h1 className="brand">{t('app.name')}</h1>
    </main>
  );
}
