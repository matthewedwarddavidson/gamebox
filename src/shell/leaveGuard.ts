// Guards leaving a game mid-puzzle. A game that has an unfinished puzzle on
// screen registers a guard; any way of leaving it (the game's own crumb or
// back button, or the shell's "Gamebox" crumb) goes through `requestLeave`.
// For a puzzle that can be forfeited the player is asked to confirm first, and
// the game records the loss in their stats. Puzzles that are exempt (dailies)
// skip the question, and the game just pauses them.
import { create } from 'zustand';

export interface LeaveGuard {
  /** Ask the player to confirm before leaving (leaving forfeits the puzzle). */
  warn: boolean;
  /** Called as the player leaves (after confirming, when `warn`): forfeit or pause. */
  onLeave: () => void;
}

interface LeaveState {
  guard: LeaveGuard | null;
  /** The navigation waiting on the player's answer; non-null while asking. */
  pending: (() => void) | null;
}

export const useLeave = create<LeaveState>(() => ({ guard: null, pending: null }));

/** Register (or clear, with null) the guard for the game currently on screen. */
export function setLeaveGuard(guard: LeaveGuard | null): void {
  useLeave.setState(guard ? { guard } : { guard: null, pending: null });
}

/** Run `action` now, or after the player confirms forfeiting an unfinished puzzle. */
export function requestLeave(action: () => void): void {
  const { guard } = useLeave.getState();
  if (guard?.warn) {
    useLeave.setState({ pending: action });
    return;
  }
  guard?.onLeave();
  action();
}

export function confirmLeave(): void {
  const { guard, pending } = useLeave.getState();
  useLeave.setState({ pending: null });
  guard?.onLeave();
  pending?.();
}

export function cancelLeave(): void {
  useLeave.setState({ pending: null });
}
