import { describe, expect, it } from 'vitest';
import { createBuildStore } from './buildStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const fresh = (storage = new MemoryStorage()) => createBuildStore(storage as unknown as Storage).getState;

describe('undo and redo', () => {
  it('step back and forward through adding, wiring and removing', () => {
    const s = fresh();
    const led = s().addPart('led')!;
    s().addWire('uno.D13', `${led}.A`);
    expect(s().wires).toHaveLength(1);
    s().removePart(led);
    expect(s().parts).toHaveLength(0);
    s().undo();                                   // the LED and its wire come back
    expect(s().parts.map((p) => p.id)).toEqual([led]);
    expect(s().wires).toHaveLength(1);
    s().undo();                                   // before the wire
    expect(s().wires).toHaveLength(0);
    s().undo();                                   // before the LED
    expect(s().parts).toHaveLength(0);
    expect(s().past).toHaveLength(0);
    s().undo();                                   // nothing more to undo: no change
    expect(s().parts).toHaveLength(0);
    s().redo(); s().redo();
    expect(s().parts).toHaveLength(1);
    expect(s().wires).toHaveLength(1);
  });

  it('a new change after an undo drops the redo steps', () => {
    const s = fresh();
    s().addPart('led');
    s().undo();
    expect(s().future).toHaveLength(1);
    s().addPart('resistor');
    expect(s().future).toHaveLength(0);
  });

  it('a stream of the same change (a drag, a slider) is one step', () => {
    const s = fresh();
    const led = s().addPart('led')!;
    const before = s().past.length;
    for (const a of [10, 20, 30, 40]) s().rotatePart(led, a);
    expect(s().past.length).toBe(before + 1);
    s().undo();
    expect(s().parts[0].rot ?? 0).toBe(0);
  });

  it('refused changes are not steps', () => {
    const s = fresh();
    const before = s().past.length;
    expect(s().addWire('uno.D13', 'uno.D13')).toBeNull();
    expect(s().past.length).toBe(before);
  });

  it('the schematic sheet: a drag is one step; it is saved; it goes with the part', () => {
    const storage = new MemoryStorage();
    const s = fresh(storage);
    const led = s().addPart('led')!;
    s().setSchemPos(led, { x: 300, y: 100, rot: 0 }, 1);
    s().setSchemPos(led, { x: 310, y: 100, rot: 0 }, 1);
    s().setSchemPos(led, { x: 320, y: 110, rot: 90 }, 1);
    expect(s().schem.pos[led]).toEqual({ x: 320, y: 110, rot: 90 });
    const wire = s().addWire('uno.D13', `${led}.A`)!;
    s().addSchemWire({ id: 's1', wire, from: 'uno.D13', to: `${led}.A`, pts: [[250, 120]] });
    // saved, and read back
    const again = fresh(storage);
    expect(again().schem.pos[led]).toEqual({ x: 320, y: 110, rot: 90 });
    expect(again().schem.wires).toHaveLength(1);
    // the wire and its drawn twin are one step
    s().undo();
    expect(s().wires).toHaveLength(0);
    expect(s().schem.wires).toHaveLength(0);
    s().undo();                                   // the whole drag at once
    expect(s().schem.pos[led]).toBeUndefined();
    s().redo(); s().redo();
    s().removePart(led);                          // a part's place and drawn wires go with it
    expect(s().schem.pos[led]).toBeUndefined();
    expect(s().schem.wires).toHaveLength(0);
  });
});
