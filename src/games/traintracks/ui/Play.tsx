import { useEffect } from 'react';
import { useTrainTracks } from '../store/gameStore';
import { Board } from './Board';
import { capitalize, formatDuration } from './format';

export function Play() {
  const puzzle = useTrainTracks((s) => s.puzzle);
  const pieces = useTrainTracks((s) => s.pieces);
  const locked = useTrainTracks((s) => s.locked);
  const review = useTrainTracks((s) => s.review);
  const mode = useTrainTracks((s) => s.mode);
  const mistakes = useTrainTracks((s) => s.mistakes);
  const elapsedMs = useTrainTracks((s) => s.elapsedMs);
  const solved = useTrainTracks((s) => s.solved);
  const running = useTrainTracks((s) => s.running);

  const cycleCell = useTrainTracks((s) => s.cycleCell);
  const undo = useTrainTracks((s) => s.undo);
  const redo = useTrainTracks((s) => s.redo);
  const clearMarks = useTrainTracks((s) => s.clearMarks);
  const tick = useTrainTracks((s) => s.tick);
  const nextFree = useTrainTracks((s) => s.nextFree);
  const navigate = useTrainTracks((s) => s.navigate);

  const canUndo = useTrainTracks((s) => s.history.length > 0);
  const canRedo = useTrainTracks((s) => s.future.length > 0);

  useEffect(() => {
    if (!running || solved) return;
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running, solved, tick]);

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
        <span className="badge">{mode === 'daily' ? 'Daily' : 'Free'}</span>
        <span className="badge">{capitalize(puzzle.difficulty)}</span>
        {!review && <span className="badge">⏱ {formatDuration(elapsedMs)}</span>}
        {!review && <span className="badge badge--warn">✖ {mistakes}</span>}
      </div>

      <div className="tt-board-wrap">
        <Board
          puzzle={puzzle}
          pieces={pieces}
          locked={locked}
          review={review}
          onCycle={cycleCell}
        />

        {solved && (
          <div className="tt-solved-overlay">
            <div className="win tt-solved-card">
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

      <p className="muted tt-hint-text">
        Tap a cell to cycle through the track pieces; right-click (or long-press)
        to cycle back. The counts show how many cells hold track in each row and
        column. Build one continuous track between the two border stubs.
      </p>
    </div>
  );
}
