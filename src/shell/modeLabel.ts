/**
 * The badge text for a puzzle's mode. A daily says which day it is for when that
 * isn't today (UTC), so a puzzle carried over from an earlier day is never
 * mistaken for today's.
 */
export function modeLabel(mode: 'daily' | 'free', dailyKey?: string, now: Date = new Date()): string {
  if (mode === 'free') return 'Free';
  const today = now.toISOString().slice(0, 10);
  return dailyKey && dailyKey !== today ? `Daily · ${dailyKey}` : 'Daily';
}
