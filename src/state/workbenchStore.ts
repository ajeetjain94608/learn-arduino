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
  cameraCmd: { kind: 'rotate' | 'zoom'; amount: number; seq: number } | null; // toolbar rotate/zoom buttons
  uploading: boolean;        // the sketch is being uploaded (Run pressed)
  uploadProgress: number;    // 0..1
  line: number | null;       // sketch line currently running, for highlighting
  serial: string[];          // serial monitor output (latest 200 lines)
  rxLed: boolean; txLed: boolean;
  setView(v: View): void;
  resetView(): void;
  nudgeCamera(kind: 'rotate' | 'zoom', amount: number): void;
  upload(): void; // Run: upload the sketch, then it starts
  setUploading(u: boolean, progress?: number): void;
  setLine(l: number | null): void;
  appendSerial(lines: string[]): void;
  clearSerial(): void;
  setSerialLeds(rx: boolean, tx: boolean): void;
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
  cameraCmd: null,
  uploading: false,
  uploadProgress: 0,
  line: null,
  serial: [],
  rxLed: false,
  txLed: false,
  setView: (view) => set({ view }),
  resetView: () => set({ resetTick: get().resetTick + 1 }),
  nudgeCamera: (kind, amount) => set({ cameraCmd: { kind, amount, seq: (get().cameraCmd?.seq ?? 0) + 1 } }),
  upload: () => set({ running: true, uploading: true, uploadProgress: 0, pinHigh: false, serial: [], line: null, booting: false }),
  setUploading: (uploading, progress = 0) => set({ uploading, uploadProgress: progress }),
  setLine: (line) => set({ line }),
  appendSerial: (lines) => set({ serial: [...get().serial, ...lines].slice(-200) }),
  clearSerial: () => set({ serial: [] }),
  setSerialLeds: (rxLed, txLed) => set({ rxLed, txLed }),
  resetBoard: () => set({ booting: true, pinHigh: false, resetCount: get().resetCount + 1 }),
  setBooting: (booting) => set(booting ? { booting } : { booting, bootLed: false }),
  setBootLed: (bootLed) => set({ bootLed }),
  toggleLabels: () => set({ labels: !get().labels }),
  // Showing current only makes sense on the wired circuit with the program running.
  toggleCurrent: () => (get().showCurrent ? set({ showCurrent: false }) : set({ showCurrent: true, view: 'circuit', running: true })),
  setRunning: (running) => set(running ? { running } : { running, pinHigh: false, uploading: false, line: null, rxLed: false, txLed: false }),
  setPinHigh: (pinHigh) => set({ pinHigh }),
}));
