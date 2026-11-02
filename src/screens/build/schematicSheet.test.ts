import { describe, expect, it } from 'vitest';
import { boxOf, defaultPlaces, orthogonal, sheetWires, snap, terminals, turn, type Placed, type Sym } from './schematicSheet';
import type { Nets } from './schematicLayout';

const twoPin: Sym = { w: 160, h: 80, terms: [{ pin: 'A', x: 20, y: 40, dx: -1, dy: 0 }, { pin: 'K', x: 140, y: 40, dx: 1, dy: 0 }] };
const nets = (groups: Record<string, string[]>): Nets => {
  const of = new Map<string, number>(), name = new Map<number, string>();
  Object.entries(groups).forEach(([n, refs], i) => { name.set(i, n); refs.forEach((r) => of.set(r, i)); });
  return { netOf: (r) => of.get(r) ?? -1 - r.length, nameOf: (r) => (of.has(r) ? name.get(of.get(r)!)! : null), colorOf: () => null };
};

describe('the schematic sheet', () => {
  it('snaps to the grid', () => { expect(snap(14)).toBe(10); expect(snap(16)).toBe(20); });
  it('turns a symbol in quarter turns about its middle', () => {
    expect(turn(20, 40, twoPin, 0)).toEqual([20, 40]);
    expect(turn(20, 40, twoPin, 180)).toEqual([140, 40]);
    const [x, y] = turn(20, 40, twoPin, 90);                       // the left pin goes to the top
    expect([x, y]).toEqual([80, -20]);
    const p: Placed = { id: 'r1', pos: { x: 100, y: 0, rot: 90 }, sym: twoPin };
    const [a, k] = terminals(p);
    expect([a.dx, a.dy]).toEqual([0, -1]);                          // it points up now
    expect([k.x, k.y]).toEqual([180, 100]);
    expect(boxOf(p)).toEqual({ x0: 140, y0: -40, x1: 220, y1: 120 }); // the box turns too
  });
  it('puts new symbols beside the UNO, level with their pin, never on top of each other', () => {
    const uno: Placed = { id: 'uno', pos: { x: 0, y: 0, rot: 0 }, sym: { w: 160, h: 320, terms: [] } };
    const places = defaultPlaces([
      { id: 'led1', sym: twoPin, order: 0, unoPin: { y: 100 }, enter: twoPin.terms[0] },
      { id: 'led2', sym: twoPin, order: 0, unoPin: { y: 100 }, enter: twoPin.terms[1] },
    ], uno, [uno]);
    expect(places.get('led1')).toEqual({ x: 250, y: 60, rot: 0 });   // its A pin level with the UNO pin
    const two = places.get('led2')!;
    expect(two.rot).toBe(180);                                       // its K comes in: turned round to face the UNO
    expect(two.y).toBeGreaterThanOrEqual(150);                       // below the first one
  });
  it('adds an elbow wherever a line would run diagonally', () => {
    expect(orthogonal([[0, 0], [30, 20], [30, 50]])).toEqual([[0, 0], [30, 0], [30, 20], [30, 50]]);
  });
  it('draws the drawn wires, routes the rest, flags power, dots junctions', () => {
    const terms = [
      { ref: 'uno.D13', id: 'uno', pin: 'D13', x: 150, y: 300, dx: 1, dy: 0 },
      { ref: 'led1.A', id: 'led1', pin: 'A', x: 270, y: 100, dx: -1, dy: 0 },
      { ref: 'r1.1', id: 'r1', pin: '1', x: 270, y: 200, dx: -1, dy: 0 },
      { ref: 'led1.K', id: 'led1', pin: 'K', x: 390, y: 100, dx: 1, dy: 0 },
      { ref: 'uno.GND', id: 'uno', pin: 'GND', x: 10, y: 120, dx: -1, dy: 0 },
    ];
    const n = nets({ D13: ['uno.D13', 'led1.A', 'r1.1'], GND: ['led1.K', 'uno.GND'] });
    const out = sheetWires(terms, n, [{ id: 's1', wire: 'w1', from: 'uno.D13', to: 'led1.A', pts: [[200, 300], [200, 100]] }]);
    expect(out.wires[0].drawn?.id).toBe('s1');
    expect(out.wires[0].path).toEqual([[150, 300], [200, 300], [200, 100], [270, 100]]);
    expect(out.wires).toHaveLength(2);                               // the resistor gets an automatic wire
    expect(out.flags.map((f) => f.ref).sort()).toEqual(['led1.K', 'uno.GND']);
    expect(out.dots.length).toBeGreaterThan(0);                      // two wires on one pin
  });
});
