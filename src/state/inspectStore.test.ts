import { beforeEach, expect, test } from 'vitest';
import { useInspectStore } from './inspectStore';

const initial = useInspectStore.getState();
beforeEach(() => useInspectStore.setState(initial, true));

test('hovering records the part and the pointer', () => {
  useInspectStore.getState().hover('ZU4', { x: 10, y: 20 });
  expect(useInspectStore.getState()).toMatchObject({ hovered: 'ZU4', pointer: { x: 10, y: 20 } });
});

test('leaving a different part does not clear the current hover', () => {
  const s = useInspectStore.getState();
  s.hover('ZU4', { x: 1, y: 1 });
  s.unhover('Y1');
  expect(useInspectStore.getState().hovered).toBe('ZU4');
  s.unhover('ZU4');
  expect(useInspectStore.getState()).toMatchObject({ hovered: null, pointer: null });
});

test('a tap remembers where it happened, for the name card', () => {
  useInspectStore.getState().select('ZU4', { x: 300, y: 200 });
  expect(useInspectStore.getState()).toMatchObject({ selected: 'ZU4', selectedAt: { x: 300, y: 200 } });
  useInspectStore.getState().select(null);
  expect(useInspectStore.getState()).toMatchObject({ selected: null, selectedAt: null });
});

test('selecting the same part twice deselects it', () => {
  const s = useInspectStore.getState();
  s.select('Y1');
  expect(useInspectStore.getState().selected).toBe('Y1');
  s.select('Y1');
  expect(useInspectStore.getState().selected).toBeNull();
});
