import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useContextGuard } from './ContextGuard';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

test('reports a lost context, then gives up after 3 s', () => {
  const canvas = document.createElement('canvas');
  const { result } = renderHook(useContextGuard, { wrapper: strict });
  act(() => result.current.onCanvas(canvas));
  act(() => { canvas.dispatchEvent(new Event('webglcontextlost')); });
  expect(result.current.state).toBe('lost');
  act(() => { vi.advanceTimersByTime(3000); });
  expect(result.current.state).toBe('failed');
});

test('a restored context clears the warning', () => {
  const canvas = document.createElement('canvas');
  const { result } = renderHook(useContextGuard, { wrapper: strict });
  act(() => result.current.onCanvas(canvas));
  act(() => { canvas.dispatchEvent(new Event('webglcontextlost')); });
  act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
  act(() => { vi.advanceTimersByTime(5000); });
  expect(result.current.state).toBe('ok');
});

// React StrictMode mounts, unmounts and re-mounts; the canvas may be reported in between.
test('keeps listening when the canvas is reported before a StrictMode re-mount', () => {
  const canvas = document.createElement('canvas');
  let report: ((c: HTMLCanvasElement) => void) | null = null;
  const { result } = renderHook(() => {
    const g = useContextGuard();
    if (!report) { report = g.onCanvas; g.onCanvas(canvas); } // reported during the very first render pass
    return g;
  }, { wrapper: strict });
  act(() => { canvas.dispatchEvent(new Event('webglcontextlost')); });
  expect(result.current.state).toBe('lost');
});

test('reload bumps the canvas key and clears the error', () => {
  const canvas = document.createElement('canvas');
  const { result } = renderHook(useContextGuard, { wrapper: strict });
  act(() => result.current.onCanvas(canvas));
  act(() => { canvas.dispatchEvent(new Event('webglcontextlost')); vi.advanceTimersByTime(3000); });
  const key = result.current.canvasKey;
  act(() => result.current.reload());
  expect(result.current.state).toBe('ok');
  expect(result.current.canvasKey).toBe(key + 1);
});
