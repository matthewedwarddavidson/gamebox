import { useEffect } from 'react';
import { modeLabel } from '../../../shell/modeLabel';
import { useKakuro } from '../store/gameStore';
import { Board } from './Board';
import { NumberPad } from './NumberPad';
import { capitalize, formatDuration } from './format';

export function Play() {
  const puzzle = useKakuro((s) => s.puzzle);
  const digits = useKakuro((s) => s.digits);
  const selected = useKakuro((s) => s.selected);
  const review = useKakuro((s) => s.review);
  const mode = useKakuro((s) => s.mode);
  const dailyKey = useKakuro((s) => s.dailyKey);
  const mistakes = useKakuro((s) => s.mistakes);
  const elapsedMs = useKakuro((s) => s.elapsedMs);
  const solved = useKakuro((s) => s.solved);
  const running = useKakuro((s) => s.running);
  const notes = useKakuro((s) => s.notes);
  const pencil = useKakuro((s) => s.pencil);

  const select = useKakuro((s) => s.select);
  const moveSelection = useKakuro((s) => s.moveSelection);
  const enterDigit = useKakuro((s) => s.enterDigit);
  const erase = useKakuro((s) => s.erase);
  const togglePencil = useKakuro((s) => s.togglePencil);
  const undo = useKakuro((s) => s.undo);
  const redo = useKakuro((s) => s.redo);
  const clearMarks = useKakuro((s) => s.clearMarks);
  const tick = useKakuro((s) => s.tick);
  const nextFree = useKakuro((s) => s.nextFree);
  const navigate = useKakuro((s) => s.navigate);

  const canUndo = useKakuro((s) => s.history.length > 0);
  const canRedo = useKakuro((s) => s.future.length > 0);

  useEffect(() => {
    if (!running || solved) return;
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running, solved, tick]);

  useEffect(() => {
    if (review || solved) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key >= '1' && ev.key <= '9') {
        enterDigit(Number(ev.key));
      } else if (ev.key === 'n' || ev.key === 'N') {
        togglePencil();
      } else if (ev.key === 'Backspace' || ev.key === 'Delete' || ev.key === '0') {
        erase();
      } else if (ev.key === 'ArrowUp') {
        moveSelection(-1, 0);
      } else if (ev.key === 'ArrowDown') {
        moveSelection(1, 0);
      } else if (ev.key === 'ArrowLeft') {
        moveSelection(0, -1);
      } else if (ev.key === 'ArrowRight') {
        moveSelection(0, 1);
      } else {
        return;
      }
      ev.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [review, solved, enterDigit, erase, togglePencil, moveSelection]);

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
    <div className="play kk-play">
      <div className="play__meta">
        <span className="badge">{modeLabel(mode, dailyKey)}</span>
        <span className="badge">{capitalize(puzzle.difficulty)}</span>
        {!review && <span className="badge">⏱ {formatDuration(elapsedMs)}</span>}
        {!review && <span className="badge badge--warn">✖ {mistakes}</span>}
      </div>

      <div className="kk-board-wrap">
        <Board
          puzzle={puzzle}
          digits={digits}
          notes={notes}
          selected={selected}
          review={review}
          onSelect={select}
        />

        {solved && (
          <div className="kk-solved-overlay">
            <div className="win kk-solved-card">
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
        <NumberPad
          onDigit={enterDigit}
          onErase={erase}
          pencil={pencil}
          disabled={selected === null}
        />
      )}

      {!review && (
        <div className="play__controls">
          <button
            className={`btn kk-notes-toggle${pencil ? ' kk-notes-toggle--on' : ''}`}
            onClick={togglePencil}
            aria-pressed={pencil}
          >
            ✎ Notes
          </button>
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
        Tap a white cell, then pick a digit. Each run uses 1–9 without repeats and adds up to
        its clue. Keys: 1–9, arrows, Backspace, N for notes.
      </p>
    </div>
  );
}
