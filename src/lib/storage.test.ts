import { afterEach, expect, test, vi } from 'vitest';
import { storage } from './storage';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test('round-trips a value', () => {
  storage.set('k', 'v');
  expect(storage.get('k')).toBe('v');
});

test('returns null instead of throwing when reading is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
  expect(storage.get('k')).toBeNull();
});

test('swallows errors when writing is blocked', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
  expect(() => storage.set('k', 'v')).not.toThrow();
});
