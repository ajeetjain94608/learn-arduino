// Shared types of the compile → run pipeline.

// One row of a program's line table: from byte address `addr` on, the code belongs to sketch line `line`
// (1-based), or to something else (core, library, inlined header) when `line` is 0. Sorted by addr.
export type LineEntry = { addr: number; line: number };

// A compiler message mapped to the learner's sketch: 1-based line and column, plus a plain-language hint for the
// most common beginner mistakes. Notes ("declared here", "suggested alternative") belong to the message before them.
export type Diagnostic = {
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'note';
  message: string;
  hint?: string;
  notes?: { line: number; message: string }[];
};

// A compiled sketch, ready to run on the simulated UNO.
export type Program = { hex: string; flashBytes: number; ramBytes: number; lines: LineEntry[] };

export type CompileResult =
  | { ok: true; program: Program; diagnostics: Diagnostic[]; ms: number }
  | { ok: false; diagnostics: Diagnostic[]; ms: number };

// Sketch in → program + diagnostics out. One interface so each platform can bring its own compiler
// (GCC as WebAssembly on Android and the web; LLVM later on iOS — Build design §4).
export interface Compiler {
  compile(sketch: string): Promise<CompileResult>;
  cancel?(): void; // stop the compile in progress (its promise rejects); the next compile starts fresh
}
