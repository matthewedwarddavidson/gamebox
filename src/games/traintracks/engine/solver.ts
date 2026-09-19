// Solver / uniqueness checker for Train Tracks.
//
// Counts the solutions (up to a limit) consistent with the row/column track
// counts, the two fixed border endpoints, and any given pieces. Used both to
// verify a generated puzzle is uniquely solvable and to derive its solution.
//
// Strategy: assign a piece to every cell in row-major order. A cell's North and
// West connections are already forced by its (already-assigned) top and left
// neighbours — or by the border rule at an edge — so only East and South are
// chosen freely. Every cell is either empty (0 connections) or a track piece
// (exactly 2). We prune hard on the remaining per-row/column counts, then accept
// a full assignment only if the track forms a single connected component (which,
// given the degree constraints, rejects any stray closed loops).

import { E, N, S, W, idx, type Dir, type Endpoint, type Given, type Piece } from './types';

export interface SolveInput {
  size: number;
  rowCounts: number[];
  colCounts: number[];
  endpoints: [Endpoint, Endpoint];
  givens: Given[];
}

export interface SolveResult {
  count: number; // number of solutions found (capped at `limit`)
  solution?: Piece[]; // one concrete solution (row-major), if any
  solutions: Piece[][]; // up to `limit` concrete solutions
}

export function solve(input: SolveInput, limit = 2): SolveResult {
  const { size, rowCounts, colCounts, endpoints, givens } = input;
  const cells = size * size;

  // Endpoint + given lookups.
  const stubDir = new Array<Dir | 0>(cells).fill(0);
  const isEndpoint = new Uint8Array(cells);
  for (const ep of endpoints) {
    const i = idx(ep.row, ep.col, size);
    stubDir[i] = ep.dir;
    isEndpoint[i] = 1;
  }
  const given = new Int16Array(cells).fill(-1);
  for (const g of givens) given[idx(g.row, g.col, size)] = g.piece;

  const rowSum = rowCounts.reduce((a, b) => a + b, 0);
  const colSum = colCounts.reduce((a, b) => a + b, 0);
  if (rowSum !== colSum) return { count: 0, solutions: [] };

  const grid = new Int16Array(cells).fill(-1); // assigned piece per cell (-1 = unassigned)
  const rowRem = [...rowCounts];
  const colRem = [...colCounts];

  // Union-find over track cells, used to reject cycles the instant they form.
  // On-board the track is always an open chain, so any closed loop is invalid
  // and can be pruned early. parent[i] === -1 means "not a track cell (yet)";
  // otherwise it is the usual disjoint-set parent, with roots pointing to self.
  // Every write is journalled so it can be rolled back on backtrack.
  const parent = new Int32Array(cells).fill(-1);
  const undoIdx: number[] = [];
  const undoVal: number[] = [];
  const setParent = (i: number, v: number): void => {
    undoIdx.push(i);
    undoVal.push(parent[i]);
    parent[i] = v;
  };
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    return r;
  };
  /** Union a and b; returns true if they were already connected (a cycle). */
  const union = (a: number, b: number): boolean => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return true;
    setParent(ra, rb);
    return false;
  };
  const rollbackTo = (mark: number): void => {
    while (undoIdx.length > mark) {
      const i = undoIdx.pop() as number;
      parent[i] = undoVal.pop() as number;
    }
  };

  let count = 0;
  const solutions: Piece[][] = [];

  const connectedSinglePath = (): boolean => {
    // Collect track cells; BFS from one endpoint following matching edges.
    let total = 0;
    for (let i = 0; i < cells; i++) if (grid[i] > 0) total++;
    if (total === 0) return false;

    const start = idx(endpoints[0].row, endpoints[0].col, size);
    const endGoal = idx(endpoints[1].row, endpoints[1].col, size);
    const seen = new Uint8Array(cells);
    const stack = [start];
    seen[start] = 1;

    const tryVisit = (j: number, back: Dir): void => {
      if (seen[j]) return;
      if ((grid[j] & back) === 0) return; // neighbour must connect back
      seen[j] = 1;
      stack.push(j);
    };

    let visited = 0;
    while (stack.length) {
      const i = stack.pop() as number;
      visited++;
      const r = Math.floor(i / size);
      const c = i % size;
      const p = grid[i];
      if (p & N && r > 0) tryVisit(idx(r - 1, c, size), S);
      if (p & S && r < size - 1) tryVisit(idx(r + 1, c, size), N);
      if (p & E && c < size - 1) tryVisit(idx(r, c + 1, size), W);
      if (p & W && c > 0) tryVisit(idx(r, c - 1, size), E);
    }
    return visited === total && seen[endGoal] === 1;
  };

  const record = (): void => {
    const out: Piece[] = new Array(cells);
    for (let i = 0; i < cells; i++) out[i] = grid[i] > 0 ? grid[i] : 0;
    solutions.push(out);
  };

  const recurse = (pos: number): void => {
    if (count >= limit) return;
    if (pos === cells) {
      if (connectedSinglePath()) {
        if (count < limit) record();
        count++;
      }
      return;
    }

    const r = Math.floor(pos / size);
    const c = pos % size;

    const forcedN = r > 0 ? (grid[idx(r - 1, c, size)] & S) !== 0 : isEndpoint[pos] === 1 && stubDir[pos] === N;
    const forcedW = c > 0 ? (grid[idx(r, c - 1, size)] & E) !== 0 : isEndpoint[pos] === 1 && stubDir[pos] === W;

    // East / South options, constrained by the border (off-board only at an endpoint).
    const eOptions =
      c === size - 1 ? [isEndpoint[pos] === 1 && stubDir[pos] === E] : [false, true];
    const sOptions =
      r === size - 1 ? [isEndpoint[pos] === 1 && stubDir[pos] === S] : [false, true];

    const base = (forcedN ? 1 : 0) + (forcedW ? 1 : 0);

    for (const e of eOptions) {
      for (const s of sOptions) {
        const total = base + (e ? 1 : 0) + (s ? 1 : 0);
        if (total !== 0 && total !== 2) continue;
        if (isEndpoint[pos] === 1 && total !== 2) continue; // endpoints are always track

        const piece = (forcedN ? N : 0) | (e ? E : 0) | (s ? S : 0) | (forcedW ? W : 0);
        if (given[pos] >= 0 && piece !== given[pos]) continue;

        const track = total === 2;
        if (track && (rowRem[r] <= 0 || colRem[c] <= 0)) continue;

        // Incrementally join this cell to its already-placed on-board track
        // neighbours (only N and W can be assigned in row-major order). If a
        // join connects two cells already in the same component, it closes a
        // loop — never valid — so prune this branch immediately.
        const mark = undoIdx.length;
        let cycle = false;
        if (track) {
          setParent(pos, pos);
          if (forcedN && r > 0 && union(pos, idx(r - 1, c, size))) cycle = true;
          if (!cycle && forcedW && c > 0 && union(pos, idx(r, c - 1, size))) cycle = true;
        }

        if (!cycle) {
          grid[pos] = piece;
          if (track) {
            rowRem[r]--;
            colRem[c]--;
          }

          // Feasibility pruning.
          let ok = true;
          if (c === size - 1 && rowRem[r] !== 0) ok = false; // row must be exactly filled
          if (ok && rowRem[r] > size - 1 - c) ok = false; // not enough cells left in row
          if (ok && colRem[c] > size - 1 - r) ok = false; // not enough cells left in column

          if (ok) recurse(pos + 1);

          if (track) {
            rowRem[r]++;
            colRem[c]++;
          }
          grid[pos] = -1;
        }

        rollbackTo(mark);
        if (count >= limit) return;
      }
    }
  };

  recurse(0);
  return { count, solution: solutions[0], solutions };
}
