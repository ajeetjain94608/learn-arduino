import { expect, it } from 'vitest';
import { CREDITS } from './credits';

it('About links to the public source of the compiler we ship (GPL)', () => {
  expect(CREDITS.join(' ')).toContain('github.com/ajeetjain94608/avr-toolchain-wasm');
});

it('About credits everything the compiler and simulator are built from', () => {
  const all = CREDITS.join('\n');
  for (const name of ['GCC', 'binutils', 'GPL', 'avr8js', 'MIT', 'Arduino AVR core', 'AVR-LibC']) expect(all, name).toContain(name);
});
