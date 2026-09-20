// Cross-game stats for the signed-in (or guest) player, derived purely from the
// games' completed-game records. Every game stores records with these common
// fields, so the shell can aggregate them without knowing game internals.

export interface RecordLike {
  id: string;
  mode: 'daily' | 'free';
  difficulty: string;
  status: 'won' | 'abandoned' | 'in-progress';
  durationMs?: number;
  finishedAt?: number;
  dailyKey?: string; // UTC date key for daily games, e.g. 2026-09-20
}

export interface GameSummary {
  played: number;
  won: number;
  totalMs: number; // time spent on won games
}

export interface RecentWin<T extends RecordLike = RecordLike> {
  gameId: string;
  record: T;
}

export interface OverallStats<T extends RecordLike = RecordLike> {
  played: number;
  won: number;
  totalMs: number;
  dailyWins: number;
  currentStreak: number; // consecutive days with a daily win in any game
  longestStreak: number;
  perGame: Record<string, GameSummary>;
  recentWins: RecentWin<T>[];
}

const DAY_MS = 86_400_000;

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isNextDay(prev: string, next: string): boolean {
  return Date.parse(`${next}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`) === DAY_MS;
}

/** Streaks of consecutive days on which any game's daily puzzle was won. */
function dailyStreaks(days: string[], now: Date): { current: number; longest: number } {
  if (days.length === 0) return { current: 0, longest: 0 };
  const sorted = [...new Set(days)].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = isNextDay(sorted[i - 1], sorted[i]) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const last = sorted[sorted.length - 1];
  let current = 0;
  if (last === utcKey(now) || last === utcKey(new Date(now.getTime() - DAY_MS))) {
    current = 1;
    for (let i = sorted.length - 1; i > 0 && isNextDay(sorted[i - 1], sorted[i]); i--) current++;
  }
  return { current, longest };
}

export function computeOverallStats<T extends RecordLike>(
  recordsByGame: Record<string, T[]>,
  now: Date = new Date(),
  recentLimit = 8,
): OverallStats<T> {
  const perGame: Record<string, GameSummary> = {};
  const dailyDays: string[] = [];
  const wins: RecentWin<T>[] = [];
  let played = 0;
  let won = 0;
  let totalMs = 0;
  let dailyWins = 0;

  for (const [gameId, records] of Object.entries(recordsByGame)) {
    const summary: GameSummary = { played: 0, won: 0, totalMs: 0 };
    for (const r of records) {
      if (r.status === 'in-progress') continue;
      summary.played++;
      if (r.status !== 'won') continue;
      summary.won++;
      summary.totalMs += r.durationMs ?? 0;
      wins.push({ gameId, record: r });
      if (r.mode === 'daily' && r.dailyKey) {
        dailyDays.push(r.dailyKey);
        dailyWins++;
      }
    }
    perGame[gameId] = summary;
    played += summary.played;
    won += summary.won;
    totalMs += summary.totalMs;
  }

  wins.sort((a, b) => (b.record.finishedAt ?? 0) - (a.record.finishedAt ?? 0));
  const { current, longest } = dailyStreaks(dailyDays, now);
  return {
    played,
    won,
    totalMs,
    dailyWins,
    currentStreak: current,
    longestStreak: longest,
    perGame,
    recentWins: wins.slice(0, recentLimit),
  };
}

/** A compact total, e.g. "2h 05m", "14m 03s" or "42s". */
export function formatPlayTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
