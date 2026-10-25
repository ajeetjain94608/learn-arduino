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
