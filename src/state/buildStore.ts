import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { Burn, InputValues } from '../circuit/evaluate';
import { BB_HOLES, UNO_PINS } from '../circuit/board';
import {
  BENCH_AREA, BENCH_SLOTS, BOARD_AT, BOARD_SLOTS, boardOf, canTurn, coversOf, DEFAULT_BOARD, FACING_SLOTS, footprintOf, holeUnder, inside, isFree, KEEP_OUT, LOOSE_SLOTS, overlaps,
  PART_DEFS, paramsOf, partPoints, partRect, START_TURN, usesBreadboard,
} from '../circuit/parts';
import { onBench, type CircuitSpec, type PartInstance, type PartType, type PinRef, type Placement, type Wire } from '../circuit/types';
import { t } from '../i18n/en';

export const FRESH_CODE = 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n';
const KEY = 'rq-build-v1';
// A ready-made build (a project): what a project's own copy starts from, and what "Reset project" brings back.
export type BuildStart = { parts: PartInstance[]; wires: Wire[]; inputs?: InputValues; code: string };
const WIRE_COLORS = ['#F28C16', '#2563EB', '#10B981', '#E2483D', '#8B5CF6', '#2B2F38'];

// counters: the highest number each part type has used, so an id is never given out twice (a new LED must never
// inherit an old one's burn)
// burns: what is burnt stays burnt (across screen switches and reloads) until the learner replaces it
// schem: the schematic sheet's own layout (where each symbol sits, the corners of wires drawn on it)
type Saved = { v: 1; parts: PartInstance[]; wires: Wire[]; inputs: InputValues; code: string; counters?: Record<string, number>; burns?: Burn[]; schem?: Schem };

// The schematic sheet: each symbol's place (sheet units, on a 10-unit grid) and turn (0, 90, 180, 270); 'uno' is the UNO's.
// A wire drawn on the sheet keeps its corners; `wire` is the build wire it made (it goes when that wire goes).
export type SchemPos = { x: number; y: number; rot: number };
export type SchemWire = { id: string; wire: string; from: PinRef; to: PinRef; pts: [number, number][] };
export type Schem = { pos: Record<string, SchemPos>; wires: SchemWire[] };
const EMPTY_SCHEM: Schem = { pos: {}, wires: [] };
// what Undo goes back to: the circuit and its sheet (not the code, which has its own undo, and not what is selected)
type Snapshot = { parts: PartInstance[]; wires: Wire[]; inputs: InputValues; schem: Schem; counters: Record<string, number> };
const HISTORY = 100;

export type BuildState = {
  counters: Record<string, number>;
  parts: PartInstance[];
  wires: Wire[];
  inputs: InputValues;
  code: string;
  selected: string | null;   // a part id or wire id
  message: string | null;    // why the last action was refused (cleared by the next action that works)
  burns: Burn[];
  schem: Schem;
  past: Snapshot[];          // Undo goes back through these (newest last)
  future: Snapshot[];        // and Redo forward through these
  undo(): void;
  redo(): void;
  setSchemPos(id: string, pos: SchemPos, gesture?: number): void; // one drag on the sheet is one step to undo (`gesture` tells drags apart)
  addSchemWire(w: SchemWire): void;
  addPart(type: PartType): string | null;  // a new part stands on the table (a breadboard is a part too); drag it into a breadboard's holes
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

const coveredHoles = (p: PartInstance, at = p.at, rot = p.rot) => coversOf({ ...p, rot }, at).map((h) => `${boardOf({ at }) ?? DEFAULT_BOARD}.${h}`);
// The first breadboard (`bb`) is there whenever a build puts parts in holes or wires to them (the projects, older saves).
const FIRST_BOARD: PartInstance = { id: DEFAULT_BOARD, type: 'breadboard', params: {}, at: { ...BOARD_AT } };
const withBoard = (parts: PartInstance[], wires: { from?: unknown; to?: unknown }[]): PartInstance[] =>
  !parts.some((p) => p.type === 'breadboard') && usesBreadboard(parts, wires.filter((w): w is Wire => typeof w.from === 'string' && typeof w.to === 'string'))
    ? [{ ...FIRST_BOARD, at: { ...BOARD_AT } }, ...parts] : parts;
const HOLE = new Set(BB_HOLES);
const defaultInputs = (type: PartType) => Object.fromEntries(PART_DEFS[type].inputs.map((i) => [i.key, i.default]));

const POINTS = new Set(UNO_PINS.map((p) => `uno.${p}`));
// a connection point that exists in this build: a UNO pin, a hole of a breadboard that is on the bench, or a pin of a part standing on it
const isPoint = (ref: string, parts: PartInstance[]) => {
  if (POINTS.has(ref)) return true;
  const dot = ref.indexOf('.');
  return (dot > 0 && HOLE.has(ref.slice(dot + 1)) && parts.some((p) => p.type === 'breadboard' && p.id === ref.slice(0, dot))) || parts.some((p) => partPoints(p).includes(ref));
};
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const validPart = (p: unknown): p is PartInstance => {
  if (isObject(p) && 'rot' in p && !(typeof p.rot === 'number' && Number.isFinite(p.rot))) delete p.rot; // a bad turn: the part stays, unturned
  if (!isObject(p) || typeof p.id !== 'string' || typeof p.type !== 'string' || !(p.type in PART_DEFS) || !isObject(p.params) || !isObject(p.at)) return false;
  const def = PART_DEFS[p.type as PartType], at = p.at as Record<string, unknown>;
  if (def.bench || 'x' in at) return typeof at.x === 'number' && typeof at.z === 'number' && Number.isFinite(at.x) && Number.isFinite(at.z); // a module, or a part standing on the table
  return typeof at.col === 'number' && typeof at.row === 'string' && footprintOf({ type: p.type as PartType, params: p.params as Record<string, string | number>, rot: typeof p.rot === 'number' ? p.rot : 0, at: p.at as Placement }) !== null;
};
const BURN_REASONS = ['led-overcurrent', 'pin-overcurrent', 'short', 'reversed'];
const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
// a saved sheet, checked: places of parts that are still there, drawn wires whose build wire is still there
function validSchem(x: unknown, ids: Set<string>, wireIds: Set<string>): Schem {
  if (!isObject(x)) return EMPTY_SCHEM;
  const pos: Record<string, SchemPos> = {};
  if (isObject(x.pos)) for (const [id, v] of Object.entries(x.pos)) {
    if ((id === 'uno' || ids.has(id)) && isObject(v) && num(v.x) && num(v.y) && num(v.rot)) pos[id] = { x: v.x as number, y: v.y as number, rot: v.rot as number };
  }
  const wires = Array.isArray(x.wires) ? x.wires.filter((w): w is SchemWire => isObject(w) && typeof w.id === 'string' && typeof w.wire === 'string' && wireIds.has(w.wire)
    && typeof w.from === 'string' && typeof w.to === 'string' && Array.isArray(w.pts) && w.pts.every((q) => Array.isArray(q) && q.length === 2 && q.every(num))) : [];
  return { pos, wires };
}
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
    const rawWires = s.wires.filter(isObject);
    const parts = withBoard(s.parts.filter(validPart), rawWires);
    const ids = new Set(parts.map((p) => p.id));
    const inputs: InputValues = {};
    if (isObject(s.inputs)) for (const [id, v] of Object.entries(s.inputs)) {
      if (ids.has(id) && isObject(v)) inputs[id] = Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))) as Record<string, number>;
    }
    const counters = isObject(s.counters) ? Object.fromEntries(Object.entries(s.counters).filter(([, n]) => typeof n === 'number')) as Record<string, number> : {};
    const burns = Array.isArray(s.burns) ? s.burns.filter(validBurn).filter((b) => b.id.startsWith('uno') || ids.has(b.id)) : [];
    const wires = s.wires.filter(validWire(parts));
    return { v: 1, parts, wires, inputs, code: s.code, counters, burns, schem: validSchem(s.schem, ids, new Set(wires.map((w) => w.id))) };
  } catch { return null; }
}

// The learner's build: parts on the breadboard, wires, input values and code. Saved on the device (under `key`) as it
// changes. `start`: what a new build begins with (a project's ready-made build) when nothing is saved yet.
export function createBuildStore(storage?: Storage, key = KEY, start?: BuildStart): BuildStore {
  const saved = load(storage, key) ?? (start ? { v: 1 as const, parts: withBoard(start.parts, start.wires), wires: start.wires, inputs: startInputs(start), code: start.code, counters: {}, burns: [], schem: EMPTY_SCHEM } : null);
  const store = create<BuildState>((set, get) => {
    // holes taken by part bodies and legs (except `ignore`'s), and holes and module pins taken by wire ends
    const taken = (ignore?: string) => {
      const used = new Set<PinRef>();
      for (const p of get().parts) if (p.id !== ignore) for (const h of coveredHoles(p)) used.add(h);
      for (const w of get().wires) for (const end of [w.from, w.to]) if (!end.startsWith('uno.')) used.add(end);
      return used;
    };
    const fits = (p: PartInstance, at: Placement, ignore?: string, rot = p.rot ?? 0) => {
      if (onBench(at)) { // on the bench (a module, a breadboard, or a part standing on the table): clear of the UNO and everything else on the bench
        const r = partRect(p, at, rot);
        return inside(r, BENCH_AREA) && !overlaps(r, KEEP_OUT[0])
          && !get().parts.some((o) => o.id !== ignore && o.id !== p.id && isFree(o) && overlaps(r, partRect(o, o.at as { x: number; z: number }, o.rot ?? 0)));
      }
      // in a breadboard's holes: the board must be on the bench and every hole the part covers free
      if (PART_DEFS[p.type].bench || !get().parts.some((o) => o.type === 'breadboard' && o.id === (at.board ?? DEFAULT_BOARD)) || !footprintOf({ ...p, rot }, at)) return false;
      const used = taken(ignore);
      return coveredHoles(p, at, rot).every((h) => !used.has(h));
    };
    // Where a part goes when asked to go to `target`: a point on the bench that is over a breadboard goes into its holes (turned to
    // the nearest quarter turn); anywhere else it stands on the table. Null when there is no room there.
    const resolve = (p: PartInstance, target: Placement): { at: Placement; rot: number } | null => {
      const quarter = ((Math.round((p.rot ?? 0) / 90) * 90) % 360 + 360) % 360;
      if (onBench(target) && !PART_DEFS[p.type].bench) {
        const h = holeUnder(get().parts, target.x, target.z);
        if (h) { const at = { col: h.col, row: h.row, board: h.board }; return fits(p, at, p.id, quarter) ? { at, rot: quarter } : null; }
      }
      const rot = onBench(target) ? p.rot ?? 0 : quarter;
      return fits(p, target, p.id, rot) ? { at: target, rot } : null;
    };
    const put = (id: string, to: { at: Placement; rot: number }) =>
      set({ parts: get().parts.map((x) => (x.id === id ? { ...x, at: to.at, rot: to.rot || undefined } : x)), message: null });
    const refuse = (key: Parameters<typeof t>[0]) => { set({ message: t(key) }); return null; };
    let nextWire = 0;
    // Undo history: a snapshot is kept before each change. Changes that come as a stream (dragging a part, sliding its
    // angle) make one step: the same `tag` again within a moment belongs to the same step.
    const snap = (): Snapshot => { const s = get(); return { parts: s.parts, wires: s.wires, inputs: s.inputs, schem: s.schem, counters: s.counters }; };
    let lastTag = '', lastAt = 0;
    const record = (tag = '') => {
      const now = Date.now();
      if (tag && tag === lastTag && now - lastAt < 700) { lastAt = now; return; }
      lastTag = tag; lastAt = now;
      set({ past: [...get().past, snap()].slice(-HISTORY), future: [] });
    };
    const restore = (s: Snapshot) => {
      const ids = new Set(s.parts.map((p) => p.id)), wireIds = new Set(s.wires.map((w) => w.id));
      const sel = get().selected;
      set({ ...s, selected: sel && (ids.has(sel) || wireIds.has(sel)) ? sel : null, message: null });
      lastTag = '';
    };

    return {
      counters: saved?.counters ?? {},
      parts: saved?.parts ?? [],
      wires: saved?.wires ?? [],
      inputs: saved?.inputs ?? {},
      code: saved?.code ?? FRESH_CODE,
      selected: null,
      message: null,
      burns: saved?.burns ?? [],
      schem: saved?.schem ?? EMPTY_SCHEM,
      past: [],
      future: [],

      undo() {
        const past = get().past;
        if (!past.length) return;
        set({ past: past.slice(0, -1), future: [...get().future, snap()] });
        restore(past[past.length - 1]);
      },
      redo() {
        const future = get().future;
        if (!future.length) return;
        set({ future: future.slice(0, -1), past: [...get().past, snap()] });
        restore(future[future.length - 1]);
      },
      setSchemPos(id, pos, gesture) {
        const was = get().schem.pos[id];
        if (was && was.x === pos.x && was.y === pos.y && was.rot === pos.rot) return;
        record(gesture === undefined ? '' : `schem:${id}:${gesture}`);
        set({ schem: { ...get().schem, pos: { ...get().schem.pos, [id]: pos } } });
      },
      addSchemWire(w) {
        record('wire');
        set({ schem: { ...get().schem, wires: [...get().schem.wires, w] } });
      },

      addPart(type) {
        const n = 1 + Math.max(get().counters[type] ?? 0, ...get().parts.filter((p) => p.type === type).map((p) => Number(p.id.slice(type.length)) || 0));
        // the first breadboard is `bb` (as in the projects), the next `breadboard2`, `breadboard3`…
        const boardNo = type === 'breadboard' ? 1 + Math.max(0, ...get().parts.filter((p) => p.type === 'breadboard').map((p) => Number(p.id.slice(10)) || 1)) : 0;
        const id = type !== 'breadboard' ? `${type}${n}` : get().parts.some((p) => p.id === DEFAULT_BOARD) ? `breadboard${boardNo}` : DEFAULT_BOARD;
        const part: PartInstance = { id, type, params: paramsOf(type, {}), at: { col: 1, row: 'a' }, ...(START_TURN[type] ? { rot: START_TURN[type] } : {}) };
        const spots: Placement[] = type === 'breadboard' ? BOARD_SLOTS : PART_DEFS[type].bench ? [...(START_TURN[type] ? FACING_SLOTS : []), ...BENCH_SLOTS] : LOOSE_SLOTS;
        for (const at of spots) {
          if (!fits(part, at)) continue;
          part.at = at;
          record();
          set({ parts: [...get().parts, part], inputs: { ...get().inputs, [part.id]: defaultInputs(type) }, counters: { ...get().counters, [type]: n }, message: null });
          return part.id;
        }
        return refuse(type === 'breadboard' || PART_DEFS[type].bench ? 'build.msg.benchFull' : 'build.msg.tableFull');
      },
      movePart(id, at) {
        const p = get().parts.find((x) => x.id === id), to = p && resolve(p, at);
        if (!to) { if (p) set({ message: t('build.msg.cantMove') }); return false; }
        record();
        put(id, to);
        return true;
      },
      dragPart(id, at) {
        const p = get().parts.find((x) => x.id === id), to = p && resolve(p, at);
        if (!to) return false;
        if (JSON.stringify(p.at) !== JSON.stringify(to.at) || (p.rot ?? 0) !== to.rot) record(`drag:${id}`);
        put(id, to);
        return true;
      },
      rotatePart(id, rot) {
        const p = get().parts.find((x) => x.id === id);
        if (!p || !Number.isFinite(rot) || p.type === 'breadboard') return false; // a breadboard stays square to the table
        if (!isFree(p) && !canTurn(p.type)) { set({ message: t('build.msg.cantTurn') }); return false; } // the push button does not turn in the holes
        // a module turns to any angle (to a tenth of a degree); a part in the breadboard in quarter turns, to the nearest
        const snapped = isFree(p) ? Math.round(rot * 10) / 10 : Math.round(rot / 90) * 90;
        const turned = ((snapped % 360) + 360) % 360; // 0 ≤ turned < 360
        if (!fits(p, p.at, id, turned)) { set({ message: t('build.msg.cantTurn') }); return false; }
        if ((p.rot ?? 0) !== turned) record(`turn:${id}`);
        set({ parts: get().parts.map((x) => (x.id === id ? { ...x, rot: turned } : x)), message: null });
        return true;
      },
      canMove(id, at) { const p = get().parts.find((x) => x.id === id); return !!p && resolve(p, at) !== null; },
      removePart(id) {
        const { [id]: _gone, ...inputs } = get().inputs;
        const gone = get().parts.find((p) => p.id === id);
        const pins = new Set(gone ? partPoints(gone) : []); // a module's wires go with it
        const isBoard = gone?.type === 'breadboard';
        if (gone) record();
        // its place on the sheet, and the sheet's wires that went with its own wires
        const goneWires = new Set(get().wires.filter((w) => pins.has(w.from) || pins.has(w.to) || (isBoard && (w.from.startsWith(`${id}.`) || w.to.startsWith(`${id}.`)))).map((w) => w.id));
        const { [id]: _place, ...pos } = get().schem.pos;
        set({ schem: { pos, wires: get().schem.wires.filter((w) => !goneWires.has(w.wire) && !w.from.startsWith(`${id}.`) && !w.to.startsWith(`${id}.`)) } });
        set({
          parts: get().parts.filter((p) => p.id !== id), inputs,
          wires: get().wires.filter((w) => !pins.has(w.from) && !pins.has(w.to) && !(isBoard && (w.from.startsWith(`${id}.`) || w.to.startsWith(`${id}.`)))),
          selected: get().selected === id ? null : get().selected, burns: get().burns.filter((b) => b.id !== id), message: null,
        });
        if (!isBoard) return;
        // what sat in the breadboard's holes lies down on the table (or goes, when the table is full)
        for (const k of get().parts.filter((p) => !onBench(p.at) && boardOf(p) === id)) {
          const at = LOOSE_SLOTS.find((s) => fits(k, s, k.id, 0));
          if (at) put(k.id, { at, rot: 0 });
          else set({ parts: get().parts.filter((p) => p.id !== k.id) });
        }
      },
      setParam(id, key, value) { record(`param:${id}:${key}`); set({ parts: get().parts.map((p) => (p.id === id ? { ...p, params: { ...p.params, [key]: value } } : p)), message: null }); },
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
        const used = taken();
        if ([from, to].some((end) => !end.startsWith('uno.') && used.has(end))) return refuse('build.msg.holeTaken');
        const id = `w${Date.now().toString(36)}${nextWire++}`;
        record('wire');
        set({ wires: [...get().wires, { id, from, to, color: color ?? WIRE_COLORS[get().wires.length % WIRE_COLORS.length] }], message: null });
        return id;
      },
      removeWire(id) {
        if (!get().wires.some((w) => w.id === id)) return;
        record();
        set({ schem: { ...get().schem, wires: get().schem.wires.filter((w) => w.wire !== id) } });
        set({ wires: get().wires.filter((w) => w.id !== id), selected: get().selected === id ? null : get().selected, message: null }); },
      setWireColor(id, color) { record(`color:${id}`); set({ wires: get().wires.map((w) => (w.id === id ? { ...w, color } : w)) }); },
      select(selected) { set({ selected }); },
      setCode(code) { set({ code }); },
      reset() { record(); set({ schem: EMPTY_SCHEM, parts: [], wires: [], inputs: {}, code: FRESH_CODE, selected: null, message: null, burns: get().burns.filter((b) => b.id.startsWith('uno')) }); }, // counters stay: ids are never reused
      spec() { return { parts: get().parts, wires: get().wires }; },
      usedPins() {
        const used = taken();
        for (const w of get().wires) { used.add(w.from); used.add(w.to); }
        return used;
      },
      setBurns(burns) { set({ burns }); },
      restart(begin) {
        record();
        set({ schem: EMPTY_SCHEM, parts: withBoard(begin.parts, begin.wires), wires: begin.wires, inputs: startInputs(begin), code: begin.code, selected: null, message: null, burns: [] });
      },
      replaceBurn(id) { set({ burns: get().burns.filter((b) => (id === 'uno' ? !b.id.startsWith('uno') : b.id !== id)) }); },
    };
  });
  store.subscribe((s) => {
    try { storage?.setItem(key, JSON.stringify({ v: 1, parts: s.parts, wires: s.wires, inputs: s.inputs, code: s.code, counters: s.counters, burns: s.burns, schem: s.schem } satisfies Saved)); } catch { /* storage full or blocked */ }
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
