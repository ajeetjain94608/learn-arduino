import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { GlErrorBoundary } from './GlErrorBoundary';

function Boom(): never { throw new Error('Error creating WebGL context.'); }

test('if the 3D view cannot be created, the app shows a reload card instead of going blank', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const onReload = vi.fn();
  render(<GlErrorBoundary onReload={onReload}><Boom /></GlErrorBoundary>);
  fireEvent.click(screen.getByRole('button', { name: 'Tap to reload 3D' }));
  expect(onReload).toHaveBeenCalledOnce();
  spy.mockRestore();
});

test('renders its children when nothing goes wrong', () => {
  render(<GlErrorBoundary onReload={() => {}}><p>scene</p></GlErrorBoundary>);
  expect(screen.getByText('scene')).toBeInTheDocument();
});
