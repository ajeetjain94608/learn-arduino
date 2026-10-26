import { describe, expect, it } from 'vitest';
import { coversOf, footprintOf, canTurn, TURNS } from './parts';
import type { PartInstance, Row } from './types';

const at = (type: PartInstance['type'], col: number, row: Row, rot = 0, params = {}): PartInstance => ({ id: `${type}1`, type, params, at: { col, row }, rot });

describe('parts turned in the breadboard (a quarter turn around the first leg)', () => {
  it('unturned, nothing changes', () => {
    expect(footprintOf(at('led', 5, 'a'))).toEqual({ A: '5a', K: '6a' });
    expect(footprintOf(at('led', 5, 'a', 0))).toEqual({ A: '5a', K: '6a' });
  });
  it('a quarter turn lays the part along the column strip: the LED legs go to rows a and b', () => {
    expect(footprintOf(at('led', 5, 'a', 90))).toEqual({ A: '5a', K: '5b' });
  });
  it('a half turn flips it: the cathode comes to the left of the anode', () => {
    expect(footprintOf(at('led', 5, 'a', 180))).toEqual({ A: '5a', K: '4a' });
  });
  it('three quarters points it the other way (up the rows) — it only fits where there is room', () => {
    expect(footprintOf(at('led', 5, 'a', 270))).toBeNull();               // row above a does not exist
    expect(footprintOf(at('led', 5, 'c', 270))).toEqual({ A: '5c', K: '5b' });
  });
  it('a part never leaves the board or its half of it', () => {
    expect(footprintOf(at('led', 30, 'a', 0))).toBeNull();                 // off the right end
    expect(footprintOf(at('led', 1, 'a', 180))).toBeNull();                // off the left end
    expect(footprintOf(at('resistor', 3, 'a', 90))).toEqual({ 1: '3a', 2: '3e' });   // five rows: all of the top half
    expect(footprintOf(at('resistor', 3, 'c', 90))).toBeNull();            // would cross the middle gap
    expect(footprintOf(at('led', 5, 'e', 90))).toBeNull();                // e → f crosses the gap
  });
  it('the push button does not turn (it straddles the gap)', () => {
    expect(canTurn('button')).toBe(false);
    expect(footprintOf(at('button', 5, 'e', 90))).toBeNull();
    expect(footprintOf(at('button', 5, 'e', 0))).toEqual({ 1: '5e', 2: '7e', 3: '5f', 4: '7f' });
    for (const t of ['led', 'resistor', 'pot', 'rgb', 'buzzer', 'ldr', 'tmp36', 'fsr', 'diode', 'npn', 'traffic'] as const) expect(canTurn(t), t).toBe(true);
    expect(TURNS).toEqual([0, 90, 180, 270]);
  });
  it('the holes a turned body covers turn with it', () => {
    expect(coversOf(at('resistor', 3, 'a', 90)).sort()).toEqual(['3a', '3b', '3c', '3d', '3e']);
    expect(coversOf(at('resistor', 3, 'a', 0)).sort()).toEqual(['3a', '4a', '5a', '6a', '7a']);
    expect(coversOf(at('resistor', 3, 'c', 90))).toEqual([]);
  });
  it('a turned pot covers its turned block', () => {
    const c = coversOf(at('pot', 5, 'a', 90));    // legs run down the rows; the 5 × 3 body turns into 3 columns × 5 rows
    expect(c).toHaveLength(15);
    expect(c).toContain('5a'); expect(c).toContain('5e');
  });
});
