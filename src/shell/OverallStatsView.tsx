import { useEffect, useState } from 'react';
import type { GameDefinition } from './types';
import { getGameRecords, onProviderChange } from './db';
import {
  computeOverallStats,
  formatPlayTime,
  type OverallStats,
  type RecordLike,
} from './overallStats';

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Stats across every game, for whoever is playing (guest or signed in). */
export function OverallStatsView({ games }: { games: GameDefinition[] }) {
  const [stats, setStats] = useState<OverallStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const entries = await Promise.all(
        games.map(
          async (g) =>
            [
              g.id,
              // Records from before games were tagged belong to Shikaku, the
              // original game; no other game should claim them.
              await getGameRecords<RecordLike & { game?: string }>(g.id, {
                includeUntagged: g.id === 'shikaku',
              }),
            ] as const,
        ),
      );
      if (!cancelled) setStats(computeOverallStats(Object.fromEntries(entries)));
    }
    void load();
    // Reload when the account changes (sign-in / sign-out swaps the data).
    const off = onProviderChange(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [games]);

  if (!stats) {
    return (
      <div className="app app--loading">
        <p>Loading…</p>
      </div>
    );
  }

  const title = (id: string) => games.find((g) => g.id === id)?.title ?? id;
  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="app">
      <div className="stats-view overall-stats">
        <section className="summary-grid">
          <div className="stat card">
            <span className="stat__value">{stats.played}</span>
            <span className="stat__label">Played</span>
          </div>
          <div className="stat card">
            <span className="stat__value">{stats.won}</span>
            <span className="stat__label">Won</span>
          </div>
          <div className="stat card">
            <span className="stat__value">{winRate}%</span>
            <span className="stat__label">Win rate</span>
          </div>
          <div className="stat card">
            <span className="stat__value">{stats.currentStreak}</span>
            <span className="stat__label">Daily streak</span>
          </div>
          <div className="stat card">
            <span className="stat__value">{stats.longestStreak}</span>
            <span className="stat__label">Best streak</span>
          </div>
          <div className="stat card">
            <span className="stat__value">{formatPlayTime(stats.totalMs)}</span>
            <span className="stat__label">Time solving</span>
          </div>
        </section>

        <section className="card">
          <h2>By game</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Played</th>
                <th>Won</th>
                <th>Win rate</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const s = stats.perGame[g.id] ?? { played: 0, won: 0, totalMs: 0 };
                return (
                  <tr key={g.id}>
                    <td>{g.title}</td>
                    <td>{s.played}</td>
                    <td>{s.won}</td>
                    <td>{s.played > 0 ? `${Math.round((s.won / s.played) * 100)}%` : '—'}</td>
                    <td>{s.totalMs > 0 ? formatPlayTime(s.totalMs) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Recent wins</h2>
          {stats.recentWins.length === 0 ? (
            <p className="muted">No games yet — go play one!</p>
          ) : (
            <ul className="history">
              {stats.recentWins.map(({ gameId, record }) => (
                <li key={`${gameId}-${record.id}`} className="history__row">
                  <span className="badge">{title(gameId)}</span>
                  <span>{capitalize(record.difficulty)}</span>
                  <span className="muted">{record.mode === 'daily' ? 'Daily' : 'Free'}</span>
                  <span className="history__score">
                    {record.durationMs !== undefined ? formatDuration(record.durationMs) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
