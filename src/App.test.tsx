import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

// jsdom has no WebGL; the 3D scene is covered by the Playwright tests.
vi.mock('./three/workbench/Workbench', () => ({ Workbench: () => null }));
import App from './App';
import { t } from './i18n/en';
import { CREDITS } from './legal/credits';

test('shows the app name', () => {
  render(<App />);
  expect(screen.getByText(t('app.name'))).toBeInTheDocument();
  expect(t('app.name')).toBe('RoboQuest');
});

test('credits the Uno design files exactly as the licence requires', () => {
  expect(CREDITS).toContain('Board layout based on Arduino UNO Rev3 design files (CC BY-SA 4.0)');
});
