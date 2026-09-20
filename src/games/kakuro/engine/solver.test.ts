import { describe, expect, it } from 'vitest';
import { solve } from './solver';
import type { Cell } from './types';

/** Build a tiny 3×3 layout: header row/col black, a 2×2 white block. */
function twoByTwo(rightRow1: number, rightRow2: number, downCol1: number, downCol2: number): Cell[] {
  // Layout (size 3), row-major:
  //  ·   |r1 |r2      (row 0: corner, across clue for c1, across clue for c2)
  //  d1  | . | .
  //  d2  | . | .
  const cells: Cell[] = Array.from({ length: 9 }, () => ({ fill: false }));
  cells[1] = { fill: false, down: downCol1 };
  cells[2] = { fill: false, down: downCol2 };
  cells[3] = { fill: false, right: rightRow1 };
  cells[6] = { fill: false, right: rightRow2 };
  cells[4] = { fill: true };
  cells[5] = { fill: true };
  cells[7] = { fill: true };
  cells[8] = { fill: true };
  return cells;
}

describe('kakuro solver', () => {
  it('finds the unique solution of a determined block', () => {
    // Rows sum 4 and 6, columns sum 3 and 7. Unique: [[1,3],[2,4]].
    const cells = twoByTwo(4, 6, 3, 7);
    const res = solve({ size: 3, cells }, 2);
    expect(res.count).toBe(1);
    expect(res.solution?.[4]).toBe(1);
    expect(res.solution?.[5]).toBe(3);
    expect(res.solution?.[7]).toBe(2);
    expect(res.solution?.[8]).toBe(4);
  });

  it('reports multiple solutions for an ambiguous block', () => {
    // Rows and columns all sum to 5: both [[1,4],[4,1]] and [[2,3],[3,2]] work.
    const cells = twoByTwo(5, 5, 5, 5);
    const res = solve({ size: 3, cells }, 2);
    expect(res.count).toBe(2);
  });

  it('reports no solution when a clue is unreachable', () => {
    // A length-2 run cannot sum to 3 with distinct digits and the crossing 17.
    const cells = twoByTwo(3, 17, 3, 17);
    const res = solve({ size: 3, cells }, 2);
    expect(res.count).toBe(0);
  });
});
