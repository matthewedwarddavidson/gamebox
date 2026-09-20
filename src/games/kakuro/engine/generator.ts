// Deterministic Kakuro generator. Pure: the same (seed, difficulty) always
// yields the same puzzle, and it never touches the DOM or the global RNG.
//
// Generating *uniquely solvable* Kakuro by randomly filling a grid almost never
// works — random clue sums nearly always admit several solutions. So instead we
// search for uniqueness directly:
//   1. Build a valid layout — a width-3 diagonal band of white cells (every run
//      is length 2–3, every white cell lies on an across and a down run, and the
//      whole white region is connected), then apply a few random validity-
//      preserving tweaks for variety.
//   2. Fill it with a random assignment whose digits are distinct within each run.
//   3. Anneal: repeatedly nudge a cell to a different valid digit, keeping the
//      change when it lowers the number of solutions the resulting clues admit,
//      until exactly one solution remains.
// The annealer converges in a few dozen steps, so generation is fast and always
// terminates.

import { createRng, type Rng } from '../../../shared/rng';
import { solve } from './solver';
import {
  SIZE_FOR,
  computeRuns,
  idx,
  type Cell,
  type Difficulty,
  type Puzzle,
} from './types';

const MAX_RUN = 3;
const MAX_ATTEMPTS = 80;

/** The starting layout: a width-3 diagonal band of white cells. */
function bandLayout(size: number): boolean[] {
  const fill = new Array<boolean>(size * size).fill(false);
  for (let r = 1; r < size; r++) {
    for (let c = 1; c < size; c++) {
      if (c >= r - 1 && c <= r + 1) fill[idx(r, c, size)] = true;
    }
  }
  return fill;
}

function connected(fill: boolean[], size: number): boolean {
  const whites: number[] = [];
  for (let i = 0; i < fill.length; i++) if (fill[i]) whites.push(i);
  if (whites.length === 0) return false;
  const seen = new Set<number>([whites[0]]);
  const stack = [whites[0]];
  const nbr = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (stack.length) {
    const i = stack.pop() as number;
    const r = Math.floor(i / size);
    const c = i % size;
    for (const [dr, dc] of nbr) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const j = idx(nr, nc, size);
      if (fill[j] && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === whites.length;
}

/** A layout is valid when every run has length 2–MAX_RUN, every white cell lies
 *  on both an across and a down run, and the white region is connected. */
function validLayout(fill: boolean[], size: number, minWhites: number): boolean {
  if (fill.filter(Boolean).length < minWhites) return false;
  const cells: Cell[] = fill.map((f) => ({ fill: f }));
  const runs = computeRuns(cells, size);
  if (runs.length === 0) return false;
  for (const run of runs) if (run.cells.length < 2 || run.cells.length > MAX_RUN) return false;
  const inH = new Uint8Array(size * size);
  const inV = new Uint8Array(size * size);
  for (const run of runs) {
    for (const ci of run.cells) {
      if (run.dir === 'right') inH[ci] = 1;
      else inV[ci] = 1;
    }
  }
  for (let i = 0; i < size * size; i++) if (fill[i] && (!inH[i] || !inV[i])) return false;
  return connected(fill, size);
}

/** Diversify the band with a handful of validity-preserving cell toggles. */
function buildLayout(rng: Rng, size: number): boolean[] {
  const fill = bandLayout(size);
  const minWhites = 2 * (size - 1);
  const wanted = rng.int(size, 2 * size);
  let accepted = 0;
  for (let tries = 0; tries < 200 && accepted < wanted; tries++) {
    const i = idx(rng.int(1, size - 1), rng.int(1, size - 1), size);
    fill[i] = !fill[i];
    if (validLayout(fill, size, minWhites)) accepted++;
    else fill[i] = !fill[i];
  }
  return fill;
}

interface RunInfo {
  hRunOf: Int32Array;
  vRunOf: Int32Array;
  runCells: number[][];
  fillCells: number[];
}

function runInfo(fill: boolean[], size: number): RunInfo {
  const n = size * size;
  const cells: Cell[] = fill.map((f) => ({ fill: f }));
  const runs = computeRuns(cells, size);
  const hRunOf = new Int32Array(n).fill(-1);
  const vRunOf = new Int32Array(n).fill(-1);
  runs.forEach((run, id) => {
    for (const ci of run.cells) {
      if (run.dir === 'right') hRunOf[ci] = id;
      else vRunOf[ci] = id;
    }
  });
  const fillCells: number[] = [];
  for (let i = 0; i < n; i++) if (fill[i]) fillCells.push(i);
  return { hRunOf, vRunOf, runCells: runs.map((r) => r.cells), fillCells };
}

/** A random solution whose digits are distinct within every run. */
function randomFill(rng: Rng, size: number, info: RunInfo): number[] | null {
  const { hRunOf, vRunOf, fillCells } = info;
  const runUsed = new Int32Array(info.runCells.length);
  const digits = new Int8Array(size * size);
  function recurse(k: number): boolean {
    if (k === fillCells.length) return true;
    const i = fillCells[k];
    const h = hRunOf[i];
    const v = vRunOf[i];
    for (const d of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const bit = 1 << d;
      if (h >= 0 && runUsed[h] & bit) continue;
      if (v >= 0 && runUsed[v] & bit) continue;
      digits[i] = d;
      if (h >= 0) runUsed[h] |= bit;
      if (v >= 0) runUsed[v] |= bit;
      if (recurse(k + 1)) return true;
      if (h >= 0) runUsed[h] &= ~bit;
      if (v >= 0) runUsed[v] &= ~bit;
      digits[i] = 0;
    }
    return false;
  }
  return recurse(0) ? Array.from(digits, (x) => x) : null;
}

/** Cells with each run's clue sum written into its owning clue cell. */
function deriveClues(fill: boolean[], solution: number[], size: number): Cell[] {
  const cells: Cell[] = fill.map((f) => ({ fill: f }));
  for (const run of computeRuns(cells, size)) {
    let sum = 0;
    for (const ci of run.cells) sum += solution[ci];
    if (run.dir === 'right') cells[run.clueIndex].right = sum;
    else cells[run.clueIndex].down = sum;
  }
  return cells;
}

/**
 * Anneal a valid fill towards clues with a single solution. Energy is the number
 * of solutions (capped) the current clues admit; a move recolours one cell to a
 * different digit that keeps its runs valid. Returns the unique solution, or
 * null if uniqueness was not reached within the step budget.
 */
function annealUnique(rng: Rng, fill: boolean[], size: number, info: RunInfo): number[] | null {
  const sol = randomFill(rng, size, info);
  if (!sol) return null;
  const { hRunOf, vRunOf } = info;

  const energy = (arr: number[]): number =>
    solve({ size, cells: deriveClues(fill, arr, size) }, 8).count;

  const runDigits = (rid: number, arr: number[]): Set<number> => {
    const s = new Set<number>();
    for (const ci of info.runCells[rid]) s.add(arr[ci]);
    return s;
  };

  let current = energy(sol);
  if (current === 1) return sol;

  let temperature = 1.5;
  for (let step = 0; step < 3000; step++) {
    const i = rng.pick(info.fillCells);
    const h = hRunOf[i];
    const v = vRunOf[i];
    const old = sol[i];
    const hSet = h >= 0 ? runDigits(h, sol) : undefined;
    const vSet = v >= 0 ? runDigits(v, sol) : undefined;
    const candidates: number[] = [];
    for (let d = 1; d <= 9; d++) {
      if (d === old) continue;
      if (hSet?.has(d) || vSet?.has(d)) continue;
      candidates.push(d);
    }
    if (candidates.length === 0) continue;

    sol[i] = rng.pick(candidates);
    const next = energy(sol);
    const delta = next - current;
    if (delta <= 0 || rng.next() < Math.exp(-delta / temperature)) {
      current = next;
      if (current === 1) return sol;
    } else {
      sol[i] = old;
    }
    temperature = Math.max(0.05, temperature * 0.997);
  }
  return current === 1 ? sol : null;
}

export function generate(seed: number, difficulty: Difficulty): Puzzle {
  const size = SIZE_FOR[difficulty];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng((seed + attempt * 0x9e3779b1) >>> 0);
    const fill = buildLayout(rng, size);
    const info = runInfo(fill, size);
    const solution = annealUnique(rng, fill, size, info);
    if (!solution) continue;
    const cells = deriveClues(fill, solution, size);
    if (solve({ size, cells }, 2).count === 1) {
      return {
        id: `kakuro-${size}-${difficulty}-${seed}`,
        size,
        seed,
        difficulty,
        cells,
        solution,
        createdAt: Date.now(),
      };
    }
  }

  // Astronomically unlikely: fall back to a neighbouring seed so we terminate.
  return generate((seed + 1) >>> 0, difficulty);
}
