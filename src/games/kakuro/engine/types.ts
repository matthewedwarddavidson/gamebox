// Core types for Kakuro (a numbers crossword).
//
// The player is shown a grid of black "clue" cells and white "fill" cells. The
// white cells form horizontal and vertical *runs* (maximal white sequences).
// Each run has a target sum, printed in the clue cell at its start (the across
// sum in the top-right triangle, the down sum in the bottom-left). Fill every
// white cell with a digit 1–9 so each run's digits are distinct and add up to
// its clue. Every generated puzzle has a single unique solution.

/** Difficulty controls the grid size and how densely blacked-out it is. */
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type Mode = 'daily' | 'free';

/** Grid size per difficulty (square, including the header row and column). */
export const SIZE_FOR: Record<Difficulty, number> = {
  easy: 5,
  medium: 6,
  hard: 7,
};

/**
 * A grid cell. `fill` cells are white and hold a digit; otherwise the cell is a
 * black clue cell that may carry the sum of the run to its `right` and/or the
 * run below it (`down`). Plain black cells carry neither.
 */
export interface Cell {
  fill: boolean;
  right?: number;
  down?: number;
}

/** A maximal run of white cells, owned by the clue cell at its start. */
export interface Run {
  clueIndex: number;
  dir: 'right' | 'down';
  cells: number[]; // fill-cell indices, in reading order
}

export interface Puzzle {
  id: string;
  size: number;
  seed: number;
  difficulty: Difficulty;
  cells: Cell[]; // row-major
  solution: number[]; // digit per cell, 0 for clue cells
  createdAt: number;
}

/** Row-major index of a cell. */
export function idx(row: number, col: number, size: number): number {
  return row * size + col;
}

/**
 * Derive every across and down run from a cell layout. A run starts in the cell
 * immediately after a clue cell (which becomes its owner) and extends over the
 * consecutive white cells that follow.
 */
export function computeRuns(cells: Cell[], size: number): Run[] {
  const runs: Run[] = [];

  // Across runs.
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (cells[idx(r, c, size)].fill) {
        c++;
        continue;
      }
      const clueIndex = idx(r, c, size);
      const run: number[] = [];
      let cc = c + 1;
      while (cc < size && cells[idx(r, cc, size)].fill) {
        run.push(idx(r, cc, size));
        cc++;
      }
      if (run.length > 0) runs.push({ clueIndex, dir: 'right', cells: run });
      c = cc > c ? cc : c + 1;
    }
  }

  // Down runs.
  for (let c = 0; c < size; c++) {
    let r = 0;
    while (r < size) {
      if (cells[idx(r, c, size)].fill) {
        r++;
        continue;
      }
      const clueIndex = idx(r, c, size);
      const run: number[] = [];
      let rr = r + 1;
      while (rr < size && cells[idx(rr, c, size)].fill) {
        run.push(idx(rr, c, size));
        rr++;
      }
      if (run.length > 0) runs.push({ clueIndex, dir: 'down', cells: run });
      r = rr > r ? rr : r + 1;
    }
  }

  return runs;
}
