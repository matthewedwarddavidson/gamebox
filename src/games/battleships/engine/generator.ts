// Puzzle generator for Solitaire Battleships (Bimaru).
//
// Strategy:
//   1. Randomly place the fleet so no two ships touch (edges or corners).
//   2. Derive per-row / per-column ship-segment counts and the typed solution.
//   3. Reveal the fewest hints needed for a unique solution, then add a few
//      extra hints for easier difficulties.
//   4. Verify uniqueness with the solver.
//
// generate(seed, difficulty) is pure: same inputs => same puzzle.

import { createRng, type Rng } from '../../../shared/rng';
import { solve } from './solver';
import {
  BOARD_SIZE,
  STANDARD_FLEET,
  idx,
  segmentType,
  type CellType,
  type Difficulty,
  type Hint,
  type Puzzle,
} from './types';

interface Placement {
  r: number;
  c: number;
  len: number;
  horizontal: boolean;
}

/** Extra hints revealed beyond the minimal unique set, per difficulty. */
const EXTRA_HINTS: Record<Difficulty, number> = {
  easy: 9,
  medium: 4,
  hard: 0,
};

const MAX_PLACEMENT_ATTEMPTS = 200;

function neighborsClear(occupied: Uint8Array, r: number, c: number, size: number): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (occupied[idx(nr, nc, size)]) return false;
    }
  }
  return true;
}

function fits(
  occupied: Uint8Array,
  r: number,
  c: number,
  len: number,
  horizontal: boolean,
  size: number,
): boolean {
  if (horizontal ? c + len > size : r + len > size) return false;
  for (let k = 0; k < len; k++) {
    const rr = horizontal ? r : r + k;
    const cc = horizontal ? c + k : c;
    if (occupied[idx(rr, cc, size)]) return false;
    if (!neighborsClear(occupied, rr, cc, size)) return false;
  }
  return true;
}

function setShip(
  occupied: Uint8Array,
  p: Placement,
  size: number,
  on: boolean,
): void {
  for (let k = 0; k < p.len; k++) {
    const rr = p.horizontal ? p.r : p.r + k;
    const cc = p.horizontal ? p.c + k : p.c;
    occupied[idx(rr, cc, size)] = on ? 1 : 0;
  }
}

/** Try to place the whole fleet (largest first) with no ships touching. */
function placeFleet(rng: Rng, size: number, fleet: number[]): Placement[] | null {
  const ships = [...fleet].sort((a, b) => b - a);
  const occupied = new Uint8Array(size * size);
  const placements: Placement[] = [];

  const place = (shipIdx: number): boolean => {
    if (shipIdx === ships.length) return true;
    const len = ships[shipIdx];
    const orientations = len === 1 ? [true] : [true, false];

    // Build a shuffled list of candidate anchors for this ship.
    const anchors: Placement[] = [];
    for (const horizontal of orientations) {
      const maxR = horizontal ? size : size - len;
      const maxC = horizontal ? size - len : size;
      for (let r = 0; r < maxR; r++) {
        for (let c = 0; c < maxC; c++) anchors.push({ r, c, len, horizontal });
      }
    }
    rng.shuffle(anchors);

    for (const a of anchors) {
      if (!fits(occupied, a.r, a.c, len, a.horizontal, size)) continue;
      setShip(occupied, a, size, true);
      placements.push(a);
      if (place(shipIdx + 1)) return true;
      placements.pop();
      setShip(occupied, a, size, false);
    }
    return false;
  };

  return place(0) ? placements : null;
}

/** Build the typed solution grid (row-major) from ship placements. */
function buildSolution(placements: Placement[], size: number): CellType[] {
  const grid: CellType[] = new Array(size * size).fill('water');
  for (const p of placements) {
    for (let k = 0; k < p.len; k++) {
      const rr = p.horizontal ? p.r : p.r + k;
      const cc = p.horizontal ? p.c + k : p.c;
      grid[idx(rr, cc, size)] = segmentType(k, p.len, p.horizontal);
    }
  }
  return grid;
}

function countsFrom(solution: CellType[], size: number): { row: number[]; col: number[] } {
  const row = new Array(size).fill(0);
  const col = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solution[idx(r, c, size)] !== 'water') {
        row[r]++;
        col[c]++;
      }
    }
  }
  return { row, col };
}

function hintAt(solution: CellType[], i: number, size: number): Hint {
  return { row: Math.floor(i / size), col: i % size, type: solution[i] };
}

export function generate(seed: number, difficulty: Difficulty, size = BOARD_SIZE): Puzzle {
  const fleet = STANDARD_FLEET;

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const rng = createRng((seed + attempt * 0x9e3779b1) >>> 0);
    const placements = placeFleet(rng, size, fleet);
    if (!placements) continue;

    const solution = buildSolution(placements, size);
    const { row: rowCounts, col: colCounts } = countsFrom(solution, size);

    // Reveal the minimal set of hints needed for a unique solution: repeatedly
    // find a cell where two current solutions disagree and pin its true value.
    const hints: Hint[] = [];
    let unique = false;
    for (let guard = 0; guard <= size * size; guard++) {
      const res = solve({ size, fleet, rowCounts, colCounts, hints }, 2);
      if (res.count <= 1) {
        unique = res.count === 1;
        break;
      }
      const [a, b] = res.solutions;
      let diff = -1;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          diff = i;
          break;
        }
      }
      if (diff === -1) break; // shouldn't happen: count>1 but no diff
      hints.push(hintAt(solution, diff, size));
    }
    if (!unique) continue;

    // Add extra hints for easier difficulties (never breaks uniqueness).
    const extra = EXTRA_HINTS[difficulty];
    if (extra > 0) {
      const revealed = new Set(hints.map((h) => idx(h.row, h.col, size)));
      const pool: number[] = [];
      for (let i = 0; i < solution.length; i++) if (!revealed.has(i)) pool.push(i);
      rng.shuffle(pool);
      for (let k = 0; k < extra && k < pool.length; k++) {
        hints.push(hintAt(solution, pool[k], size));
      }
    }

    return {
      id: `bs-${size}-${difficulty}-${seed}`,
      size,
      seed,
      difficulty,
      fleet: [...fleet],
      rowCounts,
      colCounts,
      hints,
      solution,
      createdAt: Date.now(),
    };
  }

  // Extremely unlikely: nudge the seed and retry.
  if (seed > Number.MAX_SAFE_INTEGER - 2) throw new Error('battleships: generation failed');
  return generate(seed + 1, difficulty, size);
}

/**
 * Bump whenever generation changes what a (seed, difficulty) produces. In-progress
 * saves record the version they were made with, so a save from an older
 * generator is dropped on resume instead of being replayed against a different
 * puzzle.
 */
export const GENERATOR_VERSION = 1;
