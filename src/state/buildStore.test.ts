import { describe, expect, it } from 'vitest';
import { createBuildStore, FRESH_CODE } from './buildStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const fresh = () => createBuildStore(new MemoryStorage() as unknown as Storage).getState;

describe('the build store', () => {
  it('adding parts fills free spots', () => {
    const s = fresh();
    const a = s().addPart('led')!, b = s().addPart('led')!;
    const [pa, pb] = [s().parts.find((p) => p.id === a)!, s().parts.find((p) => p.id === b)!];
    expect(pa.at).toEqual({ col: 1, row: 'a' });
    expect(pb.at).toEqual({ col: 3, row: 'a' }); // 1a and 2a are taken by the first LED's legs
    const bid = s().addPart('button')!;
    const btn = s().parts.find((p) => p.id === bid)!;
    expect((btn.at as { row: string }).row).toBe('e');
    expect(s().inputs[btn.id]).toEqual({ pressed: 0 });
  });

  it("placement: a leg can't share a hole", () => {
    const s = fresh();
    const a = s().addPart('resistor')!; // 1a–5a
    const b = s().addPart('led')!;       // 6a, 7a
    expect(s().movePart(b, { col: 5, row: 'a' })).toBe(false); // 5a holds the resistor's leg
    expect(s().parts.find((p) => p.id === b)!.at).toEqual({ col: 6, row: 'a' });
    expect(s().movePart(b, { col: 2, row: 'c' })).toBe(true);  // other row: free
    expect(s().movePart(a, { col: 28, row: 'a' })).toBe(false); // off the end of the board
    expect(s().wires).toEqual([]);
  });

  it('wires: self and duplicate connections are refused', () => {
    const s = fresh();
    expect(s().addWire('uno.D13', 'uno.D13')).toBeNull();
    expect(s().message).toMatch(/two different/i);
    expect(s().addWire('uno.D13', 'bb.10c')).not.toBeNull();
    expect(s().addWire('bb.10c', 'uno.D13')).toBeNull(); // the same wire, other way round
    expect(s().message).toMatch(/already connected/i);
    expect(s().wires).toHaveLength(1);
  });

  it('a wire end cannot go into a hole that holds a leg', () => {
    const s = fresh();
    s().addPart('led'); // 1a, 2a
    expect(s().addWire('uno.D13', 'bb.1a')).toBeNull();
    expect(s().addWire('uno.D13', 'bb.1c')).not.toBeNull();
  });

  it("the UNO and breadboard can't be removed", () => {
    const s = fresh();
    s().removePart('uno');
    s().removePart('bb');
    const id = s().addPart('led')!;
    s().addWire('uno.D13', 'bb.1c');
    s().removePart(id);
    expect(s().parts).toEqual([]);
    expect(s().wires).toHaveLength(1); // the wire stays on the breadboard, like real life
  });

  it('inputs are clamped to their range', () => {
    const s = fresh();
    const pot = s().addPart('pot')!, btn = s().addPart('button')!;
    s().setInput(pot, 'position', 7);
    expect(s().inputs[pot].position).toBe(1);
    s().setInput(pot, 'position', Number.NaN);
    expect(s().inputs[pot].position).toBe(1);
    s().setInput(btn, 'pressed', 0.7);
    expect(s().inputs[btn].pressed).toBe(1);
  });

  it('saved builds survive reload; junk falls back to a fresh build', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const a = createBuildStore(storage).getState;
    const id = a().addPart('led')!;
    a().setParam(id, 'color', 'blue');
    a().addWire('uno.D13', 'bb.1c');
    a().setCode('void setup() {}\nvoid loop() {}\n');
    const b = createBuildStore(storage).getState;
    expect(b().parts).toEqual(a().parts);
    expect(b().wires).toEqual(a().wires);
    expect(b().code).toBe('void setup() {}\nvoid loop() {}\n');
    storage.setItem('rq-build-v1', '{bad');
    expect(createBuildStore(storage).getState().parts).toEqual([]);
    expect(createBuildStore(storage).getState().code).toBe(FRESH_CODE);
  });
});

describe('review fixes: the build store', () => {
  it('a removed part\'s id is never used again (a new LED never inherits an old one\'s burn)', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const s = createBuildStore(storage).getState;
    const a = s().addPart('led')!;
    s().removePart(a);
    const b = s().addPart('led')!;
    expect(b).not.toBe(a);
    expect(createBuildStore(storage).getState().addPart('led')).not.toBe(b); // also after a reload
  });

  it('a partly damaged save keeps what is valid and drops the rest', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    storage.setItem('rq-build-v1', JSON.stringify({
      v: 1,
      parts: [{ id: 'x1', type: 'x', params: {}, at: { col: 1, row: 'a' } }, { id: 'led1', type: 'led', params: {}, at: { col: 40, row: 'a' } },
        { id: 'led2', type: 'led', params: { color: 'blue' }, at: { col: 5, row: 'c' } }, null],
      wires: [{ id: 'w1', from: 'uno.D99', to: 'bb.1a', color: '#000' }, { id: 'w2', from: 'uno.D13', to: 'bb.5a', color: '#000' }, 7],
      inputs: null,
      code: 'void setup() {}\nvoid loop() {}\n',
    }));
    const s = createBuildStore(storage).getState();
    expect(s.parts.map((p) => p.id)).toEqual(['led2']);
    expect(s.wires.map((w) => w.id)).toEqual(['w2']);
    expect(s.inputs).toEqual({});
    expect(s.code).toBe('void setup() {}\nvoid loop() {}\n');
  });
});

describe('B3: the build store', () => {
  it('a successful action clears the last refusal message', () => {
    const s = fresh();
    const id = s().addPart('led')!;
    expect(s().movePart(id, { col: 40, row: 'a' })).toBe(false);
    expect(s().message).not.toBeNull();
    expect(s().movePart(id, { col: 5, row: 'a' })).toBe(true);
    expect(s().message).toBeNull();
    s().addWire('uno.D13', 'uno.D13');
    expect(s().message).not.toBeNull();
    s().removePart(id);
    expect(s().message).toBeNull();
  });

  it('canMove says which way a part can go (a push button only fits row e)', () => {
    const s = fresh();
    const b = s().addPart('button')!;
    const at = s().parts.find((p) => p.id === b)!.at as { col: number };
    expect(s().canMove(b, { col: at.col + 1, row: 'e' })).toBe(true);
    expect(s().canMove(b, { col: at.col, row: 'd' })).toBe(false);
    expect(s().canMove(b, { col: at.col, row: 'f' })).toBe(false);
  });

  it('burns are kept with the build (screen switch, reload) until replaced', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const s = createBuildStore(storage).getState;
    const id = s().addPart('led')!;
    s().setBurns([{ id, reason: 'led-overcurrent' }, { id: 'uno.D13', reason: 'pin-overcurrent' }]);
    expect(createBuildStore(storage).getState().burns).toHaveLength(2);
    s().replaceBurn(id);
    expect(s().burns).toEqual([{ id: 'uno.D13', reason: 'pin-overcurrent' }]);
    s().replaceBurn('uno'); // a new board: every damaged pin and the short go
    expect(s().burns).toEqual([]);
  });
});

describe('B3: modules on the bench', () => {
  type Bench = { x: number; z: number };
  it('a module stands on the bench, in a free spot — never on the UNO, the breadboard or another module', () => {
    const s = fresh();
    const ids = ['servo', 'hcsr04', 'stepper', 'oled', 'soil', 'motor', 'servo'].map((t) => s().addPart(t as never)!);
    expect(ids.every(Boolean)).toBe(true);
    const spots = ids.map((id) => s().parts.find((p) => p.id === id)!.at as Bench);
    for (const at of spots) expect(at).toEqual({ x: expect.any(Number), z: expect.any(Number) });
    expect(new Set(spots.map((a) => `${a.x},${a.z}`)).size).toBe(spots.length);
  });

  it('a module moves 10 mm at a time, and not into something else', () => {
    const s = fresh();
    const id = s().addPart('oled')!;
    const at = s().parts.find((p) => p.id === id)!.at as Bench;
    expect(s().movePart(id, { x: at.x + 10, z: at.z })).toBe(true);
    expect(s().canMove(id, { x: 50, z: 8 })).toBe(false); // the breadboard's middle
    expect(s().canMove(id, { x: -38, z: 2 })).toBe(false); // the UNO's middle
    expect(s().canMove(id, { x: 200, z: 300 })).toBe(false); // off the bench
  });

  it("wires go to a module's pins (one each), and go with the module when it is removed", () => {
    const s = fresh();
    const id = s().addPart('servo')!;
    expect(s().addWire('uno.D9', `${id}.SIG`)).toBeTruthy();
    expect(s().addWire('uno.D10', `${id}.SIG`)).toBeNull();           // that pin already has a wire
    expect(s().addWire('uno.5V', `${id}.NOPE`)).toBeNull();           // not a pin of the servo
    expect(s().addWire('uno.5V', 'servo9.V+')).toBeNull();            // no such module
    expect(s().usedPins().has(`${id}.SIG`)).toBe(true);
    s().removePart(id);
    expect(s().wires).toEqual([]);
  });

  it('a saved build keeps its modules and their wires', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const a = createBuildStore(storage).getState;
    const id = a().addPart('hcsr04')!;
    a().addWire('uno.D9', `${id}.TRIG`);
    const b = createBuildStore(storage).getState();
    expect(b.parts).toEqual(a().parts);
    expect(b.wires).toEqual(a().wires);
  });
});
