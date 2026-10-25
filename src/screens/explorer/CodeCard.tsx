import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { BLINK } from '../../content/sketches/blink';
import { t } from '../../i18n/en';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { ExpandButton, type Panel } from './ExpandButton';

// The project's sketch; the simulated board runs its compiled program (src/content/sketches).
export const BLINK_SKETCH = BLINK.code;

export function CodeCard({ panel, onPanel }: { panel: Panel; onPanel(p: Panel): void }) {
  const running = useWorkbenchStore((s) => s.running);
  const compiling = useWorkbenchStore((s) => s.compiling);
  const busy = running || compiling; // the button offers Stop while compiling too
  const uploading = useWorkbenchStore((s) => s.uploading);
  const progress = useWorkbenchStore((s) => s.uploadProgress);
  const line = useWorkbenchStore((s) => s.line);
  const upload = useWorkbenchStore((s) => s.upload);
  const setRunning = useWorkbenchStore((s) => s.setRunning);
  const code = useWorkbenchStore((s) => s.code);
  const setCode = useWorkbenchStore((s) => s.setCode);
  const diagnostics = useWorkbenchStore((s) => s.diagnostics);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  // a compiler message was tapped: put the cursor at the start of its line
  const goToLine = (n: number) => {
    const el = editor.current;
    if (!el) return;
    const at = el.value.split('\n').slice(0, n - 1).reduce((sum, l) => sum + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(at, at);
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
        <button type="button" className={`run-btn${busy ? ' is-on' : ''}`} aria-label={busy ? t('dock.stop') : t('dock.run')} onClick={() => (busy ? setRunning(false) : upload())}>
          {busy
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>}
          <span className="run-btn__text" aria-hidden>{busy ? t('dock.stop') : t('dock.run')}</span>
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
      {running ? (
        <pre className="code"><code>{code.split('\n').map((text, i) => (
          <span key={i} className={`code__line${activeLine === i + 1 ? ' is-running' : ''}`} aria-current={activeLine === i + 1 ? 'step' : undefined}>
            <span className="code__no" aria-hidden>{i + 1}</span>{text || ' '}{'\n'}
          </span>
        ))}</code></pre>
      ) : (
        <CodeEditor code={code} onChange={setCode} errorLines={new Set(diagnostics.filter((d) => d.severity === 'error').map((d) => d.line))} editor={editor} />
      )}
      {!running && diagnostics.length > 0 && (
        <ul className="diagnostics" aria-label={t('code.messages')}>
          {diagnostics.map((d, i) => (
            <li key={i} className={`diagnostic is-${d.severity}`}>
              <button type="button" onClick={() => goToLine(d.line)}>
                <b>{t('code.line').replace('{n}', String(d.line))}</b> <span>{d.message}</span>
                {d.hint && <small>{d.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <SerialMonitor expanded={panel === 'serial'} onExpand={() => onPanel(panel === 'serial' ? null : 'serial')} />
    </section>
  );
}

// The sketch editor: line numbers beside a plain text area (no autocorrect; Tab indents by two spaces).
// Lines with compiler errors get a red number.
function CodeEditor({ code, onChange, errorLines, editor }: { code: string; onChange(c: string): void; errorLines: Set<number>; editor: RefObject<HTMLTextAreaElement | null> }) {
  const gutter = useRef<HTMLDivElement>(null);
  const count = code.split('\n').length;
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget, { selectionStart: a, selectionEnd: b } = el;
    onChange(el.value.slice(0, a) + '  ' + el.value.slice(b));
    requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
  };
  return (
    <div className="code code--edit">
      <div className="code__gutter" ref={gutter} aria-hidden>
        {Array.from({ length: count }, (_, i) => <span key={i} className={errorLines.has(i + 1) ? 'is-error' : ''}>{i + 1}</span>)}
      </div>
      <textarea ref={editor} value={code} aria-label={t('code.editor')} wrap="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off"
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
        onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }} />
    </div>
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
