import { useCallback, useEffect, useState } from 'react';

// Every page has an address after the # (so links, reloads and the Back button work, and the app needs no server
// routes): #/ · #/projects · #/projects/<id> · #/components · #/components/<type> · #/build
export type Route =
  | { page: 'home' }
  | { page: 'projects' }
  | { page: 'project'; id: string }
  | { page: 'components' }
  | { page: 'component'; type: string }
  | { page: 'build' };

// decodeURIComponent throws on a broken escape (%E0%A4%A): then the address names nothing
function decode(s: string): string | null { try { return decodeURIComponent(s); } catch { return null; } }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#?\/?/, '').split('/').filter(Boolean);
  const [a, b] = parts;
  if (a === 'projects' && parts.length === 1) return { page: 'projects' };
  if (a === 'projects' && parts.length === 2) { const id = decode(b); return id === null ? { page: 'projects' } : { page: 'project', id }; }
  if (a === 'components' && parts.length === 1) return { page: 'components' };
  if (a === 'components' && parts.length === 2) { const type = decode(b); return type === null ? { page: 'components' } : { page: 'component', type }; }
  if (a === 'build' && parts.length === 1) return { page: 'build' };
  return { page: 'home' };
}

export function routeHash(r: Route): string {
  switch (r.page) {
    case 'project': return `#/projects/${encodeURIComponent(r.id)}`;
    case 'component': return `#/components/${encodeURIComponent(r.type)}`;
    case 'home': return '#/';
    default: return `#/${r.page}`;
  }
}

// The page the address shows, and a way to go somewhere (a new history entry, so Back returns).
export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => { setRoute(parseRoute(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: Route) => { if (location.hash !== routeHash(r)) location.hash = routeHash(r); }, []);
  return [route, go];
}
