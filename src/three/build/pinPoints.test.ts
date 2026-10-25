import { describe, expect, it } from 'vitest';
import { colX, holeLocal, RAIL_Z } from '../breadboard/breadboardGeometry';
import { BLINK, headerTopWorld } from '../scenes/blinkLayout';
import { pinWorld } from './pinPoints';

describe('where connection points are in 3D', () => {
  it('breadboard hole 12a matches holeLocal + the breadboard position', () => {
    const [x, y, z] = holeLocal(12, 'a');
    expect(pinWorld('bb.12a').toArray()).toEqual([x + BLINK.breadboard[0], y + BLINK.breadboard[1], z + BLINK.breadboard[2]]);
  });

  it('rails: T- is the outer rail beside row a, B+ the outer rail beside row j', () => {
    expect(pinWorld('bb.T-2').z).toBeCloseTo(RAIL_Z[0] + BLINK.breadboard[2]);
    expect(pinWorld('bb.B+2').z).toBeCloseTo(RAIL_Z[3] + BLINK.breadboard[2]);
    expect(pinWorld('bb.T+9').x).toBeCloseTo(colX(9) + BLINK.breadboard[0]);
  });

  it('uno.D13 sits on the header', () => {
    expect(pinWorld('uno.D13').toArray()).toEqual(headerTopWorld('13').toArray());
    expect(pinWorld('uno.3V3').toArray()).toEqual(headerTopWorld('3.3V').toArray());
    expect(pinWorld('uno.A0').toArray()).toEqual(headerTopWorld('A0').toArray());
  });
});
