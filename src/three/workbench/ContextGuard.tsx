import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/en';

const GIVE_UP_MS = 3000;
type GlState = 'ok' | 'lost' | 'failed';

// Watches the WebGL canvas. Android can drop the GPU context when the app is backgrounded or memory is low:
// show "Restoring 3D…" while three.js recovers, and offer a reload (fresh Canvas) if it never comes back.
export function useContextGuard() {
  const [state, setState] = useState<GlState>('ok');
  const [canvasKey, setCanvasKey] = useState(0);
  const timer = useRef<number>(undefined);
  const detach = useRef<() => void>(undefined);

  const onCanvas = useCallback((canvas: HTMLCanvasElement) => {
    detach.current?.();
    const lost = () => {
      setState('lost');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('failed'), GIVE_UP_MS);
    };
    const restored = () => { window.clearTimeout(timer.current); setState('ok'); };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    detach.current = () => { canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); };
  }, []);

  useEffect(() => () => { window.clearTimeout(timer.current); detach.current?.(); }, []);

  const reload = useCallback(() => { window.clearTimeout(timer.current); setState('ok'); setCanvasKey((k) => k + 1); }, []);
  return { state, canvasKey, onCanvas, reload };
}

export function GlGuardCard({ state, onReload }: { state: GlState; onReload(): void }) {
  if (state === 'ok') return null;
  return (
    <div className="gl-guard" data-testid="gl-guard" role="status">
      {state === 'lost' ? <p>{t('gl.restoring')}</p> : <button type="button" onClick={onReload}>{t('gl.reload')}</button>}
    </div>
  );
}
