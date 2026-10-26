import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { useSound } from '../../sim/buzzerSound';

export function statusText(s: { running: boolean; pinHigh: boolean; showCurrent: boolean; booting: boolean; uploading?: boolean; compiling?: boolean }, pin13 = true): string {
  if (s.compiling) return t('status.compiling');
  if (s.uploading) return t('status.uploading');
  if (s.booting) return t('status.resetting');
  if (!s.running) return t('status.stopped');
  if (!pin13) return t('status.running'); // only the Blink circuit is about pin 13
  if (s.showCurrent) return s.pinHigh ? t('status.currentOn') : t('status.currentOff');
  return s.pinHigh ? t('status.high') : t('status.low');
}

// pin13: say what pin 13 is doing (the Blink circuit); other circuits just show that the program runs
export function StatusPill({ pin13 = true }: { pin13?: boolean } = {}) {
  const s = useWorkbenchStore();
  return (
    <div className="status" data-testid="status-pill">
      <i className={pin13 && s.running && s.pinHigh ? 'is-lit' : ''} aria-hidden />
      <span data-testid="status" aria-live="polite">{statusText(s, pin13)}</span>
      {s.running && !s.uploading && !s.booting && s.simSpeed < 1 && (
        <span className="status__speed" data-testid="sim-speed">{t('status.speed').replace('{x}', s.simSpeed.toFixed(1))}</span>
      )}
    </div>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const STEP = Math.PI / 6; // 30° per rotate press

// The toolbar inside the 3D card (camera + what the scene shows). Run lives on the code card.
// showCurrent: Home's "current" shortcut starts the shipped program on the lesson circuit — Build leaves it out.
export function ViewerToolbar({ showCurrentButton = true, soundButton = false }: { showCurrentButton?: boolean; soundButton?: boolean } = {}) {
  const { showCurrent, labels, toggleCurrent, toggleLabels, resetView, nudgeCamera, fitCamera } = useWorkbenchStore();
  const sound = useSound();
  return (
    <div className="viewer-toolbar" role="toolbar" aria-label={t('viewer.toolbar')}>
      <button type="button" aria-label={t('viewer.rotateLeft')} onClick={() => nudgeCamera('rotate', -STEP)}><Icon d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></button>
      <button type="button" aria-label={t('viewer.rotateRight')} onClick={() => nudgeCamera('rotate', STEP)}><Icon d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></button>
      <span className="viewer-toolbar__sep" aria-hidden />
      <button type="button" aria-label={t('viewer.zoomOut')} onClick={() => nudgeCamera('zoom', 1 / 1.25)}><Icon d="M5 12h14" /></button>
      <button type="button" aria-label={t('viewer.zoomIn')} onClick={() => nudgeCamera('zoom', 1.25)}><Icon d="M12 5v14M5 12h14" /></button>
      <button type="button" aria-label={t('dock.fit')} onClick={fitCamera}><Icon d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4M9 9h6v6H9z" /></button>
      <button type="button" aria-label={t('dock.reset')} onClick={resetView}><Icon d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /></button>
      <span className="viewer-toolbar__sep" aria-hidden />
      {showCurrentButton && <button type="button" aria-label={t('dock.current')} aria-pressed={showCurrent} className={showCurrent ? 'is-on' : ''} onClick={toggleCurrent}><Icon d="M13 2 4 14h7l-1 8 9-12h-7z" /></button>}
      <button type="button" aria-label={t('dock.labels')} aria-pressed={labels} className={labels ? 'is-on' : ''} onClick={toggleLabels}><Icon d="M20 12 12 20l-9-9V3h8zM7.5 6v.01" /></button>
      {soundButton && (
        <button type="button" aria-label={t('dock.sound')} aria-pressed={sound.on} className={sound.on ? 'is-on' : ''} onClick={sound.toggle}>
          <Icon d={sound.on ? 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14' : 'M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6'} />
        </button>
      )}
    </div>
  );
}
