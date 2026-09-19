import { useEffect, useMemo } from 'react';
import { useBattleships } from '../store/gameStore';
import { Board } from './Board';
import { capitalize, formatDuration } from './format';
import { colorForLength } from './colors';
import { idx, type Mark } from '../engine';

/** Group a fleet list into { length, count } rows, largest first. */
function fleetGroups(fleet: number[]): { len: number; count: number }[] {
  const map = new Map<number, number>();
  for (const l of fleet) map.set(l, (map.get(l) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([len, count]) => ({ len, count }));
}

/** Horizontal ship-shape class for a segment at index `k` within a ship of `len` cells. */
function fleetSegClass(len: number, k: number): string {
  if (len === 1) return 'bs-fleet__seg--single';
  if (k === 0) return 'bs-fleet__seg--left';
  if (k === len - 1) return 'bs-fleet__seg--right';
  return 'bs-fleet__seg--middle';
}

/**
 * Count completed boats on the board by length: a boat is a maximal, straight
 * (horizontal or vertical) run of connected ship marks.
 */
function placedBoats(marks: Mark[], size: number): Map<number, number> {
  const seen = new Array(marks.length).fill(false);
  const counts = new Map<number, number>();
  const isShipMark = (i: number) => marks[i] === 'ship';

  for (let start = 0; start < marks.length; start++) {
    if (!isShipMark(start) || seen[start]) continue;
    const cells: number[] = [];
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const j = stack.pop() as number;
      cells.push(j);
      const r = Math.floor(j / size);
      const c = j % size;
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        const nj = idx(nr, nc, size);
        if (isShipMark(nj) && !seen[nj]) {
          seen[nj] = true;
          stack.push(nj);
        }
      }
    }
    const rows = new Set(cells.map((j) => Math.floor(j / size)));
    const cols = new Set(cells.map((j) => j % size));
    if (rows.size === 1 || cols.size === 1) {
      counts.set(cells.length, (counts.get(cells.length) ?? 0) + 1);
    }
  }
  return counts;
}

export function Play() {
  const puzzle = useBattleships((s) => s.puzzle);
  const marks = useBattleships((s) => s.marks);
  const hintLocked = useBattleships((s) => s.hintLocked);
  const review = useBattleships((s) => s.review);
  const mode = useBattleships((s) => s.mode);
  const mistakes = useBattleships((s) => s.mistakes);
  const elapsedMs = useBattleships((s) => s.elapsedMs);
  const solved = useBattleships((s) => s.solved);
  const running = useBattleships((s) => s.running);

  const cycleCell = useBattleships((s) => s.cycleCell);
  const undo = useBattleships((s) => s.undo);
  const redo = useBattleships((s) => s.redo);
  const clearMarks = useBattleships((s) => s.clearMarks);
  const tick = useBattleships((s) => s.tick);
  const abandon = useBattleships((s) => s.abandon);
  const nextFree = useBattleships((s) => s.nextFree);
  const navigate = useBattleships((s) => s.navigate);

  const tool = useBattleships((s) => s.tool);
  const setTool = useBattleships((s) => s.setTool);

  const canUndo = useBattleships((s) => s.history.length > 0);
  const canRedo = useBattleships((s) => s.future.length > 0);

  useEffect(() => {
    if (!running || solved) return;
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running, solved, tick]);

  const groups = useMemo(() => (puzzle ? fleetGroups(puzzle.fleet) : []), [puzzle]);
  const placed = useMemo(
    () => (puzzle ? placedBoats(marks, puzzle.size) : new Map<number, number>()),
    [puzzle, marks],
  );

  if (!puzzle) {
    return (
      <div className="play">
        <p>No puzzle loaded.</p>
        <button className="btn" onClick={() => navigate('home')}>
          Home
        </button>
      </div>
    );
  }

  return (
    <div className="play">
      <header className="play__bar">
        <button className="btn btn--ghost" onClick={abandon} aria-label="Back to home">
          ‹ Home
        </button>
        <div className="play__meta">
          <span className="badge">{mode === 'daily' ? 'Daily' : 'Free'}</span>
          <span className="badge">{capitalize(puzzle.difficulty)}</span>
          <span className="badge">⏱ {formatDuration(elapsedMs)}</span>
          <span className="badge badge--warn">✖ {mistakes}</span>
        </div>
      </header>

      <div className="bs-board-wrap">
        <Board
          puzzle={puzzle}
          marks={marks}
          hintLocked={hintLocked}
          review={review}
          onCycle={cycleCell}
        />

        {solved && (
          <div className="bs-solved-overlay">
            <div className="win bs-solved-card">
              <h2>Solved! 🎉</h2>
              <p className="muted">
                {capitalize(puzzle.difficulty)} · {formatDuration(elapsedMs)} · {mistakes}{' '}
                {mistakes === 1 ? 'mistake' : 'mistakes'}
              </p>
              <div className="win__actions">
                <button className="btn btn--primary" onClick={nextFree}>
                  New puzzle
                </button>
                <button className="btn" onClick={() => navigate('home')}>
                  Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bs-fleet">
        {groups.map((g) => {
          const found = Math.min(g.count, placed.get(g.len) ?? 0);
          const color = colorForLength(g.len);
          return (
            <span
              key={g.len}
              className={`bs-fleet__item ${found === g.count ? 'bs-fleet__item--done' : ''}`}
            >
              <span className="bs-fleet__ship">
                {Array.from({ length: g.len }, (_, k) => (
                  <span
                    key={k}
                    className={`bs-fleet__seg ${fleetSegClass(g.len, k)}`}
                    style={{ background: color.fill, borderColor: color.stroke }}
                  />
                ))}
              </span>
              <span className="bs-fleet__count">
                {found}/{g.count}
              </span>
            </span>
          );
        })}
      </div>

      {!review && (
        <div className="bs-tools" role="radiogroup" aria-label="Marking tool">
          <button
            className={`btn bs-tool ${tool === 'ship' ? 'bs-tool--active' : ''}`}
            role="radio"
            aria-checked={tool === 'ship'}
            onClick={() => setTool('ship')}
          >
            <span className="bs-tool__icon cell__ship cell__ship--single" />
            Ship
          </button>
          <button
            className={`btn bs-tool ${tool === 'water' ? 'bs-tool--active' : ''}`}
            role="radio"
            aria-checked={tool === 'water'}
            onClick={() => setTool('water')}
          >
            <span className="bs-tool__icon cell__water" />
            Water
          </button>
        </div>
      )}

      {!review && (
        <div className="play__controls">
          <button className="btn" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button className="btn" onClick={redo} disabled={!canRedo}>
            Redo
          </button>
          <button className="btn" onClick={clearMarks}>
            Clear
          </button>
        </div>
      )}

      <p className="muted bs-hint-text">
        Pick Ship or Water, then tap cells to place or clear that mark. Ships
        never touch, even diagonally.
      </p>
    </div>
  );
}
