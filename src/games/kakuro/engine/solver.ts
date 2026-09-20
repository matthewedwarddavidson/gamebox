// Solver / uniqueness checker for Kakuro.
//
// Assign a digit (1–9) to every white cell in row-major order. Each cell belongs
// to at most one across run and one down run; we track, per run, the set of
// digits already used, the running sum and how many cells are still to come.
// Because we fill row-major, all earlier cells of a cell's across run (to its
// left) and down run (above it) are already assigned, so the constraints can be
// checked incrementally. We prune whenever a run would exceed its target or the
// final cell of a run fails to hit it exactly, then count full assignments.

import { computeRuns, type Cell } from './types';

export interface SolveInput {
  size: number;
  cells: Cell[];
}

export interface SolveResult {
  count: number; // number of solutions found (capped at `limit`)
  solution?: number[]; // one concrete solution (row-major), if any
}

export function solve(input: SolveInput, limit = 2): SolveResult {
  const { size, cells } = input;
  const n = size * size;
  const runs = computeRuns(cells, size);

  const runTarget = new Array<number>(runs.length);
  const runLen = new Array<number>(runs.length);
  const hRunOf = new Int32Array(n).fill(-1);
  const vRunOf = new Int32Array(n).fill(-1);

  runs.forEach((run, id) => {
    const owner = cells[run.clueIndex];
    runTarget[id] = (run.dir === 'right' ? owner.right : owner.down) ?? 0;
    runLen[id] = run.cells.length;
    for (const ci of run.cells) {
      if (run.dir === 'right') hRunOf[ci] = id;
      else vRunOf[ci] = id;
    }
  });

  const fillCells: number[] = [];
  for (let i = 0; i < n; i++) if (cells[i].fill) fillCells.push(i);

  const runUsed = new Int32Array(runs.length);
  const runSum = new Int32Array(runs.length);
  const runCount = new Int32Array(runs.length);
  const digits = new Int8Array(n);

  let count = 0;
  let firstSolution: number[] | undefined;

  function fits(run: number, d: number): boolean {
    if (run < 0) return true;
    if (runUsed[run] & (1 << d)) return false;
    const newSum = runSum[run] + d;
    if (newSum > runTarget[run]) return false;
    const isLast = runCount[run] + 1 === runLen[run];
    if (isLast) return newSum === runTarget[run];
    // Enough headroom left for the remaining distinct positive digits?
    const remCount = runLen[run] - (runCount[run] + 1);
    return runTarget[run] - newSum >= remCount;
  }

  function recurse(k: number): void {
    if (count >= limit) return;
    if (k === fillCells.length) {
      count++;
      if (!firstSolution) firstSolution = Array.from(digits, (x) => x);
      return;
    }
    const i = fillCells[k];
    const h = hRunOf[i];
    const v = vRunOf[i];
    for (let d = 1; d <= 9; d++) {
      if (!fits(h, d) || !fits(v, d)) continue;
      const bit = 1 << d;
      digits[i] = d;
      if (h >= 0) {
        runUsed[h] |= bit;
        runSum[h] += d;
        runCount[h]++;
      }
      if (v >= 0) {
        runUsed[v] |= bit;
        runSum[v] += d;
        runCount[v]++;
      }
      recurse(k + 1);
      if (h >= 0) {
        runUsed[h] &= ~bit;
        runSum[h] -= d;
        runCount[h]--;
      }
      if (v >= 0) {
        runUsed[v] &= ~bit;
        runSum[v] -= d;
        runCount[v]--;
      }
      digits[i] = 0;
      if (count >= limit) return;
    }
  }

  recurse(0);
  return { count, solution: firstSolution };
}
