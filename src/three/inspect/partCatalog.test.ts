import { expect, test } from 'vitest';
import { en } from '../../i18n/en';
import { topElements } from '../boards/uno/layout';
import { KINDS, NO_BODY_PACKAGES, PART_OF } from './partCatalog';

test('every Uno part with a 3D body is inspectable', () => {
  const missing = topElements().filter((e) => !NO_BODY_PACKAGES.has(e.pkg) && !PART_OF[e.name]).map((e) => `${e.name} (${e.pkg})`);
  expect(missing).toEqual([]);
});

test('every kind of part has a name, a one-line summary and a full explanation', () => {
  for (const kind of Object.keys(KINDS)) {
    for (const k of ['name', 'line', 'text']) expect(en).toHaveProperty(`part.${kind}.${k}`);
  }
});

test('the big chip and the crystal are described as what they are', () => {
  expect(PART_OF.ZU4).toBe('atmega328');
  expect(PART_OF.Y1).toBe('crystal');
  expect(en['part.atmega328.name']).toBe('ATmega328P');
});
