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
