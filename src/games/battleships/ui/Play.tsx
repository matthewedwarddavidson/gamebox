import { useEffect, useMemo } from 'react';
import { useBattleships } from '../store/gameStore';
import { Board } from './Board';
import { capitalize, formatDuration } from './format';

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

  const canUndo = useBattleships((s) => s.history.length > 0);
  const canRedo = useBattleships((s) => s.future.length > 0);

  useEffect(() => {
    if (!running || solved) return;
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running, solved, tick]);

  const groups = useMemo(() => (puzzle ? fleetGroups(puzzle.fleet) : []), [puzzle]);

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

      <Board
        puzzle={puzzle}
        marks={marks}
        hintLocked={hintLocked}
        review={review}
        onCycle={cycleCell}
      />

      <div className="bs-fleet">
        {groups.map((g) => (
          <span key={g.len} className="bs-fleet__item">
            <span className="bs-fleet__ship">
              {Array.from({ length: g.len }, (_, k) => (
                <span key={k} className={`bs-fleet__seg ${fleetSegClass(g.len, k)}`} />
              ))}
            </span>
            <span className="bs-fleet__count">×{g.count}</span>
          </span>
        ))}
      </div>

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
        Tap a cell to cycle: empty → ship → water. Ships never touch, even diagonally.
      </p>

      {solved && (
        <div className="win">
          <h2>Solved! 🎉</h2>
          <p className="muted">
            {capitalize(puzzle.difficulty)} · {formatDuration(elapsedMs)} · {mistakes} mistakes
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
      )}
    </div>
  );
}
