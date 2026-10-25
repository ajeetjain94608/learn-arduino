import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';

// The sketch running on the board (Stage 2 swaps the demo clock for real execution of this code).
export const BLINK_SKETCH = `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED on");
  delay(1000);
  digitalWrite(13, LOW);
  Serial.println("LED off");
  delay(1000);
}`;
const LINES = BLINK_SKETCH.split('\n');

export function CodeCard() {
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
        <button type="button" className="icon-btn" aria-label={copied ? t('code.copied') : t('code.copy')} onClick={copy}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
        </button>
        <button type="button" className={`run-btn${running ? ' is-on' : ''}`} onClick={() => (running ? setRunning(false) : upload())}>
          {running
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>}
          {running ? t('dock.stop') : t('dock.run')}
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
      <SerialMonitor />
    </section>
  );
}

function SerialMonitor() {
  const lines = useWorkbenchStore((s) => s.serial);
  const clear = useWorkbenchStore((s) => s.clearSerial);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [lines]); // follow new output
  return (
    <div className="serial">
      <div className="serial__head">
        <h3>{t('serial.title')}</h3>
        <span className="serial__baud">{t('serial.baud')}</span>
        <button type="button" className="serial__clear" onClick={clear}>{t('serial.clear')}</button>
      </div>
      <div ref={box} className="serial__out" role="log" aria-label={t('serial.title')} aria-live="polite">
        {lines.length === 0 ? <span className="serial__empty">{t('serial.empty')}</span> : lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
