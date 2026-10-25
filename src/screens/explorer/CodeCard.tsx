import { useState } from 'react';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';

// The sketch running on the board (Stage 2 swaps the demo clock for real execution of this code).
export const BLINK_SKETCH = `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`;

export function CodeCard() {
  const running = useWorkbenchStore((s) => s.running);
  const setRunning = useWorkbenchStore((s) => s.setRunning);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(BLINK_SKETCH); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <section className="card code-card" data-testid="code-card" aria-label={t('code.title')}>
      <div className="code-card__head">
        <h2>{t('code.title')}</h2>
        <button type="button" className="icon-btn" aria-label={copied ? t('code.copied') : t('code.copy')} onClick={copy}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
        </button>
        <button type="button" className={`run-btn${running ? ' is-on' : ''}`} onClick={() => setRunning(!running)}>
          {running
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>}
          {running ? t('dock.stop') : t('dock.run')}
        </button>
      </div>
      <pre className="code"><code>{BLINK_SKETCH.split('\n').map((line, i) => (
        <span key={i} className="code__line"><span className="code__no" aria-hidden>{i + 1}</span>{line || ' '}{'\n'}</span>
      ))}</code></pre>
    </section>
  );
}
