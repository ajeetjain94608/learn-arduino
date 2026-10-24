import { create } from 'zustand';

type Point = { x: number; y: number };
type InspectState = {
  hovered: string | null;
  pointer: Point | null;    // mouse position while hovering
  selected: string | null;
  selectedAt: Point | null; // where the part was tapped/clicked
  hover(id: string, pointer: Point): void;
  unhover(id: string): void;
  select(id: string | null, at?: Point): void;
};

export const useInspectStore = create<InspectState>((set, get) => ({
  hovered: null,
  pointer: null,
  selected: null,
  selectedAt: null,
  hover: (id, pointer) => set({ hovered: id, pointer }),
  unhover: (id) => { if (get().hovered === id) set({ hovered: null, pointer: null }); },
  select: (id, at) => {
    const next = id !== null && id === get().selected ? null : id;
    set({ selected: next, selectedAt: next ? at ?? null : null });
  },
}));
