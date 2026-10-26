import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// OS-level reduced-motion preference; Stage 8 adds an in-app setting that overrides it.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(QUERY); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(QUERY).matches,
    () => false,
  );
}

export const isTestMode = (): boolean => new URLSearchParams(location.search).has('test');
// ?test&thumb: no floor and no background, for baking the project pictures (tools/bake-projects.mjs)
export const isThumbMode = (): boolean => isTestMode() && new URLSearchParams(location.search).has('thumb');
// ?test&thumb&solo=<part | uno | breadboard>: only that one thing is drawn — no UNO, breadboard, wires or props (the pictures of
// single components, tools/bake-components.mjs)
export const soloMode = (): string | null => (isThumbMode() ? new URLSearchParams(location.search).get('solo') : null);
