import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';

export function statusText(s: { running: boolean; pinHigh: boolean; showCurrent: boolean; booting: boolean }): string {
  if (s.booting) return t('status.resetting');
  if (!s.running) return t('status.stopped');
  if (s.showCurrent) return s.pinHigh ? t('status.currentOn') : t('status.currentOff');
  return s.pinHigh ? t('status.high') : t('status.low');
}

export function StatusPill() {
  const s = useWorkbenchStore();
  return (
    <div className="status" data-testid="status-pill">
      <i className={s.running && s.pinHigh ? 'is-lit' : ''} aria-hidden />
      <span data-testid="status" aria-live="polite">{statusText(s)}</span>
    </div>
  );
}

export function Dock({ onResetView }: { onResetView(): void }) {
  const { running, showCurrent, labels, setRunning, toggleCurrent, toggleLabels } = useWorkbenchStore();
  return (
    <nav className="dock">
      <button type="button" className={`primary${running ? ' is-on' : ''}`} onClick={() => setRunning(!running)}>
        {running
          ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>}
        <span>{running ? t('dock.stop') : t('dock.run')}</span>
      </button>
      <button type="button" aria-label={t('dock.current')} aria-pressed={showCurrent} className={showCurrent ? 'is-on' : ''} onClick={toggleCurrent}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
        <span>{t('dock.current')}</span>
      </button>
      <button type="button" aria-label={t('dock.labels')} aria-pressed={labels} className={labels ? 'is-on' : ''} onClick={toggleLabels}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12 12 20l-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
        <span>{t('dock.labels')}</span>
      </button>
      <button type="button" aria-label={t('dock.reset')} onClick={onResetView}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        <span>{t('dock.reset')}</span>
      </button>
    </nav>
  );
}
