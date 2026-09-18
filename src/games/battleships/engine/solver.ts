// Solver / uniqueness checker for Solitaire Battleships.
//
// Counts the solutions (up to a limit) consistent with the row/column segment
// counts, the fleet (multiset of ship lengths), the no-touch rule (ships never
// share an edge or corner), and any revealed hint cells. Used both to verify a
// generated puzzle is uniquely solvable and to derive a canonical solution.

import { idx, segmentType, isShip, type CellType, type Hint } from './types';

export interface SolveInput {
  size: number;
  fleet: number[]; // ship lengths
  rowCounts: number[];
  colCounts: number[];
  hints: Hint[];
}

export interface SolveResult {
  count: number; // number of solutions found (capped at `limit`)
  solution?: CellType[]; // one concrete solution (row-major), if any
  solutions: CellType[][]; // up to `limit` concrete solutions
}

export function solve(input: SolveInput, limit = 2): SolveResult {
  const { size, rowCounts, colCounts, hints } = input;
  const cells = size * size;

  // Ships largest-first improves pruning.
  const ships = [...input.fleet].sort((a, b) => b - a);

  // Hint lookups.
  const shipHint: (CellType | undefined)[] = new Array(cells).fill(undefined);
  const waterHint = new Uint8Array(cells);
  const shipHintCells: number[] = [];
  for (const h of hints) {
    const i = idx(h.row, h.col, size);
    if (isShip(h.type)) {
      shipHint[i] = h.type;
      shipHintCells.push(i);
    } else {
      waterHint[i] = 1;
    }
  }

  const occupied = new Uint8Array(cells);
  const rowRem = [...rowCounts];
  const colRem = [...colCounts];

  const anchorKey = (r: number, c: number, horizontal: boolean): number =>
    ((r * size + c) << 1) | (horizontal ? 0 : 1);

  const neighborsClear = (r: number, c: number): boolean => {
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
  };

  const canPlace = (r: number, c: number, len: number, horizontal: boolean): boolean => {
    // Bounds.
    if (horizontal) {
      if (c + len > size) return false;
      if (rowRem[r] < len) return false;
    } else {
      if (r + len > size) return false;
      if (colRem[c] < len) return false;
    }
    for (let k = 0; k < len; k++) {
      const rr = horizontal ? r : r + k;
      const cc = horizontal ? c + k : c;
      const i = idx(rr, cc, size);
      if (occupied[i]) return false;
      if (waterHint[i]) return false;
      // Per-cell capacity in the perpendicular direction.
      if (horizontal) {
        if (colRem[cc] < 1) return false;
      } else {
        if (rowRem[rr] < 1) return false;
      }
      // Hinted ship cells must match this segment's type.
      const hintType = shipHint[i];
      if (hintType !== undefined && hintType !== segmentType(k, len, horizontal)) return false;
      // No-touch: nothing already placed in the 8-neighborhood.
      if (!neighborsClear(rr, cc)) return false;
    }
    return true;
  };

  const fill = (r: number, c: number, len: number, horizontal: boolean, on: boolean): void => {
    for (let k = 0; k < len; k++) {
      const rr = horizontal ? r : r + k;
      const cc = horizontal ? c + k : c;
      occupied[idx(rr, cc, size)] = on ? 1 : 0;
      rowRem[rr] += on ? -1 : 1;
      colRem[cc] += on ? -1 : 1;
    }
  };

  let count = 0;
  const solutions: CellType[][] = [];

  const record = (): void => {
    // Reconstruct segment types from the occupancy grid.
    const grid: CellType[] = new Array(cells).fill('water');
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!occupied[idx(r, c, size)]) continue;
        const left = c > 0 && occupied[idx(r, c - 1, size)];
        const right = c < size - 1 && occupied[idx(r, c + 1, size)];
        const up = r > 0 && occupied[idx(r - 1, c, size)];
        const down = r < size - 1 && occupied[idx(r + 1, c, size)];
        let type: CellType;
        if (!left && !right && !up && !down) type = 'single';
        else if (left && right) type = 'middle';
        else if (up && down) type = 'middle';
        else if (right) type = 'left';
        else if (left) type = 'right';
        else if (down) type = 'top';
        else type = 'bottom';
        grid[idx(r, c, size)] = type;
      }
    }
    solutions.push(grid);
  };

  const allShipHintsCovered = (): boolean => {
    for (const i of shipHintCells) if (!occupied[i]) return false;
    return true;
  };

  const recurse = (shipIdx: number, minAnchor: number): void => {
    if (count >= limit) return;
    if (shipIdx === ships.length) {
      // Caps guarantee exact row/col counts; still confirm hints are honored.
      if (allShipHintsCovered()) {
        if (count < limit) record();
        count++;
      }
      return;
    }
    const len = ships[shipIdx];
    const sameAsPrev = shipIdx > 0 && ships[shipIdx - 1] === len;
    const nextSame = shipIdx + 1 < ships.length && ships[shipIdx + 1] === len;
    const orientations = len === 1 ? [true] : [true, false];

    for (const horizontal of orientations) {
      const maxR = horizontal ? size : size - len;
      const maxC = horizontal ? size - len : size;
      for (let r = 0; r < maxR; r++) {
        for (let c = 0; c < maxC; c++) {
          const key = anchorKey(r, c, horizontal);
          if (sameAsPrev && key <= minAnchor) continue;
          if (!canPlace(r, c, len, horizontal)) continue;
          fill(r, c, len, horizontal, true);
          recurse(shipIdx + 1, nextSame ? key : -1);
          fill(r, c, len, horizontal, false);
          if (count >= limit) return;
        }
      }
    }
  };

  // Sum sanity: total ship cells must equal both count sums.
  const fleetCells = ships.reduce((s, l) => s + l, 0);
  const rowSum = rowCounts.reduce((s, n) => s + n, 0);
  const colSum = colCounts.reduce((s, n) => s + n, 0);
  if (fleetCells !== rowSum || fleetCells !== colSum) {
    return { count: 0, solutions: [] };
  }

  recurse(0, -1);
  return { count, solution: solutions[0], solutions };
}
