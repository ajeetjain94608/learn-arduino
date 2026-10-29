import { useState } from 'react';
import { t, type StringKey } from '../../i18n/en';

const ICONS: Record<string, string> = {
  home: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  projects: 'M4 5h16v14H4zM4 9h16M9 5v14',
  components: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  build: 'M14 6l4 4-8 8H6v-4zM12 8l4 4',
  tutorials: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M8 7h8M8 11h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
};

// shorter names for the phone's bottom bar, where six items share the width (the full name stays for screen readers)
const SHORT: Record<string, string | undefined> = { components: 'Parts', tutorials: 'Learn' };

export type Screen = 'home' | 'projects' | 'components' | 'build';

// Main navigation: a bottom bar on phones held upright, an icon rail on the left otherwise.
// Home, Projects, Components and Build are pages; Tutorials is the written tutorials (their own pages, /learn/); Settings holds
// themes and About.
export function NavBar({ current = 'home', onNavigate, onSettings }: { current?: Screen; onNavigate?(s: Screen): void; onSettings(): void }) {
  const [expanded, setExpanded] = useState(false); // rail only: icons, or icons + names
  return (
    <>
      <nav className={`navbar${expanded ? ' is-expanded' : ''}`} aria-label={t('nav.main')}>
        <button type="button" className="navbar__toggle" aria-label={t(expanded ? 'nav.collapse' : 'nav.expand')} aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={expanded ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg>
        </button>
        {(['home', 'projects', 'components', 'build', 'settings'] as const).map((id) => (
          <button key={id} type="button" aria-label={t(`nav.${id}` as StringKey)} aria-current={id === current ? 'page' : undefined}
            className={id === current ? 'is-on' : ''}
            onClick={() => {
              setExpanded(false);
              if (id === 'settings') onSettings();
              else onNavigate?.(id);
            }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[id]} /></svg>
            <span className={SHORT[id] ? "navbar__long" : undefined}>{t(`nav.${id}` as StringKey)}</span>{SHORT[id] && <span className="navbar__short" aria-hidden>{SHORT[id]}</span>}
          </button>
        )).flatMap((b, i) => (i === 2 ? [b, ( // after Components: the written tutorials, a plain link (search engines follow it too)
          <a key="tutorials" href="/learn/" aria-label={t('nav.tutorials')} onClick={() => setExpanded(false)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS.tutorials} /></svg>
            <span className="navbar__long">{t('nav.tutorials')}</span><span className="navbar__short" aria-hidden>{SHORT.tutorials}</span>
          </a>
        )] : [b]))}
      </nav>
    </>
  );
}
