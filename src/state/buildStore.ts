import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { Burn, InputValues } from '../circuit/evaluate';
import { BB_HOLES, UNO_PINS } from '../circuit/board';
import { PART_DEFS, paramsOf } from '../circuit/parts';
import type { CircuitSpec, PartInstance, PartType, PinRef, Placement, Row, Wire } from '../circuit/types';
import { t } from '../i18n/en';

export const FRESH_CODE = 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n';
const KEY = 'rq-build-v1';
const WIRE_COLORS = ['#F28C16', '#2563EB', '#10B981', '#E2483D', '#8B5CF6', '#2B2F38'];
const ROWS: Row[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

// counters: the highest number each part type has used, so an id is never given out twice (a new LED must never
// inherit an old one's burn)
// burns: what is burnt stays burnt (across screen switches and reloads) until the learner replaces it
type Saved = { v: 1; parts: PartInstance[]; wires: Wire[]; inputs: InputValues; code: string; counters?: Record<string, number>; burns?: Burn[] };

export type BuildState = {
  counters: Record<string, number>;
  parts: PartInstance[];
  wires: Wire[];
  inputs: InputValues;
  code: string;
  selected: string | null;   // a part id or wire id
  message: string | null;    // why the last action was refused (cleared by the next action that works)
  burns: Burn[];
  addPart(type: PartType): string | null;
  movePart(id: string, at: Placement): boolean;
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
};

const coveredHoles = (p: PartInstance, at = p.at) => PART_DEFS[p.type].covers(at, p.params).map((h) => `bb.${h}`);
const defaultInputs = (type: PartType) => Object.fromEntries(PART_DEFS[type].inputs.map((i) => [i.key, i.default]));

const POINTS = new Set([...UNO_PINS.map((p) => `uno.${p}`), ...BB_HOLES.map((h) => `bb.${h}`)]);
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const validPart = (p: unknown): p is PartInstance =>
  isObject(p) && typeof p.id === 'string' && typeof p.type === 'string' && p.type in PART_DEFS && isObject(p.params) && isObject(p.at)
  && PART_DEFS[p.type as PartType].footprint(p.at as Placement, p.params as Record<string, string | number>) !== null;
const BURN_REASONS = ['led-overcurrent', 'pin-overcurrent', 'short'];
const validBurn = (b: unknown): b is Burn => isObject(b) && typeof b.id === 'string' && BURN_REASONS.includes(b.reason as string);
const validWire = (w: unknown): w is Wire =>
  isObject(w) && typeof w.id === 'string' && typeof w.color === 'string' && POINTS.has(w.from as string) && POINTS.has(w.to as string);

// A saved build, checked entry by entry: whatever is damaged or unknown (e.g. saved by a newer version) is dropped
// rather than breaking the Build screen; unreadable JSON or another version gives a fresh build.
function load(storage: Storage | undefined): Saved | null {
  try {
    const raw = storage?.getItem(KEY);
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
    return { v: 1, parts, wires: s.wires.filter(validWire), inputs, code: s.code, counters, burns };
  } catch { return null; }
}

// The learner's build: parts on the breadboard, wires, input values and code. Saved on the device as it changes.
export function createBuildStore(storage?: Storage): UseBoundStore<StoreApi<BuildState>> {
  const saved = load(storage);
  const store = create<BuildState>((set, get) => {
    // holes taken by part bodies and legs (except `ignore`'s) and by wire ends
    const taken = (ignore?: string) => {
      const used = new Set<PinRef>();
      for (const p of get().parts) if (p.id !== ignore) for (const h of coveredHoles(p)) used.add(h);
      for (const w of get().wires) for (const end of [w.from, w.to]) if (end.startsWith('bb.')) used.add(end);
      return used;
    };
    const fits = (p: PartInstance, at: Placement, ignore?: string) => {
      if (!PART_DEFS[p.type].footprint(at, p.params)) return false;
      const used = taken(ignore);
      return coveredHoles(p, at).every((h) => !used.has(h));
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

      addPart(type) {
        const n = 1 + Math.max(get().counters[type] ?? 0, ...get().parts.filter((p) => p.type === type).map((p) => Number(p.id.slice(type.length)) || 0));
        const part: PartInstance = { id: `${type}${n}`, type, params: paramsOf(type, {}), at: { col: 1, row: 'a' } };
        for (const row of ROWS) for (let col = 1; col <= 30; col++) {
          const at = { col, row };
          if (!fits(part, at)) continue;
          part.at = at;
          set({ parts: [...get().parts, part], inputs: { ...get().inputs, [part.id]: defaultInputs(type) }, counters: { ...get().counters, [type]: n }, message: null });
          return part.id;
        }
        return refuse('build.msg.full');
      },
      movePart(id, at) {
        const p = get().parts.find((x) => x.id === id);
        if (!p) return false;
        if (!fits(p, at, id)) { set({ message: t('build.msg.cantMove') }); return false; }
        set({ parts: get().parts.map((x) => (x.id === id ? { ...x, at } : x)), message: null });
        return true;
      },
      canMove(id, at) { const p = get().parts.find((x) => x.id === id); return !!p && fits(p, at, id); },
      removePart(id) {
        const { [id]: _gone, ...inputs } = get().inputs;
        set({ parts: get().parts.filter((p) => p.id !== id), inputs, selected: get().selected === id ? null : get().selected, burns: get().burns.filter((b) => b.id !== id), message: null });
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
        const used = taken();
        if ([from, to].some((end) => end.startsWith('bb.') && used.has(end))) return refuse('build.msg.holeTaken');
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
      replaceBurn(id) { set({ burns: get().burns.filter((b) => (id === 'uno' ? !b.id.startsWith('uno') : b.id !== id)) }); },
    };
  });
  store.subscribe((s) => {
    try { storage?.setItem(KEY, JSON.stringify({ v: 1, parts: s.parts, wires: s.wires, inputs: s.inputs, code: s.code, counters: s.counters, burns: s.burns } satisfies Saved)); } catch { /* storage full or blocked */ }
  });
  return store;
}

const deviceStorage = (() => { try { return window.localStorage; } catch { return undefined; } })();
export const useBuildStore = createBuildStore(deviceStorage);
