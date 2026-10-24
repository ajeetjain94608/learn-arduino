import { create } from 'zustand';
import { storage } from '../lib/storage';
import { isThemeName, type ThemeName } from './themes';

const KEY = 'rq.theme';

function apply(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

const saved = storage.get(KEY);
const initial: ThemeName = isThemeName(saved) ? saved : 'lab';
apply(initial);

export const useThemeStore = create<{ theme: ThemeName; setTheme(t: ThemeName): void }>((set) => ({
  theme: initial,
  setTheme(theme) {
    storage.set(KEY, theme);
    apply(theme);
    set({ theme });
  },
}));
