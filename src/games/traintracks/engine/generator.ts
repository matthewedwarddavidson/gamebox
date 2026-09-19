// Puzzle generator for Train Tracks.
//
// Strategy:
//   1. Pick two border endpoints (entry + exit) with outward "stub" directions.
//   2. Build a random self-avoiding path between them (with a minimum length so
//      puzzles aren't trivial).
//   3. Derive the piece grid and per-row / per-column track counts.
//   4. Reveal the fewest givens needed for a unique solution (starting from the
//      two endpoint pieces), then add a few extra givens for easier difficulties.
//   5. Verify uniqueness with the solver.
//
// generate(seed, difficulty) is pure: same inputs => same puzzle.

import { createRng, type Rng } from '../../../shared/rng';
import { solve } from './solver';
import {
  E,
  EMPTY,
  N,
  S,
  SIZE_FOR,
  W,
  idx,
  type Dir,
  type Difficulty,
  type Endpoint,
  type Given,
  type Piece,
  type Puzzle,
} from './types';

/** Extra givens revealed beyond the minimal unique set, per difficulty. */
const EXTRA_GIVENS: Record<Difficulty, number> = {
  easy: 6,
  medium: 3,
  hard: 0,
};

const MAX_ATTEMPTS = 400;

interface BorderPick {
  cell: number;
  stub: Dir;
}

/** Pick a random border cell and its outward stub direction. */
function pickBorder(rng: Rng, size: number): BorderPick {
  const side = rng.int(0, 3); // 0=top,1=right,2=bottom,3=left
  const k = rng.int(0, size - 1);
  switch (side) {
    case 0:
      return { cell: idx(0, k, size), stub: N };
    case 1:
      return { cell: idx(k, size - 1, size), stub: E };
    case 2:
      return { cell: idx(size - 1, k, size), stub: S };
    default:
      return { cell: idx(k, 0, size), stub: W };
  }
}

/** Direction from cell `a` to orthogonally-adjacent cell `b`. */
function dirBetween(a: number, b: number, size: number): Dir {
  const ar = Math.floor(a / size);
  const ac = a % size;
  const br = Math.floor(b / size);
  const bc = b % size;
  if (br === ar - 1) return N;
  if (br === ar + 1) return S;
  if (bc === ac + 1) return E;
  return W;
}

/**
 * Random self-avoiding path from `entry` to `exit` (inclusive) of at least
 * `minLen` cells. Explores non-target neighbours first and only steps onto the
 * exit once the path is long enough, which favours longer, twistier tracks.
 */
function randomPath(
  rng: Rng,
  size: number,
  entry: number,
  exit: number,
  minLen: number,
): number[] | null {
  const visited = new Uint8Array(size * size);
  const path: number[] = [];

  // Bound the self-avoiding walk: a randomized DFS can backtrack pathologically
  // for some seeds, so cap the work and let the caller retry another attempt.
  let budget = 60_000;

  const neighbours = (cell: number): number[] => {
    const r = Math.floor(cell / size);
    const c = cell % size;
    const out: number[] = [];
    if (r > 0) out.push(idx(r - 1, c, size));
    if (r < size - 1) out.push(idx(r + 1, c, size));
    if (c > 0) out.push(idx(r, c - 1, size));
    if (c < size - 1) out.push(idx(r, c + 1, size));
    return rng.shuffle(out);
  };

  const dfs = (cell: number): boolean => {
    if (budget-- <= 0) return false;
    visited[cell] = 1;
    path.push(cell);

    const nbs = neighbours(cell);
    // Explore non-exit neighbours first for longer paths.
    for (const nb of nbs) {
      if (nb === exit) continue;
      if (visited[nb]) continue;
      if (dfs(nb)) return true;
      if (budget <= 0) {
        visited[cell] = 0;
        path.pop();
        return false;
      }
    }
    // Only finish by stepping to the exit once the path is long enough.
    if (path.length >= minLen && nbs.includes(exit) && !visited[exit]) {
      visited[exit] = 1;
      path.push(exit);
      return true;
    }

    visited[cell] = 0;
    path.pop();
    return false;
  };

  return dfs(entry) ? path : null;
}

/** Build the row-major piece grid from a path plus the two endpoint stubs. */
function buildSolution(
  path: number[],
  size: number,
  entryStub: Dir,
  exitStub: Dir,
): Piece[] {
  const grid: Piece[] = new Array(size * size).fill(EMPTY);
  for (let k = 0; k < path.length; k++) {
    const cell = path[k];
    let mask = 0;
    if (k > 0) mask |= dirBetween(cell, path[k - 1], size);
    if (k < path.length - 1) mask |= dirBetween(cell, path[k + 1], size);
    grid[cell] = mask;
  }
  grid[path[0]] |= entryStub;
  grid[path[path.length - 1]] |= exitStub;
  return grid;
}

function countsFrom(solution: Piece[], size: number): { row: number[]; col: number[] } {
  const row = new Array(size).fill(0);
  const col = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solution[idx(r, c, size)] !== EMPTY) {
        row[r]++;
        col[c]++;
      }
    }
  }
  return { row, col };
}

function givenAt(solution: Piece[], i: number, size: number): Given {
  return { row: Math.floor(i / size), col: i % size, piece: solution[i] };
}

export function generate(seed: number, difficulty: Difficulty): Puzzle {
  const size = SIZE_FOR[difficulty];
  const minLen = Math.round(size * size * 0.35);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng((seed + attempt * 0x9e3779b1) >>> 0);

    const a = pickBorder(rng, size);
    const b = pickBorder(rng, size);
    if (a.cell === b.cell) continue;

    const path = randomPath(rng, size, a.cell, b.cell, minLen);
    if (!path) continue;

    const solution = buildSolution(path, size, a.stub, b.stub);
    const { row: rowCounts, col: colCounts } = countsFrom(solution, size);

    const endpoints: [Endpoint, Endpoint] = [
      { row: Math.floor(a.cell / size), col: a.cell % size, dir: a.stub },
      { row: Math.floor(b.cell / size), col: b.cell % size, dir: b.stub },
    ];

    // Start with the two endpoint pieces given, then pin differing cells until
    // the solution is unique.
    const givens: Given[] = [
      givenAt(solution, a.cell, size),
      givenAt(solution, b.cell, size),
    ];

    let unique = false;
    for (let guard = 0; guard <= size * size; guard++) {
      const res = solve({ size, rowCounts, colCounts, endpoints, givens }, 2);
      if (res.count <= 1) {
        unique = res.count === 1;
        break;
      }
      const [s0, s1] = res.solutions;
      let diff = -1;
      for (let i = 0; i < s0.length; i++) {
        if (s0[i] !== s1[i]) {
          diff = i;
          break;
        }
      }
      if (diff === -1) break; // shouldn't happen
      givens.push(givenAt(solution, diff, size));
    }
    if (!unique) continue;

    // Add extra givens for easier difficulties (never breaks uniqueness).
    const extra = EXTRA_GIVENS[difficulty];
    if (extra > 0) {
      const revealed = new Set(givens.map((g) => idx(g.row, g.col, size)));
      const pool: number[] = [];
      for (let i = 0; i < solution.length; i++) {
        if (solution[i] !== EMPTY && !revealed.has(i)) pool.push(i);
      }
      rng.shuffle(pool);
      for (let k = 0; k < extra && k < pool.length; k++) {
        givens.push(givenAt(solution, pool[k], size));
      }
    }

    return {
      id: `tt-${size}-${difficulty}-${seed}`,
      size,
      seed,
      difficulty,
      rowCounts,
      colCounts,
      endpoints,
      givens,
      solution,
      createdAt: Date.now(),
    };
  }

  // Extremely unlikely: nudge the seed and retry.
  if (seed > Number.MAX_SAFE_INTEGER - 2) throw new Error('traintracks: generation failed');
  return generate(seed + 1, difficulty);
}
