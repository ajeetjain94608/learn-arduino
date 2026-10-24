import { create } from 'zustand';
import type { View } from '../three/workbench/cameraViews';

type WorkbenchState = {
  view: View;
  labels: boolean;
  showCurrent: boolean;
  running: boolean;
  pinHigh: boolean;
  resetTick: number; // bumped by resetView(); the camera re-applies the current view preset
  setView(v: View): void;
  resetView(): void;
  toggleLabels(): void;
  toggleCurrent(): void;
  setRunning(r: boolean): void;
  setPinHigh(h: boolean): void;
};

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  view: 'board',
  labels: true,
  showCurrent: false,
  running: false,
  pinHigh: false,
  resetTick: 0,
  setView: (view) => set({ view }),
  resetView: () => set({ resetTick: get().resetTick + 1 }),
  toggleLabels: () => set({ labels: !get().labels }),
  // Showing current only makes sense on the wired circuit with the program running.
  toggleCurrent: () => (get().showCurrent ? set({ showCurrent: false }) : set({ showCurrent: true, view: 'circuit', running: true })),
  setRunning: (running) => set(running ? { running } : { running, pinHigh: false }),
  setPinHigh: (pinHigh) => set({ pinHigh }),
}));
