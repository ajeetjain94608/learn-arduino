import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { Burn, InputValues } from '../circuit/evaluate';
import { BB_HOLES, UNO_PINS } from '../circuit/board';
import { BENCH_AREA, BENCH_SLOTS, canTurn, coversOf, footprintOf, inside, isFree, KEEP_OUT, FACING_SLOTS, LOOSE_SLOTS, overlaps, PART_DEFS, paramsOf, partPoints, partRect, START_TURN, usesBreadboard } from '../circuit/parts';
import { onBench, type CircuitSpec, type PartInstance, type PartType, type PinRef, type Placement, type Row, type Wire } from '../circuit/types';
import { t } from '../i18n/en';

export const FRESH_CODE = 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n';
const KEY = 'rq-build-v1';
// A ready-made build (a project): what a project's own copy starts from, and what "Reset project" brings back.
export type BuildStart = { parts: PartInstance[]; wires: Wire[]; inputs?: InputValues; code: string };
const WIRE_COLORS = ['#F28C16', '#2563EB', '#10B981', '#E2483D', '#8B5CF6', '#2B2F38'];
const ROWS: Row[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

// counters: the highest number each part type has used, so an id is never given out twice (a new LED must never
// inherit an old one's burn)
// burns: what is burnt stays burnt (across screen switches and reloads) until the learner replaces it
type Saved = { v: 1; parts: PartInstance[]; wires: Wire[]; inputs: InputValues; code: string; counters?: Record<string, number>; burns?: Burn[]; breadboard?: boolean };

export type BuildState = {
  counters: Record<string, number>;
  parts: PartInstance[];
  wires: Wire[];
  inputs: InputValues;
  code: string;
  selected: string | null;   // a part id or wire id
  message: string | null;    // why the last action was refused (cleared by the next action that works)
  burns: Burn[];
  breadboard: boolean;       // whether the breadboard is on the bench (it can go when nothing uses it)
  addPart(type: PartType, where?: 'board' | 'table'): string | null; // a part goes in the breadboard, or stands on the table
  placeOn(id: string, where: 'board' | 'table'): boolean;             // move a part between the breadboard and the table
  setBreadboard(on: boolean): boolean;
  movePart(id: string, at: Placement): boolean;
  dragPart(id: string, at: Placement): boolean;   // like movePart, silently: a drag looks for a free spot as it goes
  rotatePart(id: string, rot: number): boolean;   // turn a part to this angle (degrees)
  canMove(id: string, at: Placement): boolean;
  removePart(id: string): void;
  setParam(id: string, key: string, value: string | number): void;
  setInput(id: string, key: string, value: number): void;
  addWire(from: PinRef, to: PinRef, color?: string): string | null;
  removeWire(id: string): void;
  setWireColor(id: string, color: string): void;
  select(id: string | null): void;
  setCode(code: string): void;
  reset(): void;
  spec(): CircuitSpec;
  usedPins(): Set<PinRef>;
  setBurns(burns: Burn[]): void;
  replaceBurn(id: string): void; // 'uno' = a new board: every damaged pin and the short go
  restart(start: BuildStart): void; // back to a ready-made build (burns cleared)
};
export type BuildStore = UseBoundStore<StoreApi<BuildState>>;

// every hole of the breadboard, first leg by first leg, in the order new parts look for room
const boardSpots = (): Placement[] => ROWS.flatMap((row) => Array.from({ length: 30 }, (_, i) => ({ col: i + 1, row })));
const coveredHoles = (p: PartInstance, at = p.at, rot = p.rot) => coversOf({ ...p, rot }, at).map((h) => `bb.${h}`);
const defaultInputs = (type: PartType) => Object.fromEntries(PART_DEFS[type].inputs.map((i) => [i.key, i.default]));

const POINTS = new Set([...UNO_PINS.map((p) => `uno.${p}`), ...BB_HOLES.map((h) => `bb.${h}`)]);
// a connection point that exists in this build: a UNO pin, a breadboard hole, or a pin of a module on the bench
const isPoint = (ref: string, parts: PartInstance[]) => POINTS.has(ref) || parts.some((p) => partPoints(p).includes(ref));
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const validPart = (p: unknown): p is PartInstance => {
  if (isObject(p) && 'rot' in p && !(typeof p.rot === 'number' && Number.isFinite(p.rot))) delete p.rot; // a bad turn: the part stays, unturned
  if (!isObject(p) || typeof p.id !== 'string' || typeof p.type !== 'string' || !(p.type in PART_DEFS) || !isObject(p.params) || !isObject(p.at)) return false;
  const def = PART_DEFS[p.type as PartType], at = p.at as Record<string, unknown>;
  if (def.bench || 'x' in at) return typeof at.x === 'number' && typeof at.z === 'number' && Number.isFinite(at.x) && Number.isFinite(at.z); // a module, or a part standing on the table
  return typeof at.col === 'number' && typeof at.row === 'string' && footprintOf({ type: p.type as PartType, params: p.params as Record<string, string | number>, rot: typeof p.rot === 'number' ? p.rot : 0, at: p.at as Placement }) !== null;
};
const BURN_REASONS = ['led-overcurrent', 'pin-overcurrent', 'short', 'reversed'];
const validBurn = (b: unknown): b is Burn => isObject(b) && typeof b.id === 'string' && BURN_REASONS.includes(b.reason as string);
const validWire = (parts: PartInstance[]) => (w: unknown): w is Wire =>
  isObject(w) && typeof w.id === 'string' && typeof w.color === 'string' && isPoint(w.from as string, parts) && isPoint(w.to as string, parts);

// A saved build, checked entry by entry: whatever is damaged or unknown (e.g. saved by a newer version) is dropped
// rather than breaking the Build screen; unreadable JSON or another version gives a fresh build.
function load(storage: Storage | undefined, key: string): Saved | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Record<string, unknown>;
    if (!isObject(s) || s.v !== 1 || !Array.isArray(s.parts) || !Array.isArray(s.wires) || typeof s.code !== 'string') return null;
    const parts = s.parts.filter(validPart);
    const ids = new Set(parts.map((p) => p.id));
    const inputs: InputValues = {};
    if (isObject(s.inputs)) for (const [id, v] of Object.entries(s.inputs)) {
      if (ids.has(id) && isObject(v)) inputs[id] = Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))) as Record<string, number>;
    }
    const counters = isObject(s.counters) ? Object.fromEntries(Object.entries(s.counters).filter(([, n]) => typeof n === 'number')) as Record<string, number> : {};
    const burns = Array.isArray(s.burns) ? s.burns.filter(validBurn).filter((b) => b.id.startsWith('uno') || ids.has(b.id)) : [];
    return { v: 1, parts, wires: s.wires.filter(validWire(parts)), inputs, code: s.code, counters, burns, breadboard: typeof s.breadboard === 'boolean' ? s.breadboard : undefined };
  } catch { return null; }
}

// The learner's build: parts on the breadboard, wires, input values and code. Saved on the device (under `key`) as it
// changes. `start`: what a new build begins with (a project's ready-made build) when nothing is saved yet.
export function createBuildStore(storage?: Storage, key = KEY, start?: BuildStart): BuildStore {
  const saved = load(storage, key) ?? (start ? { v: 1 as const, parts: start.parts, wires: start.wires, inputs: startInputs(start), code: start.code, counters: {}, burns: [] } : null);
  const store = create<BuildState>((set, get) => {
    // holes taken by part bodies and legs (except `ignore`'s), and holes and module pins taken by wire ends
    const taken = (ignore?: string) => {
      const used = new Set<PinRef>();
      for (const p of get().parts) if (p.id !== ignore) for (const h of coveredHoles(p)) used.add(h);
      for (const w of get().wires) for (const end of [w.from, w.to]) if (!end.startsWith('uno.')) used.add(end);
      return used;
    };
    const fits = (p: PartInstance, at: Placement, ignore?: string, rot = p.rot ?? 0) => {
      if (PART_DEFS[p.type].bench || onBench(at)) { // on the bench (a module, or a part standing on the table): clear of the UNO, the breadboard (when it is there) and everything else on the bench
        if (!onBench(at)) return false;
        const r = partRect(p, at, rot), board = get().breadboard;
        return inside(r, BENCH_AREA) && !KEEP_OUT.some((k, i) => (i === 0 || board) && overlaps(r, k))
          && !get().parts.some((o) => o.id !== ignore && o.id !== p.id && isFree(o) && overlaps(r, partRect(o, o.at as { x: number; z: number }, o.rot ?? 0)));
      }
      if (onBench(at) || !footprintOf({ ...p, rot }, at)) return false;
      const used = taken(ignore);
      return coveredHoles(p, at, rot).every((h) => !used.has(h));
    };
    const refuse = (key: Parameters<typeof t>[0]) => { set({ message: t(key) }); return null; };
    let nextWire = 0;

    return {
      counters: saved?.counters ?? {},
      parts: saved?.parts ?? [],
      wires: saved?.wires ?? [],
      inputs: saved?.inputs ?? {},
      code: saved?.code ?? FRESH_CODE,
      selected: null,
      message: null,
      burns: saved?.burns ?? [],
      breadboard: saved?.breadboard ?? (start ? usesBreadboard(saved?.parts ?? [], saved?.wires ?? []) : true),

      addPart(type, where = 'board') {
        const n = 1 + Math.max(get().counters[type] ?? 0, ...get().parts.filter((p) => p.type === type).map((p) => Number(p.id.slice(type.length)) || 0));
        const part: PartInstance = { id: `${type}${n}`, type, params: paramsOf(type, {}), at: { col: 1, row: 'a' }, ...(START_TURN[type] ? { rot: START_TURN[type] } : {}) };
        const onTable = !!PART_DEFS[type].bench || where === 'table' || !get().breadboard; // (with no breadboard there are no holes)
        const spots: Placement[] = PART_DEFS[type].bench ? [...(START_TURN[type] ? FACING_SLOTS : []), ...BENCH_SLOTS] : onTable ? LOOSE_SLOTS : boardSpots();
        for (const at of spots) {
          if (!fits(part, at)) continue;
          part.at = at;
          set({ parts: [...get().parts, part], inputs: { ...get().inputs, [part.id]: defaultInputs(type) }, counters: { ...get().counters, [type]: n }, message: null });
          return part.id;
        }
        return refuse(onTable ? 'build.msg.tableFull' : 'build.msg.full');
      },
      placeOn(id, where) {
        const p = get().parts.find((x) => x.id === id);
        if (!p || PART_DEFS[p.type].bench) return false;
        if ((where === 'table') === onBench(p.at)) return true;
        if (where === 'board' && !get().breadboard) { set({ message: t('build.msg.noBoard') }); return false; }
        const turned = { ...p, rot: 0 }; // a part keeps no turn across: the board turns in quarter turns, the table in any angle
        const at = (where === 'table' ? LOOSE_SLOTS : boardSpots()).find((a) => fits(turned, a, id, 0));
        if (!at) { set({ message: t(where === 'table' ? 'build.msg.tableFull' : 'build.msg.full') }); return false; }
        const gone = new Set(onBench(p.at) ? partPoints(p) : []); // the wires on its free legs would dangle: they go
        set({ parts: get().parts.map((x) => (x.id === id ? { ...x, at, rot: undefined } : x)), wires: get().wires.filter((w) => !gone.has(w.from) && !gone.has(w.to)), message: null });
        return true;
      },
      setBreadboard(on) {
        if (on === get().breadboard) return true;
        if (!on && usesBreadboard(get().parts, get().wires)) { set({ message: t('build.msg.boardInUse') }); return false; }
        if (on && get().parts.some((o) => isFree(o) && overlaps(partRect(o, o.at as { x: number; z: number }, o.rot ?? 0), KEEP_OUT[1]))) { set({ message: t('build.msg.boardBlocked') }); return false; }
        set({ breadboard: on, message: null });
        return true;
      },
      movePart(id, at) {
        const p = get().parts.find((x) => x.id === id);
        if (!p) return false;
        if (!fits(p, at, id)) { set({ message: t('build.msg.cantMove') }); return false; }
        set({ parts: get().parts.map((x) => (x.id === id ? { ...x, at } : x)), message: null });
        return true;
      },
      dragPart(id, at) {
        const p = get().parts.find((x) => x.id === id);
        if (!p || !fits(p, at, id)) return false;
        set({ parts: get().parts.map((x) => (x.id === id ? { ...x, at } : x)), message: null });
        return true;
      },
      rotatePart(id, rot) {
        const p = get().parts.find((x) => x.id === id);
        if (!p || !Number.isFinite(rot)) return false;
        if (!isFree(p) && !canTurn(p.type)) { set({ message: t('build.msg.cantTurn') }); return false; } // the push button does not turn in the holes
        // a module turns to any angle (to a tenth of a degree); a part in the breadboard in quarter turns, to the nearest
        const snapped = isFree(p) ? Math.round(rot * 10) / 10 : Math.round(rot / 90) * 90;
        const turned = ((snapped % 360) + 360) % 360; // 0 ≤ turned < 360
        if (!fits(p, p.at, id, turned)) { set({ message: t('build.msg.cantTurn') }); return false; }
        set({ parts: get().parts.map((x) => (x.id === id ? { ...x, rot: turned } : x)), message: null });
        return true;
      },
      canMove(id, at) { const p = get().parts.find((x) => x.id === id); return !!p && fits(p, at, id); },
      removePart(id) {
        const { [id]: _gone, ...inputs } = get().inputs;
        const pins = new Set(get().parts.filter((p) => p.id === id).flatMap(partPoints)); // a module's wires go with it
        set({ parts: get().parts.filter((p) => p.id !== id), inputs, wires: get().wires.filter((w) => !pins.has(w.from) && !pins.has(w.to)), selected: get().selected === id ? null : get().selected, burns: get().burns.filter((b) => b.id !== id), message: null });
      },
      setParam(id, key, value) { set({ parts: get().parts.map((p) => (p.id === id ? { ...p, params: { ...p.params, [key]: value } } : p)), message: null }); },
      setInput(id, key, value) {
        const p = get().parts.find((x) => x.id === id);
        const def = p && PART_DEFS[p.type].inputs.find((i) => i.key === key);
        if (!def) return;
        const current = get().inputs[id]?.[key] ?? def.default;
        let v = Number.isFinite(value) ? Math.min(def.max, Math.max(def.min, value)) : current;
        if (def.step >= 1) v = Math.round(v);
        set({ inputs: { ...get().inputs, [id]: { ...get().inputs[id], [key]: v } } });
      },
      addWire(from, to, color) {
        if (from === to) return refuse('build.msg.self');
        if (get().wires.some((w) => (w.from === from && w.to === to) || (w.from === to && w.to === from))) return refuse('build.msg.duplicate');
        if (![from, to].every((end) => isPoint(end, get().parts))) return refuse('build.msg.noPoint');
        if (!get().breadboard && [from, to].some((end) => end.startsWith('bb.'))) return refuse('build.msg.noBoard');
        const used = taken();
        if ([from, to].some((end) => !end.startsWith('uno.') && used.has(end))) return refuse('build.msg.holeTaken');
        const id = `w${Date.now().toString(36)}${nextWire++}`;
        set({ wires: [...get().wires, { id, from, to, color: color ?? WIRE_COLORS[get().wires.length % WIRE_COLORS.length] }], message: null });
        return id;
      },
      removeWire(id) { set({ wires: get().wires.filter((w) => w.id !== id), selected: get().selected === id ? null : get().selected, message: null }); },
      setWireColor(id, color) { set({ wires: get().wires.map((w) => (w.id === id ? { ...w, color } : w)) }); },
      select(selected) { set({ selected }); },
      setCode(code) { set({ code }); },
      reset() { set({ parts: [], wires: [], inputs: {}, code: FRESH_CODE, selected: null, message: null, burns: get().burns.filter((b) => b.id.startsWith('uno')) }); }, // counters stay: ids are never reused
      spec() { return { parts: get().parts, wires: get().wires }; },
      usedPins() {
        const used = taken();
        for (const w of get().wires) { used.add(w.from); used.add(w.to); }
        return used;
      },
      setBurns(burns) { set({ burns }); },
      restart(begin) {
        set({ parts: begin.parts, wires: begin.wires, inputs: startInputs(begin), code: begin.code, selected: null, message: null, burns: [], breadboard: usesBreadboard(begin.parts, begin.wires) });
      },
      replaceBurn(id) { set({ burns: get().burns.filter((b) => (id === 'uno' ? !b.id.startsWith('uno') : b.id !== id)) }); },
    };
  });
  store.subscribe((s) => {
    try { storage?.setItem(key, JSON.stringify({ v: 1, parts: s.parts, wires: s.wires, inputs: s.inputs, code: s.code, counters: s.counters, burns: s.burns, breadboard: s.breadboard } satisfies Saved)); } catch { /* storage full or blocked */ }
  });
  return store;
}

// every part's inputs at their defaults, then the ready-made build's own values
function startInputs(start: BuildStart): InputValues {
  return Object.fromEntries(start.parts.map((p) => [p.id, { ...defaultInputs(p.type), ...start.inputs?.[p.id] }]));
}

const deviceStorage = (() => { try { return window.localStorage; } catch { return undefined; } })();
export const useBuildStore = createBuildStore(deviceStorage);

// Each project's own copy of its build, made when it is first opened (saved separately from the free build).
const projectStores = new Map<string, BuildStore>();
export function projectStore(id: string, start: BuildStart): BuildStore {
  let s = projectStores.get(id);
  if (!s) { s = createBuildStore(deviceStorage, `rq-project-${id}-v1`, start); projectStores.set(id, s); }
  return s;
}
