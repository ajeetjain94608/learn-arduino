import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { t } from '../../i18n/en';
import { useQualityStore } from '../../state/qualityStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { useThemeStore } from '../../theme/themeStore';
import type { ThemeName } from '../../theme/themes';

const SWATCHES: { name: ThemeName; bg: string; accent: string }[] = [
  { name: 'lab', bg: '#E8EDF2', accent: '#2563EB' },
  { name: 'night', bg: '#121826', accent: '#22D3EE' },
  { name: 'mint', bg: '#E9F5EF', accent: '#10B981' },
];

// Dev builds and the on-device test build (vite --mode device) show the fps chip; tapping it cycles the quality tier.
export const SHOW_FPS = import.meta.env.DEV || import.meta.env.VITE_SHOW_FPS === '1';

function FpsChip() {
  const { tier, cycle } = useQualityStore();
  return <button type="button" className="fps" onClick={cycle} title="Quality tier (tap to change)"><span id="fps">-- fps</span> · {tier}</button>;
}

// Only the brand and a menu button sit over the 3D view; every other option lives in the side menu.
export function TopBar({ onMenu }: { onMenu(): void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand__logo" aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="7" width="14" height="11" rx="3" /><path d="M12 7V4M9 12h.01M15 12h.01M9.5 15.5h5" /></svg>
        </div>
        <div><h1>{t('app.name')}</h1><p>{t('app.tagline')}</p></div>
      </div>
      <div className="topbar__right">
        {SHOW_FPS && <FpsChip />}
        <button type="button" className="icon-btn" aria-label={t('menu.open')} onClick={onMenu}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
    </header>
  );
}

export function SideMenu({ open, onClose, onAbout }: { open: boolean; onClose(): void; onAbout(): void }) {
  const { theme, setTheme } = useThemeStore();
  const { view, setView } = useWorkbenchStore();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="side-menu__backdrop" onClick={onClose}>
      <aside className="side-menu" role="dialog" aria-modal="true" aria-label={t('menu.open')} onClick={(e) => e.stopPropagation()}>
        <div className="side-menu__head">
          <h2>{t('menu.open')}</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label={t('menu.close')} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <h3>{t('menu.view')}</h3>
        <div className="seg" role="group">
          {(['board', 'circuit'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'is-on' : ''} onClick={() => { setView(v); onClose(); }}>{t(`view.${v}`)}</button>
          ))}
        </div>

        <h3>{t('menu.theme')}</h3>
        <div className="side-menu__themes">
          {SWATCHES.map((s) => (
            <button key={s.name} type="button" aria-label={t(`theme.${s.name}`)} aria-pressed={theme === s.name}
              className={`side-menu__theme${theme === s.name ? ' is-on' : ''}`} onClick={() => setTheme(s.name)}>
              <i style={{ background: `linear-gradient(135deg, ${s.bg} 50%, ${s.accent} 50%)` }} aria-hidden />
              <span>{t(`themeName.${s.name}`)}</span>
            </button>
          ))}
        </div>

        <button type="button" className="side-menu__item" onClick={() => { onClose(); onAbout(); }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></svg>
          {t('about.open')}
        </button>
      </aside>
    </div>
  );
}

// Development aid: writes the frame rate into the fps chip.
export function FpsProbe() {
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt; acc.current.n++;
    if (acc.current.t < 0.5) return;
    const el = document.getElementById('fps');
    if (el) el.textContent = `${Math.round(acc.current.n / acc.current.t)} fps`;
    acc.current = { t: 0, n: 0 };
  });
  return null;
}
