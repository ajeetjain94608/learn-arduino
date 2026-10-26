import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useInspectStore } from '../../state/inspectStore';
import { useWorkbenchStore } from '../../state/workbenchStore';
import { PartTooltip } from './PartTooltip';

afterEach(() => { cleanup(); useInspectStore.setState({ hovered: null, pointer: null, selected: null, selectedAt: null }); useWorkbenchStore.setState({ labels: true }); });

test('pointing at a part shows its name only while Labels are on', () => {
  const { queryByTestId } = render(<div><PartTooltip /></div>);
  act(() => useInspectStore.getState().hover('led1', { x: 20, y: 20 }));
  expect(queryByTestId('part-tooltip')?.textContent).toContain('LED');
  act(() => useWorkbenchStore.setState({ labels: false }));
  expect(queryByTestId('part-tooltip')).toBeNull();
  act(() => useWorkbenchStore.setState({ labels: true }));
  expect(queryByTestId('part-tooltip')).not.toBeNull();
});

test('a tapped part still explains itself with Labels off', () => {
  useWorkbenchStore.setState({ labels: false });
  const { queryByTestId } = render(<div><PartTooltip /></div>);
  act(() => useInspectStore.getState().select('led1', { x: 20, y: 20 }));
  expect(queryByTestId('part-tooltip')).not.toBeNull();
});
