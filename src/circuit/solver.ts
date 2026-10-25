// A small DC circuit solver (nodal analysis) — enough for breadboard circuits: resistors, sources with an internal
// resistance (pins, 5 V, 3.3 V) and diodes/LEDs as "off" or "forward voltage + small resistance".
// Nodes are net numbers; `ground` is the reference (0 V).

export type Element =
  | { kind: 'R'; a: number; b: number; ohms: number }
  | { kind: 'V'; node: number; volts: number; ohms: number } // a source to ground through `ohms`
  | { kind: 'D'; a: number; k: number; vf: number; ron: number }; // anode a, cathode k

const GMIN = 1e-9; // 1 GΩ from every node to ground: no node is left floating
const MAX_ROUNDS = 20;

// Solves A x = b in place (Gaussian elimination with partial pivoting).
function linearSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    const d = A[c][c] || 1e-30;
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / d;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / (A[r][r] || 1e-30);
  }
  return x;
}

// volts[node]; current[i] through element i: a→b for R, out of the source into its node for V, anode→cathode for D.
export function solve(elements: Element[], nodeCount: number, ground: number): { volts: number[]; current: number[] } {
  const row = (node: number) => (node === ground ? -1 : node < ground ? node : node - 1);
  const n = nodeCount - 1;
  const on = elements.map(() => false);
  let volts = new Array<number>(nodeCount).fill(0);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const b = new Array<number>(n).fill(0);
    const conduct = (x: number, y: number, g: number) => {
      const i = row(x), j = row(y);
      if (i >= 0) A[i][i] += g;
      if (j >= 0) A[j][j] += g;
      if (i >= 0 && j >= 0) { A[i][j] -= g; A[j][i] -= g; }
    };
    const inject = (node: number, amps: number) => { const i = row(node); if (i >= 0) b[i] += amps; };
    for (let i = 0; i < n; i++) A[i][i] += GMIN;
    elements.forEach((e, idx) => {
      if (e.kind === 'R') conduct(e.a, e.b, 1 / Math.max(e.ohms, 1e-6));
      else if (e.kind === 'V') { const g = 1 / Math.max(e.ohms, 1e-6); conduct(e.node, ground, g); inject(e.node, e.volts * g); }
      else if (on[idx]) { const g = 1 / e.ron; conduct(e.a, e.k, g); inject(e.a, e.vf * g); inject(e.k, -e.vf * g); }
    });
    const x = linearSolve(A, b);
    volts = Array.from({ length: nodeCount }, (_, node) => (node === ground ? 0 : x[row(node)]));

    let changed = false;
    elements.forEach((e, idx) => {
      if (e.kind !== 'D') return;
      const vd = volts[e.a] - volts[e.k];
      if (!on[idx] && vd > e.vf + 1e-9) { on[idx] = true; changed = true; }
      else if (on[idx] && vd < e.vf - 1e-9) { on[idx] = false; changed = true; }
    });
    if (!changed) break;
  }

  const current = elements.map((e, idx) => {
    if (e.kind === 'R') return (volts[e.a] - volts[e.b]) / Math.max(e.ohms, 1e-6);
    if (e.kind === 'V') return (e.volts - volts[e.node]) / Math.max(e.ohms, 1e-6);
    return on[idx] ? (volts[e.a] - volts[e.k] - e.vf) / e.ron : 0;
  });
  return { volts, current };
}
