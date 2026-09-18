import { describe, expect, it } from 'vitest';
import { generate } from './generator';
import { solve } from './solver';
import { DIFFICULTIES, STANDARD_FLEET, idx, isShip, type CellType } from './types';

/** No two ships touch (edges or corners): every ship cell's diagonal neighbors
 *  must not be ship cells belonging to a different ship. We check the weaker,
 *  sufficient invariant that diagonal neighbors are always water. */
function noDiagonalTouch(solution: CellType[], size: number): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isShip(solution[idx(r, c, size)])) continue;
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (isShip(solution[idx(nr, nc, size)])) return false;
      }
    }
  }
  return true;
}

function fleetFromSolution(solution: CellType[], size: number): number[] {
  const seen = new Uint8Array(size * size);
  const lengths: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = idx(r, c, size);
      if (!isShip(solution[i]) || seen[i]) continue;
      // Walk right then down to measure the ship starting here.
      let len = 0;
      if (c + 1 < size && isShip(solution[idx(r, c + 1, size)])) {
        let cc = c;
        while (cc < size && isShip(solution[idx(r, cc, size)])) {
          seen[idx(r, cc, size)] = 1;
          cc++;
          len++;
        }
      } else if (r + 1 < size && isShip(solution[idx(r + 1, c, size)])) {
        let rr = r;
        while (rr < size && isShip(solution[idx(rr, c, size)])) {
          seen[idx(rr, c, size)] = 1;
          rr++;
          len++;
        }
      } else {
        seen[i] = 1;
        len = 1;
      }
      lengths.push(len);
    }
  }
  return lengths.sort((a, b) => b - a);
}

describe('battleships generate', () => {
  it('is deterministic for the same seed + difficulty', () => {
    const a = generate(42, 'medium');
    const b = generate(42, 'medium');
    expect(a.solution).toEqual(b.solution);
    expect(a.hints).toEqual(b.hints);
    expect(a.id).toBe(b.id);
  });

  for (const difficulty of DIFFICULTIES) {
    describe(`difficulty: ${difficulty}`, () => {
      it('produces a uniquely-solvable puzzle whose solution matches', () => {
        for (let seed = 0; seed < 8; seed++) {
          const p = generate(seed, difficulty);
          const res = solve(
            {
              size: p.size,
              fleet: p.fleet,
              rowCounts: p.rowCounts,
              colCounts: p.colCounts,
              hints: p.hints,
            },
            2,
          );
          expect(res.count).toBe(1);
          expect(res.solution).toEqual(p.solution);
        }
      });

      it('has the standard fleet, no touching, and matching counts', () => {
        const p = generate(123, difficulty);
        expect(fleetFromSolution(p.solution, p.size)).toEqual(
          [...STANDARD_FLEET].sort((a, b) => b - a),
        );
        expect(noDiagonalTouch(p.solution, p.size)).toBe(true);

        const rows = new Array(p.size).fill(0);
        const cols = new Array(p.size).fill(0);
        for (let r = 0; r < p.size; r++) {
          for (let c = 0; c < p.size; c++) {
            if (isShip(p.solution[idx(r, c, p.size)])) {
              rows[r]++;
              cols[c]++;
            }
          }
        }
        expect(rows).toEqual(p.rowCounts);
        expect(cols).toEqual(p.colCounts);
      });

      it('every hint matches the solution', () => {
        const p = generate(7, difficulty);
        for (const h of p.hints) {
          expect(h.type).toBe(p.solution[idx(h.row, h.col, p.size)]);
        }
      });
    });
  }

  it('reveals more hints on easier difficulties', () => {
    const easy = generate(55, 'easy');
    const hard = generate(55, 'hard');
    expect(easy.hints.length).toBeGreaterThan(hard.hints.length);
  });
});
