import { describe, expect, it } from 'vitest';
import { hashString } from '../../../shared/rng';
import { GENERATOR_VERSION, generate } from './generator';
import { solve } from './solver';
import { DIFFICULTIES, SIZE_FOR, computeRuns, idx, type Puzzle } from './types';

/** The header row and column are always black clue cells. */
function headerIsBlack(p: Puzzle): boolean {
  for (let i = 0; i < p.size; i++) {
    if (p.cells[idx(0, i, p.size)].fill) return false;
    if (p.cells[idx(i, 0, p.size)].fill) return false;
  }
  return true;
}

/** Every run has length 2–9 and its clue equals the sum of its solution digits. */
function runsConsistent(p: Puzzle): boolean {
  const runs = computeRuns(p.cells, p.size);
  if (runs.length === 0) return false;
  for (const run of runs) {
    if (run.cells.length < 2 || run.cells.length > 9) return false;
    const used = new Set<number>();
    let sum = 0;
    for (const ci of run.cells) {
      const d = p.solution[ci];
      if (d < 1 || d > 9) return false;
      if (used.has(d)) return false; // digits distinct within a run
      used.add(d);
      sum += d;
    }
    const owner = p.cells[run.clueIndex];
    const clue = run.dir === 'right' ? owner.right : owner.down;
    if (clue !== sum) return false;
  }
  return true;
}

/** White cells hold 1–9; clue cells hold 0 in the solution. */
function solutionShapeValid(p: Puzzle): boolean {
  for (let i = 0; i < p.cells.length; i++) {
    if (p.cells[i].fill) {
      if (p.solution[i] < 1 || p.solution[i] > 9) return false;
    } else if (p.solution[i] !== 0) {
      return false;
    }
  }
  return true;
}

describe('kakuro generator', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`produces valid, uniquely solvable ${difficulty} puzzles`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const p = generate(seed, difficulty);
        expect(p.size).toBe(SIZE_FOR[difficulty]);
        expect(p.cells).toHaveLength(p.size * p.size);
        expect(headerIsBlack(p)).toBe(true);
        expect(solutionShapeValid(p)).toBe(true);
        expect(runsConsistent(p)).toBe(true);

        const result = solve({ size: p.size, cells: p.cells }, 2);
        expect(result.count).toBe(1);
        expect(result.solution).toEqual(p.solution);
      }
    });
  }

  it('builds full-size grids with a good share of white cells', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 1; seed <= 6; seed++) {
        const p = generate(seed, difficulty);
        const interior = (p.size - 1) ** 2;
        const whites = p.cells.filter((c) => c.fill).length;
        expect(whites).toBeGreaterThanOrEqual(interior * 0.55);
      }
    }
  });

  it('is deterministic for a given seed and difficulty', () => {
    const a = generate(42, 'medium');
    const b = generate(42, 'medium');
    expect(b.cells).toEqual(a.cells);
    expect(b.solution).toEqual(a.solution);
    expect(b.id).toEqual(a.id);
  });

  it('yields different puzzles for different seeds', () => {
    const a = generate(1, 'easy');
    const b = generate(2, 'easy');
    expect(b.solution).not.toEqual(a.solution);
  });

  // Pins the exact puzzles, so a change to generation cannot slip through
  // unnoticed: if this fails on purpose, bump GENERATOR_VERSION and update it.
  it('keeps producing the same puzzles for the current generator version', () => {
    expect(GENERATOR_VERSION).toBe(2);
    const fingerprint = (seed: number, difficulty: 'easy' | 'medium' | 'hard') => {
      const p = generate(seed, difficulty);
      return hashString(JSON.stringify([p.cells, p.solution]));
    };
    expect([
      fingerprint(1, 'easy'),
      fingerprint(42, 'easy'),
      fingerprint(1, 'medium'),
      fingerprint(42, 'medium'),
      fingerprint(1, 'hard'),
      fingerprint(42, 'hard'),
    ]).toEqual([606400428, 2072541176, 3584893273, 331543357, 3139821450, 4030923536]);
  });
});
