import { create } from 'zustand';
import type { View } from '../three/workbench/cameraViews';

type WorkbenchState = {
  view: View;
  labels: boolean;
  showCurrent: boolean;
  running: boolean;
  pinHigh: boolean;
  resetTick: number; // bumped by resetView(); the camera re-applies the current view preset
  booting: boolean;  // the board was just reset and its bootloader is running
  bootLed: boolean;  // the L LED's bootloader flashes
  resetCount: number;
  setView(v: View): void;
  resetView(): void;
  resetBoard(): void; // the board's reset button: reboot, then restart the program from the beginning
  setBooting(b: boolean): void;
  setBootLed(on: boolean): void;
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
  booting: false,
  bootLed: false,
  resetCount: 0,
  setView: (view) => set({ view }),
  resetView: () => set({ resetTick: get().resetTick + 1 }),
  resetBoard: () => set({ booting: true, pinHigh: false, resetCount: get().resetCount + 1 }),
  setBooting: (booting) => set(booting ? { booting } : { booting, bootLed: false }),
  setBootLed: (bootLed) => set({ bootLed }),
  toggleLabels: () => set({ labels: !get().labels }),
  // Showing current only makes sense on the wired circuit with the program running.
  toggleCurrent: () => (get().showCurrent ? set({ showCurrent: false }) : set({ showCurrent: true, view: 'circuit', running: true })),
  setRunning: (running) => set(running ? { running } : { running, pinHigh: false }),
  setPinHigh: (pinHigh) => set({ pinHigh }),
}));
