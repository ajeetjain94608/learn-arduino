import { beforeEach, expect, test, vi } from 'vitest';

// The store reads storage when its module loads, so each test imports a fresh copy.
async function freshStore() {
  vi.resetModules();
  return (await import('./themeStore')).useThemeStore;
}

beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.theme; });

test('defaults to the Lab theme', async () => {
  const store = await freshStore();
  expect(store.getState().theme).toBe('lab');
  expect(document.documentElement.dataset.theme).toBe('lab');
});

test('switching theme persists it and updates the document', async () => {
  const store = await freshStore();
  store.getState().setTheme('night');
  expect(localStorage.getItem('rq.theme')).toBe('night');
  expect(document.documentElement.dataset.theme).toBe('night');
});

test('restores a saved theme', async () => {
  localStorage.setItem('rq.theme', 'mint');
  const store = await freshStore();
  expect(store.getState().theme).toBe('mint');
});

test('ignores an unknown saved theme', async () => {
  localStorage.setItem('rq.theme', 'purple');
  const store = await freshStore();
  expect(store.getState().theme).toBe('lab');
});

test('scene tokens match the approved spike values', async () => {
  const { THEMES } = await import('./themes');
  expect(THEMES.lab.scene).toEqual({ bg: '#E8EDF2', gridFine: '#DDE4EB', gridMajor: '#CDD6E0', shadow: '#1E2B3A', shadowOpacity: 0.16, ink: '#122036', hemi: 1.35 });
  expect(THEMES.night.scene.bg).toBe('#121826');
  expect(THEMES.mint.scene.ink).toBe('#0F241B');
});
