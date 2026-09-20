import { useEffect, useMemo } from 'react';
import { modeLabel } from '../../../shell/modeLabel';
import { useBattleships } from '../store/gameStore';
import { Board } from './Board';
import { capitalize, formatDuration } from './format';
import { colorForLength } from './colors';
import { fleetGroups, placedBoats } from './counts';

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
  const dailyKey = useBattleships((s) => s.dailyKey);
  const mistakes = useBattleships((s) => s.mistakes);
  const elapsedMs = useBattleships((s) => s.elapsedMs);
  const solved = useBattleships((s) => s.solved);
  const running = useBattleships((s) => s.running);

  const cycleCell = useBattleships((s) => s.cycleCell);
  const undo = useBattleships((s) => s.undo);
  const redo = useBattleships((s) => s.redo);
  const clearMarks = useBattleships((s) => s.clearMarks);
  const tick = useBattleships((s) => s.tick);
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
      <div className="play__meta">
        <span className="badge">{modeLabel(mode, dailyKey)}</span>
        <span className="badge">{capitalize(puzzle.difficulty)}</span>
        <span className="badge">⏱ {formatDuration(elapsedMs)}</span>
        <span className="badge badge--warn">✖ {mistakes}</span>
      </div>

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
          const found = placed.get(g.len) ?? 0;
          const color = colorForLength(g.len);
          const state = found === g.count ? 'bs-fleet__item--done' : found > g.count ? 'bs-fleet__item--over' : '';
          return (
            <span
              key={g.len}
              className={`bs-fleet__item ${state}`}
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

      <p className="play__hint muted">
        Pick Ship or Water, then tap cells to place or clear that mark. Ships
        never touch, even diagonally.
      </p>
    </div>
  );
}
