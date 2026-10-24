import { useWorkbenchStore } from './state/workbenchStore';
import { useThemeStore } from './theme/themeStore';
import { isThemeName } from './theme/themes';
import { isTestMode } from './three/shared/motion';

// ?test&view=circuit&theme=night — lets automated tests open the app in a known state.
export function applyTestParams(): void {
  if (!isTestMode()) return;
  const q = new URLSearchParams(location.search);
  const view = q.get('view');
  if (view === 'board' || view === 'circuit') useWorkbenchStore.getState().setView(view);
  const theme = q.get('theme');
  if (isThemeName(theme)) useThemeStore.getState().setTheme(theme);
  if (q.has('current')) useWorkbenchStore.getState().toggleCurrent();
  else if (q.has('run')) useWorkbenchStore.getState().setRunning(true);
}
