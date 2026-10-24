import { ExplorerScreen } from './screens/explorer/ExplorerScreen';
import { applyTestParams } from './testMode';
import './theme/themeStore';

applyTestParams();

export default function App() {
  return <ExplorerScreen />;
}
