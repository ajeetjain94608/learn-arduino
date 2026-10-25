import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BLINK } from '../../content/sketches/blink';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { ExpandButton, type Panel } from './ExpandButton';

// The project's sketch; the simulated board runs its compiled program (src/content/sketches).
export const BLINK_SKETCH = BLINK.code;
const LINES = BLINK_SKETCH.split('\n');

export function CodeCard({ panel, onPanel }: { panel: Panel; onPanel(p: Panel): void }) {
  const running = useWorkbenchStore((s) => s.running);
  const uploading = useWorkbenchStore((s) => s.uploading);
  const progress = useWorkbenchStore((s) => s.uploadProgress);
  const line = useWorkbenchStore((s) => s.line);
  const upload = useWorkbenchStore((s) => s.upload);
  const setRunning = useWorkbenchStore((s) => s.setRunning);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(BLINK_SKETCH); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const activeLine = running && !uploading ? line : null;
  return (
    <section className="card code-card" data-testid="code-card" aria-label={t('code.title')}>
      <div className="code-card__head">
        <h2>{t('code.title')}</h2>
        <ExpandButton expanded={panel === 'code'} expandLabel={t('code.expand')} shrinkLabel={t('code.shrink')} onToggle={() => onPanel(panel === 'code' ? null : 'code')} />
        <button type="button" className="icon-btn" aria-label={copied ? t('code.copied') : t('code.copy')} onClick={copy}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
        </button>
        <button type="button" className={`run-btn${running ? ' is-on' : ''}`} aria-label={running ? t('dock.stop') : t('dock.run')} onClick={() => (running ? setRunning(false) : upload())}>
          {running
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>}
          <span className="run-btn__text" aria-hidden>{running ? t('dock.stop') : t('dock.run')}</span>
        </button>
      </div>
      {uploading && (
        <div className="upload">
          <span>{t('code.uploading')}… {Math.round(progress * 100)}%</span>
          <div className="upload__bar" role="progressbar" aria-label={t('code.uploading')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <i style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
      <pre className="code"><code>{LINES.map((text, i) => (
        <span key={i} className={`code__line${activeLine === i + 1 ? ' is-running' : ''}`} aria-current={activeLine === i + 1 ? 'step' : undefined}>
          <span className="code__no" aria-hidden>{i + 1}</span>{text || ' '}{'\n'}
        </span>
      ))}</code></pre>
      <SerialMonitor expanded={panel === 'serial'} onExpand={() => onPanel(panel === 'serial' ? null : 'serial')} />
    </section>
  );
}

function SerialMonitor({ expanded, onExpand }: { expanded: boolean; onExpand(): void }) {
  const lines = useWorkbenchStore((s) => s.serial);
  const clear = useWorkbenchStore((s) => s.clearSerial);
  const send = useWorkbenchStore((s) => s.serialSend);
  const [message, setMessage] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); send(message); setMessage(''); };
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]); // follow new output
  return (
    <div className="serial">
      <div className="serial__head">
        <h3>{t('serial.title')}</h3>
        <span className="serial__baud">{t('serial.baud')}</span>
        <button type="button" className="serial__clear" onClick={clear}>{t('serial.clear')}</button>
        <ExpandButton expanded={expanded} expandLabel={t('serial.expand')} shrinkLabel={t('serial.shrink')} onToggle={onExpand} />
      </div>
      <div ref={box} className="serial__out" role="log" aria-label={t('serial.title')} aria-live="polite">
        {lines.length === 0 ? <span className="serial__empty">{t('serial.empty')}</span> : lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <form className="serial__send" onSubmit={submit}>
        <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} aria-label={t('serial.input')}
          placeholder={t('serial.placeholder')} autoComplete="off" spellCheck={false} />
        <button type="submit" aria-label={t('serial.send')}>{t('serial.sendShort')}</button>
      </form>
    </div>
  );
}
