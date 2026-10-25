import { describe, expect, it } from 'vitest';
import { PART_DEFS } from './parts';

describe('part footprints', () => {
  it('footprints land in the right holes', () => {
    expect(PART_DEFS.led.footprint({ col: 10, row: 'a' }, {})).toEqual({ A: '10a', K: '11a' });
    expect(PART_DEFS.resistor.footprint({ col: 11, row: 'b' }, {})).toEqual({ 1: '11b', 2: '15b' });
    expect(PART_DEFS.pot.footprint({ col: 5, row: 'a' }, {})).toEqual({ 1: '5a', W: '7a', 2: '9a' });
    expect(PART_DEFS.button.footprint({ col: 20, row: 'e' }, {})).toEqual({ 1: '20e', 2: '22e', 3: '20f', 4: '22f' });
  });

  it('the button must straddle the gap (row e)', () => {
    expect(PART_DEFS.button.footprint({ col: 20, row: 'a' }, {})).toBeNull();
  });

  it('a footprint off the end of the board is null', () => {
    expect(PART_DEFS.resistor.footprint({ col: 28, row: 'a' }, {})).toBeNull();
    expect(PART_DEFS.led.footprint({ col: 30, row: 'a' }, {})).toBeNull();
  });

  it('parameters and inputs have the spec values', () => {
    expect(PART_DEFS.resistor.params[0]).toMatchObject({ key: 'ohms', options: [220, 1000, 10000], default: 220 });
    expect(PART_DEFS.led.params[0]).toMatchObject({ key: 'color', options: ['red', 'green', 'yellow', 'blue', 'white'], default: 'red' });
    expect(PART_DEFS.pot.inputs[0]).toMatchObject({ key: 'position', min: 0, max: 1 });
    expect(PART_DEFS.button.inputs[0]).toMatchObject({ key: 'pressed', min: 0, max: 1, step: 1 });
  });
});

describe('what a part covers on the breadboard (for placing parts without overlap)', () => {
  it('a resistor covers the holes under its body, an LED only its legs', () => {
    expect(PART_DEFS.resistor.covers({ col: 1, row: 'a' }, {})).toEqual(['1a', '2a', '3a', '4a', '5a']);
    expect(PART_DEFS.led.covers({ col: 10, row: 'a' }, {})).toEqual(['10a', '11a']);
  });

  it('the pot and button bodies cover a block of holes on their side(s)', () => {
    expect(PART_DEFS.pot.covers({ col: 5, row: 'a' }, {})).toEqual(expect.arrayContaining(['5a', '9a', '7b', '7c']));
    expect(PART_DEFS.pot.covers({ col: 5, row: 'e' }, {})).not.toContain('5f'); // stays on its side of the gap
    expect(PART_DEFS.button.covers({ col: 20, row: 'e' }, {})).toEqual(expect.arrayContaining(['20d', '21e', '22f', '21g']));
  });
});
