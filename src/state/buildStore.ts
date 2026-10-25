import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { InputValues } from '../circuit/evaluate';
import { PART_DEFS, paramsOf } from '../circuit/parts';
import type { CircuitSpec, PartInstance, PartType, PinRef, Placement, Row, Wire } from '../circuit/types';
import { t } from '../i18n/en';

export const FRESH_CODE = 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n';
const KEY = 'rq-build-v1';
const WIRE_COLORS = ['#F28C16', '#2563EB', '#10B981', '#E2483D', '#8B5CF6', '#2B2F38'];
const ROWS: Row[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

type Saved = { v: 1; parts: PartInstance[]; wires: Wire[]; inputs: InputValues; code: string };

export type BuildState = {
  parts: PartInstance[];
  wires: Wire[];
  inputs: InputValues;
  code: string;
  selected: string | null;   // a part id or wire id
  message: string | null;    // why the last action was refused
  addPart(type: PartType): string | null;
  movePart(id: string, at: Placement): boolean;
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
};

const coveredHoles = (p: PartInstance, at = p.at) => PART_DEFS[p.type].covers(at, p.params).map((h) => `bb.${h}`);
const defaultInputs = (type: PartType) => Object.fromEntries(PART_DEFS[type].inputs.map((i) => [i.key, i.default]));

function load(storage: Storage | undefined): Saved | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (s?.v !== 1 || !Array.isArray(s.parts) || !Array.isArray(s.wires) || typeof s.code !== 'string' || typeof s.inputs !== 'object') return null;
    return s;
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
      parts: saved?.parts ?? [],
      wires: saved?.wires ?? [],
      inputs: saved?.inputs ?? {},
      code: saved?.code ?? FRESH_CODE,
      selected: null,
      message: null,

      addPart(type) {
        const n = 1 + Math.max(0, ...get().parts.filter((p) => p.type === type).map((p) => Number(p.id.slice(type.length)) || 0));
        const part: PartInstance = { id: `${type}${n}`, type, params: paramsOf(type, {}), at: { col: 1, row: 'a' } };
        for (const row of ROWS) for (let col = 1; col <= 30; col++) {
          const at = { col, row };
          if (!fits(part, at)) continue;
          part.at = at;
          set({ parts: [...get().parts, part], inputs: { ...get().inputs, [part.id]: defaultInputs(type) }, message: null });
          return part.id;
        }
        return refuse('build.msg.full');
      },
      movePart(id, at) {
        const p = get().parts.find((x) => x.id === id);
        if (!p || !fits(p, at, id)) return false;
        set({ parts: get().parts.map((x) => (x.id === id ? { ...x, at } : x)) });
        return true;
      },
      removePart(id) {
        const { [id]: _gone, ...inputs } = get().inputs;
        set({ parts: get().parts.filter((p) => p.id !== id), inputs, selected: get().selected === id ? null : get().selected });
      },
      setParam(id, key, value) { set({ parts: get().parts.map((p) => (p.id === id ? { ...p, params: { ...p.params, [key]: value } } : p)) }); },
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
      removeWire(id) { set({ wires: get().wires.filter((w) => w.id !== id), selected: get().selected === id ? null : get().selected }); },
      setWireColor(id, color) { set({ wires: get().wires.map((w) => (w.id === id ? { ...w, color } : w)) }); },
      select(selected) { set({ selected }); },
      setCode(code) { set({ code }); },
      reset() { set({ parts: [], wires: [], inputs: {}, code: FRESH_CODE, selected: null, message: null }); },
      spec() { return { parts: get().parts, wires: get().wires }; },
      usedPins() {
        const used = taken();
        for (const w of get().wires) { used.add(w.from); used.add(w.to); }
        return used;
      },
    };
  });
  store.subscribe((s) => {
    try { storage?.setItem(KEY, JSON.stringify({ v: 1, parts: s.parts, wires: s.wires, inputs: s.inputs, code: s.code } satisfies Saved)); } catch { /* storage full or blocked */ }
  });
  return store;
}

const deviceStorage = (() => { try { return window.localStorage; } catch { return undefined; } })();
export const useBuildStore = createBuildStore(deviceStorage);
