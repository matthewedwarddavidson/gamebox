// Core types for Solitaire Battleships (Bimaru).
//
// The player is shown a grid with per-row and per-column counts of ship
// segments, plus a handful of revealed cells. They must reconstruct the hidden
// fleet: straight ships that never touch each other, not even diagonally.

/** Difficulty controls how many extra (beyond-minimal) hints are revealed. */
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type Mode = 'daily' | 'free';

/** A single cell's true content in the solution. */
export type CellType =
  | 'water'
  | 'single' // a length-1 ship (submarine)
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'middle';

/** Ship-segment cell types (everything that isn't water). */
export const SHIP_TYPES: CellType[] = ['single', 'left', 'right', 'top', 'bottom', 'middle'];

export function isShip(type: CellType): boolean {
  return type !== 'water';
}

/** Fixed board is square. Standard Bimaru is 10x10. */
export const BOARD_SIZE = 10;

/**
 * Standard fleet: 1 battleship (4), 2 cruisers (3), 3 destroyers (2),
 * 4 submarines (1) = 20 ship cells. Expressed as a list of ship lengths.
 */
export const STANDARD_FLEET: number[] = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

/** A revealed hint: the true type of a specific cell, shown up-front. */
export interface Hint {
  row: number;
  col: number;
  type: CellType;
}

export interface Puzzle {
  id: string;
  size: number; // board is size x size
  seed: number;
  difficulty: Difficulty;
  fleet: number[]; // ship lengths
  rowCounts: number[]; // ship cells per row
  colCounts: number[]; // ship cells per column
  hints: Hint[]; // pre-revealed cells
  solution: CellType[]; // row-major, length size*size
  createdAt: number;
}

/** Player's mark on a cell while solving. */
export type Mark = 'unknown' | 'water' | 'ship';

export function idx(row: number, col: number, size: number): number {
  return row * size + col;
}

/** Segment type for a cell at position `j` within a ship of `len`. */
export function segmentType(j: number, len: number, horizontal: boolean): CellType {
  if (len === 1) return 'single';
  if (horizontal) return j === 0 ? 'left' : j === len - 1 ? 'right' : 'middle';
  return j === 0 ? 'top' : j === len - 1 ? 'bottom' : 'middle';
}
