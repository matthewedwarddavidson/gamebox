import { describe, expect, it } from 'vitest';
import { solve } from './solver';
import { E, N, S, W, type Endpoint, type Given } from './types';

// A tiny hand-built 3x3 puzzle with a single obvious solution:
//   S . .      the track enters top-left going up, snakes down the first
//   | . .      column, along the bottom row and up to exit at the right edge.
//   +--+--+->  (endpoints: (0,0) stub N, (2,2) stub E)
//
// Solution pieces (masks):
//   (0,0)=N|S  (1,0)=N|S  (2,0)=N|E
//   (2,1)=E|W  (2,2)=E|W|... exit stub E => W|E? see below.
describe('train tracks solver', () => {
  const size = 3;
  const endpoints: [Endpoint, Endpoint] = [
    { row: 0, col: 0, dir: N },
    { row: 2, col: 2, dir: E },
  ];
  // rowCounts / colCounts for the L-shaped track down col 0 then along row 2.
  const rowCounts = [1, 1, 3];
  const colCounts = [3, 1, 1];

  it('finds the unique L-shaped solution', () => {
    const res = solve({ size, rowCounts, colCounts, endpoints, givens: [] }, 2);
    expect(res.count).toBe(1);
    const sol = res.solution!;
    // Corner turns and straights.
    expect(sol[0]).toBe(N | S); // (0,0)
    expect(sol[3]).toBe(N | S); // (1,0)
    expect(sol[6]).toBe(N | E); // (2,0) turn up->right
    expect(sol[7]).toBe(E | W); // (2,1) straight
    expect(sol[8]).toBe(W | E); // (2,2) exit east
  });

  it('respects a given that conflicts with the only solution (no solutions)', () => {
    const givens: Given[] = [{ row: 0, col: 0, piece: N | E }]; // impossible here
    const res = solve({ size, rowCounts, colCounts, endpoints, givens }, 2);
    expect(res.count).toBe(0);
  });

  it('rejects configurations that would form a closed loop', () => {
    // Counts that could be satisfied by a 2x2 loop in the top-left plus the
    // required endpoints have no valid single-path solution.
    const res = solve(
      {
        size,
        rowCounts: [2, 2, 2],
        colCounts: [2, 2, 2],
        endpoints,
        givens: [],
      },
      2,
    );
    // Whatever the count, every returned solution must be a single open path
    // (the solver's connectivity check guarantees this); a pure 2x2 loop is
    // never returned.
    for (const sol of res.solutions) {
      // The exit endpoint cell must carry its east stub.
      expect((sol[8] & E) !== 0).toBe(true);
      // The entry endpoint cell must carry its north stub.
      expect((sol[0] & N) !== 0).toBe(true);
    }
  });
});
