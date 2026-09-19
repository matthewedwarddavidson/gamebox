import { describe, expect, it } from 'vitest';
import { fleetGroups, placedBoats, shipFills } from './counts';
import { idx, type Mark } from '../engine';

/** Build a marks grid from a compact string board (`#` = ship, `.` = other). */
function board(rows: string[]): { marks: Mark[]; size: number } {
  const size = rows.length;
  const marks: Mark[] = new Array(size * size).fill('unknown');
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (rows[r][c] === '#') marks[idx(r, c, size)] = 'ship';
    }
  }
  return { marks, size };
}

describe('fleetGroups', () => {
  it('groups the standard fleet by length, largest first', () => {
    expect(fleetGroups([4, 3, 3, 2, 2, 2, 1, 1, 1, 1])).toEqual([
      { len: 4, count: 1 },
      { len: 3, count: 2 },
      { len: 2, count: 3 },
      { len: 1, count: 4 },
    ]);
  });

  it('returns an empty list for an empty fleet', () => {
    expect(fleetGroups([])).toEqual([]);
  });
});

describe('shipFills', () => {
  it('tallies ship marks per row and column', () => {
    const { marks, size } = board([
      '#..',
      '##.',
      '..#',
    ]);
    const { rowFilled, colFilled } = shipFills(marks, size);
    expect(rowFilled).toEqual([1, 2, 1]);
    expect(colFilled).toEqual([2, 1, 1]);
  });

  it('reports zeros for an empty board', () => {
    const { marks, size } = board(['...', '...', '...']);
    const { rowFilled, colFilled } = shipFills(marks, size);
    expect(rowFilled).toEqual([0, 0, 0]);
    expect(colFilled).toEqual([0, 0, 0]);
  });
});

describe('placedBoats', () => {
  it('counts straight horizontal and vertical runs by length', () => {
    const { marks, size } = board([
      '###.#',
      '....#',
      '#....',
      '#..##',
      '.....',
    ]);
    const counts = placedBoats(marks, size);
    // A horizontal 3-run, a vertical 2-run (col 4), a vertical 2-run (col 0),
    // and a horizontal 2-run (row 3).
    expect(counts.get(3)).toBe(1);
    expect(counts.get(2)).toBe(3);
    expect(counts.get(1)).toBeUndefined();
  });

  it('counts isolated single cells as length-1 boats', () => {
    const { marks, size } = board([
      '#.#',
      '...',
      '#.#',
    ]);
    expect(placedBoats(marks, size).get(1)).toBe(4);
  });

  it('does not count a bent (L-shaped) run as any single boat', () => {
    const { marks, size } = board([
      '##.',
      '#..',
      '...',
    ]);
    // Three connected cells spanning two rows and two columns: not straight.
    expect(placedBoats(marks, size).size).toBe(0);
  });

  it('returns an empty map for a board with no ships', () => {
    const { marks, size } = board(['...', '...', '...']);
    expect(placedBoats(marks, size).size).toBe(0);
  });
});
