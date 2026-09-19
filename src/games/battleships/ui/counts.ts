// Pure helpers for the live count feedback shown around the board: per-row and
// per-column ship tallies, the fleet grouped by ship length, and the count of
// completed boats currently placed on the board.

import { idx, type Mark } from '../engine';

/** Group a fleet list into { len, count } rows, largest ship first. */
export function fleetGroups(fleet: number[]): { len: number; count: number }[] {
  const map = new Map<number, number>();
  for (const l of fleet) map.set(l, (map.get(l) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([len, count]) => ({ len, count }));
}

/** Count ship marks per row and per column for live count feedback. */
export function shipFills(
  marks: Mark[],
  size: number,
): { rowFilled: number[]; colFilled: number[] } {
  const rowFilled = new Array(size).fill(0);
  const colFilled = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (marks[idx(r, c, size)] === 'ship') {
        rowFilled[r]++;
        colFilled[c]++;
      }
    }
  }
  return { rowFilled, colFilled };
}

/**
 * Count completed boats on the board by length: a boat is a maximal, straight
 * (horizontal or vertical) run of connected ship marks. Bent or L-shaped runs
 * are not counted as a boat of any single length.
 */
export function placedBoats(marks: Mark[], size: number): Map<number, number> {
  const seen = new Array(marks.length).fill(false);
  const counts = new Map<number, number>();
  const isShipMark = (i: number) => marks[i] === 'ship';

  for (let start = 0; start < marks.length; start++) {
    if (!isShipMark(start) || seen[start]) continue;
    const cells: number[] = [];
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const j = stack.pop() as number;
      cells.push(j);
      const r = Math.floor(j / size);
      const c = j % size;
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        const nj = idx(nr, nc, size);
        if (isShipMark(nj) && !seen[nj]) {
          seen[nj] = true;
          stack.push(nj);
        }
      }
    }
    const rows = new Set(cells.map((j) => Math.floor(j / size)));
    const cols = new Set(cells.map((j) => j % size));
    if (rows.size === 1 || cols.size === 1) {
      counts.set(cells.length, (counts.get(cells.length) ?? 0) + 1);
    }
  }
  return counts;
}
