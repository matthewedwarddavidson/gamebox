// Solver / uniqueness checker for Kakuro.
//
// Depth-first search with "most constrained cell first" ordering. For every run
// we track the digits already used, the sum still to place and the number of
// cells still to fill; a precomputed table turns that state into the set of
// digits that could still appear in the run's remaining cells. A white cell's
// candidates are the digits allowed by both its across and down run, so most of
// a puzzle falls out by propagation and the search only branches when it must.

import { computeRuns, type Cell } from './types';

export interface SolveInput {
  size: number;
  cells: Cell[];
}

export interface SolveResult {
  count: number; // number of solutions found (capped at `limit`)
  solution?: number[]; // the first solution found (row-major), if any
  solutions: number[][]; // every solution found, up to `limit`
}

const ALL = 0b1111111110; // digits 1–9

const popcount = (m: number): number => {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
};

/** combos[count][sum] = every set of `count` distinct digits summing to `sum`. */
const combos: number[][][] = Array.from({ length: 10 }, () =>
  Array.from({ length: 46 }, () => [] as number[]),
);
combos[0][0].push(0);
for (let m = 1; m < 512; m++) {
  const mask = m << 1;
  let sum = 0;
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) sum += d;
  combos[popcount(mask)][sum].push(mask);
}

/** Every set of `count` distinct digits summing to `sum`, as digit bitmasks. */
export function comboMasks(count: number, sum: number): readonly number[] {
  return combos[count]?.[sum] ?? [];
}

// Lazily memoised: digits that can still appear given (count, sum, available).
const reachable = new Int16Array(10 * 46 * 512).fill(-1);

/** Union of digits over all sets of `count` digits from `avail` summing to `sum`. */
function reachableDigits(count: number, sum: number, avail: number): number {
  if (sum < 0 || sum > 45) return 0;
  const key = (count * 46 + sum) * 512 + (avail >> 1);
  const cached = reachable[key];
  if (cached >= 0) return cached;
  let union = 0;
  for (const mask of combos[count][sum]) if ((mask & avail) === mask) union |= mask;
  reachable[key] = union;
  return union;
}

export function solve(input: SolveInput, limit = 2): SolveResult {
  const { size, cells } = input;
  const n = size * size;
  const runs = computeRuns(cells, size);

  const hRunOf = new Int32Array(n).fill(-1);
  const vRunOf = new Int32Array(n).fill(-1);
  const runUsed = new Int32Array(runs.length);
  const runSum = new Int32Array(runs.length);
  const runLeft = new Int32Array(runs.length);

  runs.forEach((run, id) => {
    const owner = cells[run.clueIndex];
    runSum[id] = (run.dir === 'right' ? owner.right : owner.down) ?? 0;
    runLeft[id] = run.cells.length;
    for (const ci of run.cells) {
      if (run.dir === 'right') hRunOf[ci] = id;
      else vRunOf[ci] = id;
    }
  });

  const open: number[] = [];
  for (let i = 0; i < n; i++) if (cells[i].fill) open.push(i);

  const digits = new Int8Array(n);
  const solutions: number[][] = [];

  const runCandidates = (run: number): number =>
    run < 0 ? ALL : reachableDigits(runLeft[run], runSum[run], ALL & ~runUsed[run]);

  function search(remaining: number): void {
    if (remaining === 0) {
      solutions.push(Array.from(digits, (x) => x));
      return;
    }

    // Pick the open cell with the fewest candidates.
    let best = -1;
    let bestCands = 0;
    let bestCount = 10;
    for (const i of open) {
      if (digits[i]) continue;
      const cands = runCandidates(hRunOf[i]) & runCandidates(vRunOf[i]);
      const count = popcount(cands);
      if (count === 0) return;
      if (count < bestCount) {
        best = i;
        bestCands = cands;
        bestCount = count;
        if (count === 1) break;
      }
    }

    const h = hRunOf[best];
    const v = vRunOf[best];
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      if (!(bestCands & bit)) continue;
      digits[best] = d;
      if (h >= 0) {
        runUsed[h] |= bit;
        runSum[h] -= d;
        runLeft[h]--;
      }
      if (v >= 0) {
        runUsed[v] |= bit;
        runSum[v] -= d;
        runLeft[v]--;
      }
      search(remaining - 1);
      if (h >= 0) {
        runUsed[h] &= ~bit;
        runSum[h] += d;
        runLeft[h]++;
      }
      if (v >= 0) {
        runUsed[v] &= ~bit;
        runSum[v] += d;
        runLeft[v]++;
      }
      digits[best] = 0;
      if (solutions.length >= limit) return;
    }
  }

  search(open.length);
  return { count: solutions.length, solution: solutions[0], solutions };
}
