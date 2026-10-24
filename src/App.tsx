import { t } from './i18n/en';
import { DemoClock } from './screens/explorer/DemoClock';
import { useWorkbenchStore } from './state/workbenchStore';
import { applyTestParams } from './testMode';
import { BlinkCircuit } from './three/scenes/BlinkCircuit';
import { Workbench } from './three/workbench/Workbench';
import './theme/themeStore';

applyTestParams();

export default function App() {
  const { view, pinHigh, showCurrent } = useWorkbenchStore();
  return (
    <main className="app">
      <Workbench>
        <DemoClock />
        <BlinkCircuit pinHigh={pinHigh} showCircuit={view === 'circuit'} showCurrent={showCurrent} />
      </Workbench>
      <h1 className="brand">{t('app.name')}</h1>
    </main>
  );
}
