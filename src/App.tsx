import { t } from './i18n/en';
import { applyTestParams } from './testMode';
import { UnoBoard } from './three/boards/uno/UnoBoard';
import { Workbench } from './three/workbench/Workbench';
import './theme/themeStore';

applyTestParams();

export default function App() {
  return (
    <main className="app">
      <Workbench>
        <UnoBoard />
      </Workbench>
      <h1 className="brand">{t('app.name')}</h1>
    </main>
  );
}
