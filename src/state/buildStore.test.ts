import { describe, expect, it } from 'vitest';
import { PART_DEFS } from '../circuit/parts';
import { createBuildStore, FRESH_CODE, type BuildState } from './buildStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
// A breadboard is a part, and a new part lands on the table. Most of these tests are about parts in a breadboard's holes, so this
// puts a breadboard on the bench and lets a new part go into the first free holes (the way "add" once did).
function holes(get: () => BuildState): () => BuildState {
  if (!get().parts.some((p) => p.type === 'breadboard')) get().addPart('breadboard');
  return () => ({
    ...get(),
    addPart(type) {
      const id = get().addPart(type);
      if (!id || PART_DEFS[type].bench) return id;
      for (const row of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const) for (let col = 1; col <= 30; col++) {
        if (get().canMove(id, { col, row })) { get().movePart(id, { col, row }); return id; }
      }
      return id;
    },
  });
}
const fresh = () => holes(createBuildStore(new MemoryStorage() as unknown as Storage).getState);

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

  it("the UNO can't be removed; a removed part leaves its wires on the breadboard", () => {
    const s = fresh();
    s().removePart('uno');
    const id = s().addPart('led')!;
    s().addWire('uno.D13', 'bb.1c');
    s().removePart(id);
    expect(s().parts.map((p) => p.type)).toEqual(['breadboard']);
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
    const a = holes(createBuildStore(storage).getState);
    const id = a().addPart('led')!;
    a().setParam(id, 'color', 'blue');
    a().addWire('uno.D13', 'bb.1c');
    a().setCode('void setup() {}\nvoid loop() {}\n');
    const b = holes(createBuildStore(storage).getState);
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
    const s = holes(createBuildStore(storage).getState);
    const a = s().addPart('led')!;
    s().removePart(a);
    const b = s().addPart('led')!;
    expect(b).not.toBe(a);
    expect(holes(createBuildStore(storage).getState)().addPart('led')).not.toBe(b); // also after a reload
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
    expect(s.parts.map((p) => p.id)).toEqual(['bb', 'led2']); // (the first breadboard comes with a save that uses holes)
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
    const s = holes(createBuildStore(storage).getState);
    const id = s().addPart('led')!;
    s().setBurns([{ id, reason: 'led-overcurrent' }, { id: 'uno.D13', reason: 'pin-overcurrent' }]);
    expect(holes(createBuildStore(storage).getState)().burns).toHaveLength(2);
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
    const a = holes(createBuildStore(storage).getState);
    const id = a().addPart('hcsr04')!;
    a().addWire('uno.D9', `${id}.TRIG`);
    const b = holes(createBuildStore(storage).getState)();
    expect(b.parts).toEqual(a().parts);
    expect(b.wires).toEqual(a().wires);
  });
});

describe('B3: a project has its own copy of its build', () => {
  const start = {
    parts: [{ id: 'led1', type: 'led' as const, params: { color: 'green' }, at: { col: 5, row: 'a' as const } }],
    wires: [{ id: 'w1', from: 'uno.D13', to: 'bb.5c', color: '#F28C16' }],
    code: 'void setup() {}\nvoid loop() {}\n',
  };
  it('starts from the ready-made build, keeps changes under its own key, and Reset brings the original back', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const free = holes(createBuildStore(storage).getState);
    const p = createBuildStore(storage, 'rq-project-blink-v1', start).getState;
    expect(p().parts.filter((x) => x.type !== 'breadboard')).toEqual(start.parts);
    expect(p().parts.map((x) => x.id)).toEqual(['bb', ...start.parts.map((x) => x.id)]);   // the project uses holes: its breadboard is on the bench
    expect(p().wires).toEqual(start.wires);
    expect(p().inputs).toEqual({ led1: {} });
    p().removeWire('w1');
    expect(createBuildStore(storage, 'rq-project-blink-v1', start).getState().wires).toEqual([]); // the change is saved
    expect(free().parts.map((x) => x.type)).toEqual(['breadboard']);                               // the free build is untouched
    p().restart(start);
    expect(p().wires).toEqual(start.wires);
    expect(p().burns).toEqual([]);
  });
});

describe('B3: dragging and turning modules', () => {
  it('a module can be put anywhere on the bench that is free, a millimetre at a time', () => {
    const s = fresh();
    const id = s().addPart('oled')!;
    expect(s().dragPart(id, { x: 123, z: -88 })).toBe(true);
    expect(s().parts.find((p) => p.id === id)!.at).toEqual({ x: 123, z: -88 });
    expect(s().dragPart(id, { x: -38, z: 2 })).toBe(false);        // on the UNO: stays where it was
    expect(s().parts.find((p) => p.id === id)!.at).toEqual({ x: 123, z: -88 });
    expect(s().message).toBeNull();                                // dragging says nothing while it looks for a spot
  });
  it('turning a module: any angle, kept between 0 and 360, refused if the turned box would not fit', () => {
    const s = fresh();
    const id = s().addPart('hcsr04')!;                              // 46 × 22: wider than deep
    expect(s().rotatePart(id, 30)).toBe(true);
    expect(s().parts.find((p) => p.id === id)!.rot).toBe(30);
    expect(s().rotatePart(id, -90)).toBe(true);
    expect(s().parts.find((p) => p.id === id)!.rot).toBe(270);
    expect(s().rotatePart(id, 725)).toBe(true);
    expect(s().parts.find((p) => p.id === id)!.rot).toBe(5);
    // squeeze it against the breadboard's keep-out: a quarter turn would push it into the board
    s().dragPart(id, { x: 50, z: -38 });
    s().rotatePart(id, 0);
    const before = s().parts.find((p) => p.id === id)!.rot;
    expect(s().rotatePart(id, 90)).toBe(false);
    expect(s().parts.find((p) => p.id === id)!.rot).toBe(before);
    expect(s().message).not.toBeNull();
  });
  it('the turn is saved with the build', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const a = holes(createBuildStore(storage).getState);
    const id = a().addPart('servo')!;
    a().rotatePart(id, 135);
    expect(createBuildStore(storage).getState().parts.find((p) => p.id === id)!.rot).toBe(135);
  });
  it('a save with a bad turn keeps the part and drops the turn', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    storage.setItem('rq-build-v1', JSON.stringify({ v: 1, code: 'x', parts: [{ id: 'servo1', type: 'servo', params: {}, at: { x: 30, z: -72 }, rot: 'sideways' }], wires: [] }));
    const s = createBuildStore(storage).getState();
    expect(s.parts).toHaveLength(1);
    expect(s.parts[0].rot ?? 0).toBe(0);
  });
});

describe('B4: turning a part that sits in the breadboard', () => {
  it('turns in quarter turns, and its legs move to the turned holes', () => {
    const s = fresh();
    const id = s().addPart('led')!;                      // legs 1a, 2a
    expect(s().rotatePart(id, 90)).toBe(true);
    expect(s().parts.find((p) => p.id === id)!.rot).toBe(90);
    expect(s().usedPins().has('bb.1a')).toBe(true);
    expect(s().usedPins().has('bb.1b')).toBe(true);      // the cathode is now below the anode
    expect(s().usedPins().has('bb.2a')).toBe(false);
    expect(s().rotatePart(id, 100)).toBe(true);          // anything between snaps to the nearest quarter
    expect(s().parts.find((p) => p.id === id)!.rot).toBe(90);
    s().movePart(id, { col: 5, row: 'a' });
    expect(s().rotatePart(id, 200)).toBe(true);
    expect(s().parts.find((p) => p.id === id)!.rot).toBe(180);   // the cathode is now left of the anode, at 4a
  });
  it('is refused where the turned part would not fit, and says so', () => {
    const s = fresh();
    const id = s().addPart('led')!;
    s().movePart(id, { col: 5, row: 'e' });              // e → f would cross the middle gap
    expect(s().rotatePart(id, 90)).toBe(false);
    expect(s().parts.find((p) => p.id === id)!.rot ?? 0).toBe(0);
    expect(s().message).not.toBeNull();
    // another part in the way
    const b = fresh();
    const led = b().addPart('led')!;                     // 1a 2a
    b().addPart('resistor')!;                            // 3a … 7a
    b().movePart(led, { col: 8, row: 'a' });
    const other = b().addPart('led')!;                   // takes 1a, 2a
    b().movePart(other, { col: 8, row: 'b' });           // right under the first LED's anode
    expect(b().rotatePart(led, 90)).toBe(false);         // its cathode would land on 8b
  });
  it('the push button does not turn', () => {
    const s = fresh();
    const id = s().addPart('button')!;
    expect(s().rotatePart(id, 90)).toBe(false);
    expect(s().message).not.toBeNull();
  });
  it('a turned part can be moved: it keeps its turn and is checked as turned', () => {
    const s = fresh();
    const id = s().addPart('resistor')!;                 // 1a … 5a
    expect(s().rotatePart(id, 90)).toBe(true);           // 1a … 1e
    expect(s().dragPart(id, { col: 10, row: 'a' })).toBe(true);
    expect(s().usedPins().has('bb.10e')).toBe(true);
    expect(s().dragPart(id, { col: 10, row: 'c' })).toBe(false);   // would cross the gap
  });
});

describe('a breadboard is a part: parts land on the table, and are dragged into holes', () => {
  const raw = () => createBuildStore(new MemoryStorage() as unknown as Storage).getState;
  const at = (s: () => BuildState, id: string) => s().parts.find((p) => p.id === id)!.at;
  it('a new build is empty: no breadboard until one is added', () => {
    const s = raw();
    expect(s().parts).toEqual([]);
    expect(s().addPart('led')).not.toBeNull();
    expect('x' in at(s, 'led1')).toBe(true);                      // a new part stands on the table
    expect(s().addWire('uno.D13', 'bb.5a')).toBeNull();           // there are no holes yet
  });
  it('breadboards are added one by one: bb, then breadboard2, breadboard3…, each its own board of holes', () => {
    const s = raw();
    expect(s().addPart('breadboard')).toBe('bb');
    expect(s().addPart('breadboard')).toBe('breadboard2');
    expect(s().addPart('breadboard')).toBe('breadboard3');
    const xs = s().parts.map((p) => JSON.stringify(p.at));
    expect(new Set(xs).size).toBe(3);                             // none on top of another
    expect(s().addWire('uno.D13', 'bb.5a')).not.toBeNull();
    expect(s().addWire('uno.D12', 'breadboard2.5a')).not.toBeNull();
    expect(s().addWire('uno.D11', 'breadboard9.5a')).toBeNull();  // no such board
  });
  it('every part type stands on the table, and its legs are wire points', () => {
    const s = raw();
    for (const type of ['led', 'resistor', 'button', 'pot', 'rgb', 'buzzer', 'ldr', 'tmp36', 'fsr', 'diode', 'npn', 'traffic'] as const) expect(s().addPart(type), type).not.toBeNull();
    expect(s().parts.every((p) => 'x' in p.at)).toBe(true);
    expect(s().addWire('uno.D13', 'led1.A')).not.toBeNull();
    expect(s().addWire('uno.D12', 'led1.A')).toBeNull();          // a leg takes one wire
  });
  it('dragging a part over a breadboard puts its legs in the holes, and dragging it off takes it out', () => {
    const s = raw();
    s().addPart('breadboard');
    const led = s().addPart('led')!;
    const board = s().parts[0].at as { x: number; z: number };
    // the point of hole 10c: x = board.x + (10 − 15.5)·2.54, z = board.z + ROW.c (−8.92)
    expect(s().dragPart(led, { x: board.x + (10 - 15.5) * 2.54, z: board.z - 8.92 })).toBe(true);
    expect(at(s, led)).toEqual({ col: 10, row: 'c', board: 'bb' });
    expect(s().usedPins().has('bb.10c')).toBe(true);
    expect(s().dragPart(led, { x: 200, z: 130 })).toBe(true);     // away from every board
    expect('x' in at(s, led)).toBe(true);
    expect(s().usedPins().has('bb.10c')).toBe(false);
  });
  it('a part dragged onto holes that are taken stays where it last fitted', () => {
    const s = raw();
    s().addPart('breadboard');
    const a = s().addPart('led')!, b = s().addPart('led')!;
    const board = s().parts[0].at as { x: number; z: number };
    const spot = { x: board.x + (10 - 15.5) * 2.54, z: board.z - 8.92 };
    expect(s().dragPart(a, spot)).toBe(true);
    expect(s().dragPart(b, spot)).toBe(false);
    expect('x' in at(s, b)).toBe(true);
  });
  it('a part can go from one breadboard to another', () => {
    const s = raw();
    s().addPart('breadboard'); s().addPart('breadboard');
    const led = s().addPart('led')!;
    const [b1, b2] = [s().parts[0].at, s().parts[1].at] as { x: number; z: number }[];
    s().dragPart(led, { x: b1.x, z: b1.z });
    expect((at(s, led) as { board: string }).board).toBe('bb');
    s().dragPart(led, { x: b2.x, z: b2.z });
    expect((at(s, led) as { board: string }).board).toBe('breadboard2');
  });
  it('a breadboard carries its parts and wires when it moves', () => {
    const s = raw();
    s().addPart('breadboard');
    const led = s().addPart('led')!;
    const b = s().parts[0].at as { x: number; z: number };
    s().dragPart(led, { x: b.x, z: b.z });
    s().addWire('uno.D13', 'bb.12a');
    expect(s().dragPart('bb', { x: b.x, z: b.z + 90 })).toBe(true);
    expect('col' in at(s, led)).toBe(true);                       // still in its holes
    expect(s().wires).toHaveLength(1);
  });
  it('a breadboard cannot be dropped on another part or turned', () => {
    const s = raw();
    s().addPart('breadboard'); s().addPart('breadboard');
    const [b1] = [s().parts[0].at] as { x: number; z: number }[];
    expect(s().dragPart('breadboard2', { x: b1.x + 20, z: b1.z })).toBe(false);
    expect(s().rotatePart('bb', 90)).toBe(false);
  });
  it('removing a breadboard lays its parts on the table and drops the wires to its holes', () => {
    const s = raw();
    s().addPart('breadboard');
    const led = s().addPart('led')!;
    const b = s().parts[0].at as { x: number; z: number };
    s().dragPart(led, { x: b.x, z: b.z });
    s().addWire('uno.D13', 'bb.12a');
    s().removePart('bb');
    expect(s().parts.map((p) => p.id)).toEqual([led]);
    expect('x' in at(s, led)).toBe(true);
    expect(s().wires).toEqual([]);
  });
  it('boards and table parts are saved, and an older save that used holes gets its first breadboard', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const a = createBuildStore(storage).getState;
    a().addPart('breadboard'); a().addPart('breadboard'); a().addPart('pot');
    const b = createBuildStore(storage).getState;
    expect(b().parts).toEqual(a().parts);
    const old = new MemoryStorage();
    old.setItem('rq-build-v1', JSON.stringify({ v: 1, parts: [{ id: 'led1', type: 'led', params: { color: 'red' }, at: { col: 3, row: 'a' } }], wires: [{ id: 'w1', from: 'uno.D13', to: 'bb.3a', color: '#000' }], inputs: {}, code: 'x' }));
    const c = createBuildStore(old as unknown as Storage).getState;
    expect(c().parts.map((p) => p.id)).toEqual(['bb', 'led1']);
    expect(c().wires).toHaveLength(1);
  });
});

describe('where a new distance sensor stands', () => {
  it('on the open right-hand side, turned to face away from the UNO and the breadboard', () => {
    const s = fresh();
    const id = s().addPart('hcsr04')!;
    const p = s().parts.find((x) => x.id === id)!;
    expect((p.at as { x: number }).x).toBeGreaterThan(100);
    expect(p.rot).toBe(270);
  });
});
