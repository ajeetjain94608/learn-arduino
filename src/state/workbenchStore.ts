import { create } from 'zustand';
import { getCompiler } from '../build/compiler/compiler';
import type { Diagnostic, Program } from '../build/compiler/types';
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
  code: string;              // the sketch in the editor
  compiling: boolean;
  diagnostics: Diagnostic[]; // the last compile's errors and warnings
  compileSeq: number;        // bumped by every compile and by Stop: a result for an older seq is ignored
  simSpeed: number;          // simulated time ÷ real time (below 1 on a slow device)
  rxLed: boolean; txLed: boolean;
  setView(v: View): void;
  resetView(): void;
  nudgeCamera(kind: 'rotate' | 'zoom', amount: number): void;
  upload(): void; // Run: compile the sketch if it changed, upload it, then it starts
  setCode(code: string): void;
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

const MAX_LINE = 1024; // longest serial monitor line

// Start the upload animation; the simulated board runs `program` when it ends.
function startUpload(set: (p: Partial<WorkbenchState>) => void) {
  set({ running: true, uploading: true, uploadProgress: 0, pinHigh: false, serial: [], serialOpen: false, serialInput: '', line: null, booting: false });
}

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
  code: BLINK.code,
  compiling: false,
  diagnostics: [],
  compileSeq: 0,
  simSpeed: 1,
  rxLed: false,
  txLed: false,
  setView: (view) => set({ view }),
  resetView: () => set({ resetTick: get().resetTick + 1 }),
  nudgeCamera: (kind, amount) => set({ cameraCmd: { kind, amount, seq: (get().cameraCmd?.seq ?? 0) + 1 } }),
  upload: () => {
    const { code } = get();
    if (get().compiling) getCompiler().cancel?.(); // one compile at a time: a new Run replaces the old one
    // the project's own sketch is shipped precompiled: no compile needed
    if (code === BLINK.code) {
      set({ program: BLINK.program, diagnostics: [], compiling: false, compileSeq: get().compileSeq + 1 });
      startUpload(set);
      return;
    }
    const seq = get().compileSeq + 1;
    set({ compiling: true, compileSeq: seq, diagnostics: [] });
    const done = (patch: Partial<WorkbenchState>, program?: Program) => {
      if (get().compileSeq !== seq) return; // a newer Run, or Stop, came first
      set({ compiling: false, ...patch });
      if (program) { set({ program }); startUpload(set); }
    };
    getCompiler().compile(code).then(
      (r) => done({ diagnostics: r.diagnostics }, r.ok ? r.program : undefined),
      (e: unknown) => done({ diagnostics: [{ line: 1, col: 1, severity: 'error', message: e instanceof Error ? e.message : String(e) }] }),
    );
  },
  setCode: (code) => set({ code }),
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
    // output without line endings (Serial.print in a loop) wraps every MAX_LINE characters instead of growing forever
    const capped = serial.flatMap((l) => (l.length <= MAX_LINE ? [l] : Array.from({ length: Math.ceil(l.length / MAX_LINE) }, (_, i) => l.slice(i * MAX_LINE, (i + 1) * MAX_LINE))));
    set({ serial: capped.slice(-200), serialOpen: open });
  },
  serialSend: (text) => set({ serialInput: get().serialInput + text + '\n' }), // the Arduino IDE's default "Newline" ending
  takeSerialInput: () => { const t = get().serialInput; if (t) set({ serialInput: '' }); return t; },
  loadProgram: (program) => { set({ program }); startUpload(set); },
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
  setRunning: (running) => {
    if (!running && get().compiling) getCompiler().cancel?.();
    set(running ? { running } : { running, pinHigh: false, uploading: false, line: null, rxLed: false, txLed: false, compiling: false, compileSeq: get().compileSeq + 1 });
  },
  setPinHigh: (pinHigh) => set({ pinHigh }),
}));
