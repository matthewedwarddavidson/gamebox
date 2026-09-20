// Deterministic Kakuro generator. Pure: the same (seed, difficulty) always
// yields the same puzzle, and it never touches the DOM or the global RNG.
//
// Random clue sums almost never give a uniquely solvable puzzle, so the
// generator builds one and then repairs it until it is:
//   1. Lay out a grid — header row and column black, plus scattered interior
//      blocks — so every run is 2–maxRun cells long, every white cell sits on
//      an across and a down run, and the white region is connected.
//   2. Fill the white cells with digits that are distinct within each run and
//      derive every run's clue sum from that fill.
//   3. Ask the solver for a second solution. If one exists, black out a cell
//      where the two solutions disagree (which rewrites the affected sums) and
//      ask again, until the fill is the only solution.

import { createRng, type Rng } from '../../../shared/rng';
import { comboMasks, solve } from './solver';
import {
  DIFFICULTIES,
  SIZE_FOR,
  computeRuns,
  idx,
  type Cell,
  type Difficulty,
  type Puzzle,
  type Run,
} from './types';

interface Style {
  maxRun: number; // longest allowed run
  blocks: number; // fraction of interior cells to black out up front
}

const STYLE: Record<Difficulty, Style> = {
  easy: { maxRun: 5, blocks: 0.3 },
  medium: { maxRun: 6, blocks: 0.27 },
  hard: { maxRun: 8, blocks: 0.24 },
};

const MAX_ATTEMPTS = 60;
const MAX_REPAIRS = 40;
const LAYOUT_TRIES = 40;
const ANNEAL_STEPS = 2000;
const ALL_DIGITS = 0b1111111110;

function popcount(m: number): number {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
}
const MIN_WHITE_SHARE = 0.55; // of the interior, after repairs

function toCells(fill: boolean[]): Cell[] {
  return fill.map((f) => ({ fill: f }));
}

/** True when every white cell is reachable from every other. */
function connected(fill: boolean[], size: number): boolean {
  const start = fill.indexOf(true);
  if (start < 0) return false;
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop() as number;
    const r = Math.floor(i / size);
    const c = i % size;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
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
  return seen.size === fill.filter(Boolean).length;
}

/** Every run is at least two cells long (which also puts each white cell on
 *  both an across and a down run) and no longer than `maxRun`. */
function runsOk(fill: boolean[], size: number, maxRun: number): boolean {
  const runs = computeRuns(toCells(fill), size);
  return runs.length > 0 && runs.every((r) => r.cells.length >= 2 && r.cells.length <= maxRun);
}

/** No run is a lone cell (long runs are still allowed; they are trimmed later). */
function noLoneCells(fill: boolean[], size: number): boolean {
  return computeRuns(toCells(fill), size).every((r) => r.cells.length >= 2);
}

/** One try at a grid with a black header row/column and scattered interior blocks. */
function tryLayout(rng: Rng, size: number, style: Style): boolean[] | null {
  const fill = new Array<boolean>(size * size).fill(false);
  for (let r = 1; r < size; r++) for (let c = 1; c < size; c++) fill[idx(r, c, size)] = true;

  const interior = (size - 1) * (size - 1);
  const target = Math.round(interior * style.blocks);
  let blocks = 0;
  const block = (i: number): boolean => {
    if (!fill[i]) return false;
    fill[i] = false;
    if (noLoneCells(fill, size) && connected(fill, size)) return true;
    fill[i] = true;
    return false;
  };

  for (let tries = 0; tries < 600 && blocks < target; tries++) {
    if (block(idx(rng.int(1, size - 1), rng.int(1, size - 1), size))) blocks++;
  }

  // Trim any run that is still too long by blocking a cell inside it.
  for (let pass = 0; pass < 200; pass++) {
    const long = computeRuns(toCells(fill), size).filter((r) => r.cells.length > style.maxRun);
    if (long.length === 0) break;
    const run = rng.pick(long);
    for (const i of rng.shuffle(run.cells.slice())) if (block(i)) break;
  }

  return runsOk(fill, size, style.maxRun) && connected(fill, size) ? fill : null;
}

/** A layout satisfying the run and connectivity rules (a try often fails, so retry). */
function buildLayout(rng: Rng, size: number, style: Style): boolean[] | null {
  for (let i = 0; i < LAYOUT_TRIES; i++) {
    const layout = tryLayout(rng, size, style);
    if (layout) return layout;
  }
  return null;
}

/** A random digit per white cell, distinct within every run. */
function randomFill(rng: Rng, fill: boolean[], size: number): number[] | null {
  const runs = computeRuns(toCells(fill), size);
  const n = size * size;
  const hRunOf = new Int32Array(n).fill(-1);
  const vRunOf = new Int32Array(n).fill(-1);
  runs.forEach((run, id) => {
    for (const ci of run.cells) {
      if (run.dir === 'right') hRunOf[ci] = id;
      else vRunOf[ci] = id;
    }
  });
  const whites: number[] = [];
  for (let i = 0; i < n; i++) if (fill[i]) whites.push(i);

  const used = new Int32Array(runs.length);
  const digits = new Int8Array(n);
  let budget = 20000;

  function place(k: number): boolean {
    if (k === whites.length) return true;
    if (budget-- <= 0) return false;
    const i = whites[k];
    const h = hRunOf[i];
    const v = vRunOf[i];
    for (const d of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const bit = 1 << d;
      if ((h >= 0 && used[h] & bit) || (v >= 0 && used[v] & bit)) continue;
      digits[i] = d;
      if (h >= 0) used[h] |= bit;
      if (v >= 0) used[v] |= bit;
      if (place(k + 1)) return true;
      if (h >= 0) used[h] &= ~bit;
      if (v >= 0) used[v] &= ~bit;
      digits[i] = 0;
    }
    return false;
  }

  return place(0) ? Array.from(digits, (x) => x) : null;
}

/**
 * How ambiguous a set of clues is to basic logic: the number of candidate
 * digits left over (beyond one per cell) once each run's sum has been used to
 * rule out impossible digits. Zero means the clues pin down every cell without
 * any guessing. Cheap and smooth, unlike counting solutions.
 */
function ambiguity(runs: Run[], clues: number[], size: number, whites: number[]): number {
  const cand = new Int16Array(size * size);
  for (const i of whites) cand[i] = ALL_DIGITS;

  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    runs.forEach((run, id) => {
      let union = 0;
      for (const ci of run.cells) union |= cand[ci];
      let allowed = 0;
      for (const mask of comboMasks(run.cells.length, clues[id])) {
        if ((mask & ~union) === 0 && run.cells.every((ci) => cand[ci] & mask)) allowed |= mask;
      }
      for (const ci of run.cells) {
        const next = cand[ci] & allowed;
        if (next !== cand[ci]) {
          cand[ci] = next;
          changed = true;
        }
      }
      // A settled cell rules its digit out for the rest of the run.
      for (const ci of run.cells) {
        if ((cand[ci] & (cand[ci] - 1)) !== 0 || cand[ci] === 0) continue;
        for (const cj of run.cells) {
          if (cj !== ci && cand[cj] & cand[ci]) {
            cand[cj] &= ~cand[ci];
            changed = true;
          }
        }
      }
    });
    if (!changed) break;
  }

  let extra = 0;
  for (const i of whites) extra += popcount(cand[i]) - 1;
  return extra;
}

/**
 * Nudge the fill towards clues that basic logic can resolve: repeatedly change
 * one digit (or swap two within a run), keeping the move when it does not make
 * the clues more ambiguous (occasionally accepting a worse one to escape dead
 * ends). Stops as soon as nothing is ambiguous.
 */
function anneal(rng: Rng, fill: boolean[], digits: number[], size: number): number[] {
  const cells = toCells(fill);
  const runs = computeRuns(cells, size);
  const runsOf: number[][] = digits.map(() => []);
  runs.forEach((run, id) => run.cells.forEach((ci) => runsOf[ci].push(id)));
  const whites = fill.flatMap((f, i) => (f ? [i] : []));

  const energy = (arr: number[]): number =>
    ambiguity(
      runs,
      runs.map((run) => run.cells.reduce((sum, ci) => sum + arr[ci], 0)),
      size,
      whites,
    );

  const distinct = (id: number, arr: number[]): boolean =>
    new Set(runs[id].cells.map((ci) => arr[ci])).size === runs[id].cells.length;

  const sol = digits.slice();
  let current = energy(sol);
  let temperature = 1;
  for (let step = 0; step < ANNEAL_STEPS && current > 0; step++) {
    const i = rng.pick(whites);
    const old = sol[i];
    let j = -1;
    let oldJ = 0;

    if (rng.next() < 0.5) {
      // Recolour: any digit not already used in either of the cell's runs.
      const taken = new Set<number>();
      for (const id of runsOf[i]) for (const ci of runs[id].cells) taken.add(sol[ci]);
      const free = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !taken.has(d));
      if (free.length === 0) continue;
      sol[i] = rng.pick(free);
    } else {
      // Swap with another cell in one of its runs; keep it only if the crossing
      // runs stay distinct.
      j = rng.pick(runs[rng.pick(runsOf[i])].cells);
      if (j === i) continue;
      oldJ = sol[j];
      sol[i] = oldJ;
      sol[j] = old;
      if (![...runsOf[i], ...runsOf[j]].every((id) => distinct(id, sol))) {
        sol[i] = old;
        sol[j] = oldJ;
        continue;
      }
    }

    const next = energy(sol);
    if (next <= current || rng.next() < Math.exp((current - next) / temperature)) {
      current = next;
    } else {
      sol[i] = old;
      if (j >= 0) sol[j] = oldJ;
    }
    temperature = Math.max(0.1, temperature * 0.998);
  }
  return sol;
}

/** Cells with each run's clue sum written into its owning clue cell. */
function deriveClues(fill: boolean[], solution: number[], size: number): Cell[] {
  const cells = toCells(fill);
  for (const run of computeRuns(cells, size)) {
    let sum = 0;
    for (const ci of run.cells) sum += solution[ci];
    if (run.dir === 'right') cells[run.clueIndex].right = sum;
    else cells[run.clueIndex].down = sum;
  }
  return cells;
}

/** `fill` with cell `i` blacked out, plus any cells it leaves as one-cell runs. */
function blackOut(fill: boolean[], i: number, size: number): boolean[] {
  const next = fill.slice();
  next[i] = false;
  for (;;) {
    const lone = computeRuns(toCells(next), size).find((r) => r.cells.length === 1);
    if (!lone) return next;
    next[lone.cells[0]] = false;
  }
}

/**
 * Black out cells where the fill and a rival solution disagree until the fill
 * is the only solution. Returns the resulting layout and digits, or null if
 * the grid could not be repaired without becoming invalid or too sparse.
 */
function repairToUnique(
  rng: Rng,
  fill: boolean[],
  digits: number[],
  size: number,
  maxRun: number,
): { fill: boolean[]; solution: number[]; cells: Cell[] } | null {
  const minWhites = Math.ceil((size - 1) * (size - 1) * MIN_WHITE_SHARE);
  const layout = fill.slice();
  const solution = digits.slice();

  for (let repair = 0; repair <= MAX_REPAIRS; repair++) {
    const cells = deriveClues(layout, solution, size);
    const { solutions } = solve({ size, cells }, 2);
    const rival = solutions.find((s) => s.some((d, i) => d !== solution[i]));
    if (!rival) return { fill: layout, solution, cells };

    // Blacking a cell can strand its neighbours as one-cell runs; black those
    // too. Prefer the candidate that costs the fewest white cells.
    let best: boolean[][] = [];
    let bestWhites = -1;
    for (let i = 0; i < layout.length; i++) {
      if (!layout[i] || rival[i] === solution[i]) continue;
      const next = blackOut(layout, i, size);
      if (!runsOk(next, size, maxRun) || !connected(next, size)) continue;
      const whites = next.filter(Boolean).length;
      if (whites > bestWhites) {
        best = [next];
        bestWhites = whites;
      } else if (whites === bestWhites) {
        best.push(next);
      }
    }
    if (best.length === 0 || bestWhites < minWhites) return null;

    const next = rng.pick(best);
    for (let i = 0; i < layout.length; i++) {
      if (layout[i] && !next[i]) solution[i] = 0;
      layout[i] = next[i];
    }
  }
  return null;
}

export function generate(seed: number, difficulty: Difficulty): Puzzle {
  const size = SIZE_FOR[difficulty];
  const style = STYLE[difficulty];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng((seed + attempt * 0x9e3779b1) >>> 0);
    const layout = buildLayout(rng, size, style);
    if (!layout) continue;
    const digits = randomFill(rng, layout, size);
    if (!digits) continue;
    const result = repairToUnique(rng, layout, anneal(rng, layout, digits, size), size, style.maxRun);
    if (!result) continue;
    return {
      id: `kakuro-${size}-${difficulty}-${seed}`,
      size,
      seed,
      difficulty,
      cells: result.cells,
      solution: result.solution,
      createdAt: Date.now(),
    };
  }

  // Astronomically unlikely: fall back to a neighbouring seed so we terminate.
  return generate((seed + 1) >>> 0, difficulty);
}

export { DIFFICULTIES };
