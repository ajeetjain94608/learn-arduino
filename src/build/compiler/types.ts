// Shared types of the compile → run pipeline.

// One row of a program's line table: from byte address `addr` on, the code belongs to sketch line `line`
// (1-based), or to something else (core, library, inlined header) when `line` is 0. Sorted by addr.
export type LineEntry = { addr: number; line: number };
