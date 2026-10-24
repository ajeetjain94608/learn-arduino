// Our own identity: deliberately unlike the reference site's cream/navy look.
// CSS tokens for each theme live in src/styles/themes.css; these are the 3D scene tokens.
export type ThemeName = 'lab' | 'night' | 'mint';

export type SceneTokens = {
  bg: string;
  gridFine: string;
  gridMajor: string;
  shadow: string;
  shadowOpacity: number;
  ink: string;
  hemi: number;
};

export const THEMES: Record<ThemeName, { scene: SceneTokens }> = {
  lab: { scene: { bg: '#E8EDF2', gridFine: '#DDE4EB', gridMajor: '#CDD6E0', shadow: '#1E2B3A', shadowOpacity: 0.16, ink: '#122036', hemi: 1.35 } },
  night: { scene: { bg: '#121826', gridFine: '#182032', gridMajor: '#212B41', shadow: '#000000', shadowOpacity: 0.45, ink: '#03050A', hemi: 1.0 } },
  mint: { scene: { bg: '#E9F5EF', gridFine: '#DBEDE3', gridMajor: '#C9E2D5', shadow: '#123528', shadowOpacity: 0.15, ink: '#0F241B', hemi: 1.35 } },
};

export const isThemeName = (v: unknown): v is ThemeName => typeof v === 'string' && v in THEMES;
