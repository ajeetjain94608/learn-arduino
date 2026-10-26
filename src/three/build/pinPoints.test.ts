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

describe('modules on the bench', () => {
  it("a module's pin is at the module's place plus the pin's offset", () => {
    const servo = { id: 'servo1', type: 'servo' as const, params: {}, at: { x: 30, z: 75 } };
    const p = pinWorld('servo1.SIG', [servo]);
    expect(p.x).toBeCloseTo(30 + 2.54);
    expect(p.z).toBeCloseTo(75 + 16);
  });
  it("the bench's keep-out zones are where the UNO and the breadboard really are", async () => {
    const { KEEP_OUT } = await import('../../circuit/parts');
    expect([KEEP_OUT[0].x, KEEP_OUT[0].z]).toEqual([BLINK.board[0], BLINK.board[2]]);
    expect([KEEP_OUT[1].x, KEEP_OUT[1].z]).toEqual([BLINK.breadboard[0], BLINK.breadboard[2]]);
  });
});

describe('modules turned on the bench', () => {
  it("a turned module's pins are at its place plus the pin's offset, turned", () => {
    const base = { id: 'servo1', type: 'servo' as const, params: {}, at: { x: 30, z: 75 } };
    const flat = pinWorld('servo1.SIG', [base]);
    const turned = pinWorld('servo1.SIG', [{ ...base, rot: 90 }]);
    // SIG is 16 mm towards the viewer from the centre; turned a quarter it is 16 mm to the left?? no: (2.54, 16) → (−16, 2.54)
    expect(turned.x).toBeCloseTo(30 - (flat.z - 75), 5);
    expect(turned.z).toBeCloseTo(75 + (flat.x - 30), 5);
    expect(pinWorld('servo1.SIG', [{ ...base, rot: 360 }]).x).toBeCloseTo(flat.x, 5);
  });
});
