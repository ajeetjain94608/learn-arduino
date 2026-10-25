import { create } from 'zustand';
import type { Program } from '../build/compiler/types';
import { BLINK } from '../content/sketches/blink';
import type { View } from '../three/workbench/cameraViews';

type WorkbenchState = {
  view: View;
  labels: boolean;
  showCurrent: boolean;
  running: boolean;
  pinHigh: boolean;
  resetTick: number; // bumped by resetView(); the camera re-applies the current view preset
  booting: boolean;  // the board was just reset and its bootloader is running
  assembled: boolean; // the open project's circuit has finished building (labels and current wait for it)
  bootLed: boolean;  // the L LED's bootloader flashes
  resetCount: number;
  cameraCmd: { kind: 'rotate' | 'zoom'; amount: number; seq: number } | null; // toolbar rotate/zoom buttons
  uploading: boolean;        // the sketch is being uploaded (Run pressed)
  uploadProgress: number;    // 0..1
  line: number | null;       // sketch line currently running, for highlighting
  serial: string[];          // serial monitor output (latest 200 lines; the last may still be growing)
  serialOpen: boolean;       // the last serial line has no line ending yet
  serialInput: string;       // text typed into the serial monitor, waiting for the board to take it
  program: Program;          // the compiled program the board runs (Run uploads it)
  simSpeed: number;          // simulated time ÷ real time (below 1 on a slow device)
  rxLed: boolean; txLed: boolean;
  setView(v: View): void;
  resetView(): void;
  nudgeCamera(kind: 'rotate' | 'zoom', amount: number): void;
  upload(): void; // Run: upload the sketch, then it starts
  setUploading(u: boolean, progress?: number): void;
  setLine(l: number | null): void;
  appendSerialText(text: string): void; // what the board printed
  serialSend(text: string): void;       // the learner sends a line to the board
  takeSerialInput(): string;            // the board takes what was sent
  loadProgram(p: Program): void;        // upload and run another program
  setSimSpeed(x: number): void;
  clearSerial(): void;
  setSerialLeds(rx: boolean, tx: boolean): void;
  resetBoard(): void; // the board's reset button: reboot, then restart the program from the beginning
  setBooting(b: boolean): void;
  setAssembled(b: boolean): void;
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
  assembled: false,
  bootLed: false,
  resetCount: 0,
  cameraCmd: null,
  uploading: false,
  uploadProgress: 0,
  line: null,
  serial: [],
  serialOpen: false,
  serialInput: '',
  program: BLINK.program,
  simSpeed: 1,
  rxLed: false,
  txLed: false,
  setView: (view) => set({ view }),
  resetView: () => set({ resetTick: get().resetTick + 1 }),
  nudgeCamera: (kind, amount) => set({ cameraCmd: { kind, amount, seq: (get().cameraCmd?.seq ?? 0) + 1 } }),
  upload: () => set({ running: true, uploading: true, uploadProgress: 0, pinHigh: false, serial: [], serialOpen: false, serialInput: '', line: null, booting: false }),
  setUploading: (uploading, progress = 0) => set({ uploading, uploadProgress: progress }),
  setLine: (line) => set({ line }),
  appendSerialText: (text) => {
    const parts = text.replace(/\r/g, '').split('\n');
    const serial = [...get().serial];
    if (get().serialOpen && serial.length) serial[serial.length - 1] += parts.shift();
    else serial.push(parts.shift()!);
    serial.push(...parts);
    const open = !text.endsWith('\n');
    if (!open) serial.pop(); // the text ended a line: no empty line after it
    set({ serial: serial.slice(-200), serialOpen: open });
  },
  serialSend: (text) => set({ serialInput: get().serialInput + text + '\n' }), // the Arduino IDE's default "Newline" ending
  takeSerialInput: () => { const t = get().serialInput; if (t) set({ serialInput: '' }); return t; },
  loadProgram: (program) => { set({ program }); get().upload(); },
  setSimSpeed: (simSpeed) => set({ simSpeed }),
  clearSerial: () => set({ serial: [], serialOpen: false }),
  setSerialLeds: (rxLed, txLed) => set({ rxLed, txLed }),
  resetBoard: () => set({ booting: true, pinHigh: false, resetCount: get().resetCount + 1 }),
  setAssembled: (assembled) => { if (get().assembled !== assembled) set({ assembled }); },
  setBooting: (booting) => set(booting ? { booting } : { booting, bootLed: false }),
  setBootLed: (bootLed) => set({ bootLed }),
  toggleLabels: () => set({ labels: !get().labels }),
  // Showing current only makes sense on the wired circuit with the program running.
  toggleCurrent: () => (get().showCurrent ? set({ showCurrent: false }) : set({ showCurrent: true, view: 'circuit', running: true })),
  setRunning: (running) => set(running ? { running } : { running, pinHigh: false, uploading: false, line: null, rxLed: false, txLed: false }),
  setPinHigh: (pinHigh) => set({ pinHigh }),
}));
