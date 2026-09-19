// Aggregate Train Tracks stats derived from the games log. Pure.

import { DIFFICULTIES, type Difficulty } from '../engine/types';
import type { GameRecord, Stats } from './types';

function emptyDifficultyStats(): Stats['byDifficulty'][Difficulty] {
  return { played: 0, won: 0 };
}

export function emptyStats(): Stats {
  const byDifficulty = {} as Stats['byDifficulty'];
  for (const d of DIFFICULTIES) byDifficulty[d] = emptyDifficultyStats();
  return { played: 0, won: 0, currentStreak: 0, longestStreak: 0, byDifficulty };
}

function utcKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isNextDay(prev: string, next: string): boolean {
  const p = Date.parse(`${prev}T00:00:00Z`);
  const n = Date.parse(`${next}T00:00:00Z`);
  return n - p === 86_400_000;
}

function computeDailyStreaks(games: GameRecord[]): { current: number; longest: number } {
  const wonDays = new Set<string>();
  for (const g of games) {
    if (g.mode === 'daily' && g.status === 'won' && g.dailyKey) wonDays.add(g.dailyKey);
  }
  if (wonDays.size === 0) return { current: 0, longest: 0 };

  const days = [...wonDays].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = isNextDay(days[i - 1], days[i]) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const todayKey = utcKeyFromDate(new Date());
  const yesterdayKey = utcKeyFromDate(new Date(Date.now() - 86_400_000));
  const last = days[days.length - 1];
  let current = 0;
  if (last === todayKey || last === yesterdayKey) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (isNextDay(days[i - 1], days[i])) current++;
      else break;
    }
  }
  return { current, longest };
}

export function computeStats(games: GameRecord[]): Stats {
  const stats = emptyStats();
  const sums: Record<Difficulty, { total: number; n: number }> = {} as never;
  for (const d of DIFFICULTIES) sums[d] = { total: 0, n: 0 };

  for (const g of games) {
    if (g.status === 'in-progress') continue;
    stats.played++;
    const ds = stats.byDifficulty[g.difficulty];
    ds.played++;

    if (g.status === 'won') {
      stats.won++;
      ds.won++;
      if (g.durationMs !== undefined) {
        ds.bestMs = ds.bestMs === undefined ? g.durationMs : Math.min(ds.bestMs, g.durationMs);
        sums[g.difficulty].total += g.durationMs;
        sums[g.difficulty].n++;
      }
    }
  }

  for (const d of DIFFICULTIES) {
    const { total, n } = sums[d];
    if (n > 0) stats.byDifficulty[d].avgMs = Math.round(total / n);
  }

  const streaks = computeDailyStreaks(games);
  stats.currentStreak = streaks.current;
  stats.longestStreak = streaks.longest;
  return stats;
}
