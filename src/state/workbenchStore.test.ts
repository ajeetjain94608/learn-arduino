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

test('resetting the board starts a boot: pin 13 drops LOW and the reset counter moves on', () => {
  const s = useWorkbenchStore.getState();
  s.setRunning(true);
  s.setPinHigh(true);
  s.resetBoard();
  expect(useWorkbenchStore.getState()).toMatchObject({ booting: true, pinHigh: false, running: true, resetCount: 1 });
});

test('toolbar camera commands are queued with an increasing sequence number', () => {
  const s = useWorkbenchStore.getState();
  s.nudgeCamera('rotate', 0.5);
  const first = useWorkbenchStore.getState().cameraCmd!;
  expect(first).toMatchObject({ kind: 'rotate', amount: 0.5 });
  s.nudgeCamera('zoom', 1.25);
  expect(useWorkbenchStore.getState().cameraCmd).toMatchObject({ kind: 'zoom', amount: 1.25, seq: first.seq + 1 });
});
