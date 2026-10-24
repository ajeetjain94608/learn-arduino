import { t } from './i18n/en';
import { Workbench } from './three/workbench/Workbench';
import './theme/themeStore';

export default function App() {
  return (
    <main className="app">
      <Workbench />
      <h1 className="brand">{t('app.name')}</h1>
    </main>
  );
}
