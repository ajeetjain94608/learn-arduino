import { useState } from 'react';
import { BuildScreen } from './screens/build/BuildScreen';
import { ExplorerScreen } from './screens/explorer/ExplorerScreen';
import type { Screen } from './screens/explorer/NavBar';
import { applyTestParams } from './testMode';
import './theme/themeStore';

applyTestParams();

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  return screen === 'build' ? <BuildScreen onNavigate={setScreen} /> : <ExplorerScreen onNavigate={setScreen} />;
}
