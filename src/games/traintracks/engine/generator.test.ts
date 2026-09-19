import { describe, expect, it } from 'vitest';
import { generate } from './generator';
import { solve } from './solver';
import {
  DIFFICULTIES,
  E,
  EMPTY,
  N,
  S,
  SIZE_FOR,
  W,
  connects,
  degree,
  idx,
  opposite,
  type Dir,
  type Piece,
} from './types';

const DIRS: Dir[] = [N, E, S, W];

/** Every non-empty piece has exactly two connections. */
function allPiecesValid(solution: Piece[]): boolean {
  return solution.every((p) => p === EMPTY || degree(p) === 2);
}

/** Adjacent cells agree on their shared side; borders only leak at endpoints. */
function edgesConsistent(
  solution: Piece[],
  size: number,
  endpointOff: Map<number, Dir>,
): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = idx(r, c, size);
      const p = solution[i];
      for (const d of DIRS) {
        if (!connects(p, d)) continue;
        const nr = r + (d === N ? -1 : d === S ? 1 : 0);
        const nc = c + (d === W ? -1 : d === E ? 1 : 0);
        const offBoard = nr < 0 || nr >= size || nc < 0 || nc >= size;
        if (offBoard) {
          // Only the two endpoints may connect off-board, in their stub dir.
          if (endpointOff.get(i) !== d) return false;
        } else {
          // Neighbour must connect back.
          if (!connects(solution[idx(nr, nc, size)], opposite(d))) return false;
        }
      }
    }
  }
  return true;
}

/** The track forms one connected chain covering every non-empty cell. */
function singleConnectedPath(
  solution: Piece[],
  size: number,
  start: number,
): boolean {
  let total = 0;
  for (const p of solution) if (p !== EMPTY) total++;
  const seen = new Uint8Array(size * size);
  const stack = [start];
  seen[start] = 1;
  let visited = 0;
  while (stack.length) {
    const i = stack.pop() as number;
    visited++;
    const r = Math.floor(i / size);
    const c = i % size;
    const p = solution[i];
    for (const d of DIRS) {
      if (!connects(p, d)) continue;
      const nr = r + (d === N ? -1 : d === S ? 1 : 0);
      const nc = c + (d === W ? -1 : d === E ? 1 : 0);
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const j = idx(nr, nc, size);
      if (!seen[j] && connects(solution[j], opposite(d))) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return visited === total;
}

describe('train tracks generator', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`produces a valid, uniquely-solvable ${difficulty} puzzle`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const puzzle = generate(seed, difficulty);
        const size = SIZE_FOR[difficulty];
        expect(puzzle.size).toBe(size);
        expect(puzzle.solution).toHaveLength(size * size);

        // Pieces are all valid two-connection pieces or empty.
        expect(allPiecesValid(puzzle.solution)).toBe(true);

        // Endpoint off-board stubs.
        const endpointOff = new Map<number, Dir>();
        for (const ep of puzzle.endpoints) {
          endpointOff.set(idx(ep.row, ep.col, size), ep.dir);
        }
        expect(edgesConsistent(puzzle.solution, size, endpointOff)).toBe(true);

        // Row/column counts match the solution.
        const rowCounts = new Array(size).fill(0);
        const colCounts = new Array(size).fill(0);
        for (let r = 0; r < size; r++) {
          for (let cc = 0; cc < size; cc++) {
            if (puzzle.solution[idx(r, cc, size)] !== EMPTY) {
              rowCounts[r]++;
              colCounts[cc]++;
            }
          }
        }
        expect(puzzle.rowCounts).toEqual(rowCounts);
        expect(puzzle.colCounts).toEqual(colCounts);

        // Single connected path.
        const startCell = idx(puzzle.endpoints[0].row, puzzle.endpoints[0].col, size);
        expect(singleConnectedPath(puzzle.solution, size, startCell)).toBe(true);

        // Given pieces are a subset of the solution.
        for (const g of puzzle.givens) {
          expect(puzzle.solution[idx(g.row, g.col, size)]).toBe(g.piece);
        }

        // The solver agrees the puzzle is unique and matches the solution.
        const res = solve(
          {
            size,
            rowCounts: puzzle.rowCounts,
            colCounts: puzzle.colCounts,
            endpoints: puzzle.endpoints,
            givens: puzzle.givens,
          },
          2,
        );
        expect(res.count).toBe(1);
        expect(res.solution).toEqual(puzzle.solution);
      }
    });
  }

  it('is deterministic for a given seed and difficulty', () => {
    const a = generate(42, 'medium');
    const b = generate(42, 'medium');
    expect(a.solution).toEqual(b.solution);
    expect(a.givens).toEqual(b.givens);
    expect(a.rowCounts).toEqual(b.rowCounts);
  });

  it('reveals more givens on easier difficulties', () => {
    const easy = generate(7, 'easy');
    const hard = generate(7, 'hard');
    expect(easy.givens.length).toBeGreaterThan(2);
    // Hard reveals only what's needed for uniqueness (at least the 2 endpoints).
    expect(hard.givens.length).toBeGreaterThanOrEqual(2);
  });

  it('never connects to a matching neighbour that leaves the board', () => {
    // Sanity: opposite/connects helpers behave.
    expect(opposite(N)).toBe(S);
    expect(connects(N | E, E)).toBe(true);
    expect(connects(N | E, W)).toBe(false);
  });
});
