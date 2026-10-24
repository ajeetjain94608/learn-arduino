import { beforeEach, expect, test } from 'vitest';
import { useWorkbenchStore } from './workbenchStore';

const initial = useWorkbenchStore.getState();
beforeEach(() => useWorkbenchStore.setState(initial, true));

test('starts on the board view with labels on and nothing running', () => {
  expect(useWorkbenchStore.getState()).toMatchObject({ view: 'board', labels: true, showCurrent: false, running: false, pinHigh: false });
});

test('turning current on also shows the circuit and starts the program', () => {
  useWorkbenchStore.getState().toggleCurrent();
  expect(useWorkbenchStore.getState()).toMatchObject({ showCurrent: true, view: 'circuit', running: true });
});

test('turning current off leaves view and program alone', () => {
  const s = useWorkbenchStore.getState();
  s.toggleCurrent();
  s.toggleCurrent();
  expect(useWorkbenchStore.getState()).toMatchObject({ showCurrent: false, view: 'circuit', running: true });
});

test('stopping the program drops the pin LOW', () => {
  const s = useWorkbenchStore.getState();
  s.setRunning(true);
  s.setPinHigh(true);
  s.setRunning(false);
  expect(useWorkbenchStore.getState().pinHigh).toBe(false);
});

test('reset view bumps a counter the camera listens to, without changing the view', () => {
  const before = useWorkbenchStore.getState().resetTick;
  useWorkbenchStore.getState().resetView();
  expect(useWorkbenchStore.getState().resetTick).toBe(before + 1);
  expect(useWorkbenchStore.getState().view).toBe('board');
});

test('labels toggle', () => {
  useWorkbenchStore.getState().toggleLabels();
  expect(useWorkbenchStore.getState().labels).toBe(false);
});
