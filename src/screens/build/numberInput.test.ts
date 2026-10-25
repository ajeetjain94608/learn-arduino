import { expect, it } from 'vitest';
import { commitNumber } from './numberInput';

it('the number box clamps and ignores junk', () => {
  expect(commitNumber('', 0, 1023, 300)).toBe(300);
  expect(commitNumber('abc', 0, 1023, 300)).toBe(300);
  expect(commitNumber('2000', 0, 1023, 300)).toBe(1023);
  expect(commitNumber('-5', 0, 1023, 300)).toBe(0);
  expect(commitNumber('512', 0, 1023, 300)).toBe(512);
  expect(commitNumber(' 12.5 ', 0, 1023, 300)).toBe(12.5);
});
