import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';

// The embedded 3D view's own controls (inside a tutorial): Run / Stop, and the way into the full 3D lab (in the whole tab).
export function EmbedBar({ projectId }: { projectId?: string }) {
  const busy = useWorkbenchStore((s) => s.running || s.compiling || s.plugging);
  const upload = useWorkbenchStore((s) => s.upload);
  const setRunning = useWorkbenchStore((s) => s.setRunning);
  return (
    <div className="embed-bar">
      <button type="button" className={`run-btn embed-bar__run${busy ? ' is-on' : ''}`} onClick={() => (busy ? setRunning(false) : upload())}>
        {busy
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M7 4l13 8-13 8z" /></svg>}
        <span>{busy ? t('dock.stop') : t('embed.run')}</span>
      </button>
      <a className="embed-bar__open" href={projectId ? `/#/projects/${encodeURIComponent(projectId)}` : '/'} target="_top">{t('embed.open')}</a>
    </div>
  );
}
