import { useEffect } from 'react';
import { cancelLeave, confirmLeave, useLeave } from './leaveGuard';

/** Asks the player to confirm forfeiting an unfinished puzzle before they leave it. */
export function LeaveDialog() {
  const asking = useLeave((s) => s.pending !== null);

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking]);

  if (!asking) return null;

  return (
    <div className="dialog__backdrop" onClick={cancelLeave}>
      <div
        className="dialog card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        aria-describedby="leave-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-title">Leave this puzzle?</h2>
        <p id="leave-body" className="muted">
          Leaving now forfeits it. It will count as a loss in your stats.
        </p>
        <div className="dialog__actions">
          <button className="btn btn--primary" onClick={cancelLeave} autoFocus>
            Keep playing
          </button>
          <button className="btn btn--danger" onClick={confirmLeave}>
            Forfeit
          </button>
        </div>
      </div>
    </div>
  );
}
