import { useEffect, useState } from 'react';
import { t, type StringKey } from '../../i18n/en';

const ICONS: Record<string, string> = {
  home: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  projects: 'M4 5h16v14H4zM4 9h16M9 5v14',
  components: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  build: 'M14 6l4 4-8 8H6v-4zM12 8l4 4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
};

// Main navigation: a bottom bar on phones held upright, an icon rail on the left otherwise.
// Projects, Components and Build arrive with the component library; Settings holds themes and About.
export function NavBar({ onSettings }: { onSettings(): void }) {
  const [toast, setToast] = useState(false);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(false), 1800); return () => clearTimeout(id); }, [toast]);
  return (
    <>
      <nav className="navbar" aria-label={t('nav.main')}>
        {(['home', 'projects', 'components', 'build', 'settings'] as const).map((id) => (
          <button key={id} type="button" aria-label={t(`nav.${id}` as StringKey)} aria-current={id === 'home' ? 'page' : undefined}
            className={id === 'home' ? 'is-on' : ''}
            onClick={() => (id === 'settings' ? onSettings() : id !== 'home' && setToast(true))}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[id]} /></svg>
            <span>{t(`nav.${id}` as StringKey)}</span>
          </button>
        ))}
      </nav>
      {toast && <div className="toast" role="status">{t('toast.soon')}</div>}
    </>
  );
}
