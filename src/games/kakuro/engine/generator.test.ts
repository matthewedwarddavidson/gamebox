import { describe, expect, it } from 'vitest';
import { generate } from './generator';
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
      for (let seed = 1; seed <= 6; seed++) {
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
});
