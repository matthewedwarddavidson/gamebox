// Core types for Train Tracks (a.k.a. Bahnhof / Traintracks).
//
// The player is shown a square grid with per-row and per-column counts of how
// many cells contain track, plus a few given track pieces. They must draw the
// single continuous, non-branching track that enters the grid at one fixed
// border stub and leaves at another.

/** Difficulty controls the grid size and how many extra givens are revealed. */
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type Mode = 'daily' | 'free';

/** Grid size per difficulty (square). */
export const SIZE_FOR: Record<Difficulty, number> = {
  easy: 6,
  medium: 7,
  hard: 8,
};

/**
 * A cell's content is a 4-bit direction mask of the sides the track connects.
 * A real piece has exactly two bits set; `EMPTY` (0) means no track.
 */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

export type Dir = typeof N | typeof E | typeof S | typeof W;
export const DIRS: Dir[] = [N, E, S, W];

/** A track piece is a direction mask; 0 is an empty cell. */
export type Piece = number;
export const EMPTY: Piece = 0;

/** The six valid two-connection pieces. */
export const PIECES: Piece[] = [N | S, E | W, N | E, E | S, S | W, W | N];

/** The opposite direction of `d` (used to match adjacent cells' shared side). */
export function opposite(d: Dir): Dir {
  switch (d) {
    case N:
      return S;
    case S:
      return N;
    case E:
      return W;
    default:
      return E;
  }
}

/** The row/column delta of stepping one cell in direction `d`. */
export function step(d: Dir): { dr: number; dc: number } {
  switch (d) {
    case N:
      return { dr: -1, dc: 0 };
    case S:
      return { dr: 1, dc: 0 };
    case E:
      return { dr: 0, dc: 1 };
    default:
      return { dr: 0, dc: -1 };
  }
}

/** Whether piece `p` connects direction `d`. */
export function connects(p: Piece, d: Dir): boolean {
  return (p & d) !== 0;
}

/** Number of set connection bits in a piece. */
export function degree(p: Piece): number {
  return (p & N ? 1 : 0) + (p & E ? 1 : 0) + (p & S ? 1 : 0) + (p & W ? 1 : 0);
}

export function idx(row: number, col: number, size: number): number {
  return row * size + col;
}

/** A fixed border endpoint: the cell where the track enters/leaves the grid. */
export interface Endpoint {
  row: number;
  col: number;
  /** The off-board ("stub") direction pointing out of the grid. */
  dir: Dir;
}

/** A revealed given piece, shown up-front. */
export interface Given {
  row: number;
  col: number;
  piece: Piece;
}

export interface Puzzle {
  id: string;
  size: number; // board is size x size
  seed: number;
  difficulty: Difficulty;
  rowCounts: number[]; // track cells per row
  colCounts: number[]; // track cells per column
  endpoints: [Endpoint, Endpoint]; // entry + exit border stubs (always given)
  givens: Given[]; // pre-revealed pieces (includes the endpoint cells)
  solution: Piece[]; // row-major, length size*size
  createdAt: number;
}
