import { describe, expect, it } from 'vitest';
import { computeOverallStats, formatPlayTime, type RecordLike } from './overallStats';

const NOW = new Date('2026-09-20T12:00:00Z');

function win(id: string, extra: Partial<RecordLike> = {}): RecordLike {
  return { id, mode: 'free', difficulty: 'easy', status: 'won', durationMs: 60_000, finishedAt: 1, ...extra };
}

describe('overall stats', () => {
  it('is empty with no records', () => {
    const s = computeOverallStats({ a: [] }, NOW);
    expect(s).toMatchObject({ played: 0, won: 0, totalMs: 0, currentStreak: 0, longestStreak: 0 });
    expect(s.perGame.a).toEqual({ played: 0, won: 0, totalMs: 0 });
  });

  it('adds up games across every game and ignores in-progress records', () => {
    const s = computeOverallStats(
      {
        a: [win('1'), win('2', { durationMs: 30_000 }), win('3', { status: 'in-progress' })],
        b: [win('4'), win('5', { status: 'abandoned', durationMs: undefined })],
      },
      NOW,
    );
    expect(s.played).toBe(4);
    expect(s.won).toBe(3);
    expect(s.totalMs).toBe(150_000);
    expect(s.perGame.a).toEqual({ played: 2, won: 2, totalMs: 90_000 });
    expect(s.perGame.b).toEqual({ played: 2, won: 1, totalMs: 60_000 });
  });

  it('counts a daily streak across different games', () => {
    const daily = (id: string, day: string) => win(id, { mode: 'daily', dailyKey: day });
    const s = computeOverallStats(
      {
        a: [daily('1', '2026-09-18'), daily('2', '2026-09-20')],
        b: [daily('3', '2026-09-19'), daily('4', '2026-09-20')], // same day, second game
      },
      NOW,
    );
    expect(s.dailyWins).toBe(4);
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
  });

  it('breaks the current streak after a missed day but remembers the best', () => {
    const daily = (id: string, day: string) => win(id, { mode: 'daily', dailyKey: day });
    const s = computeOverallStats(
      { a: [daily('1', '2026-09-01'), daily('2', '2026-09-02'), daily('3', '2026-09-03'), daily('4', '2026-09-10')] },
      NOW,
    );
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(3);
  });

  it('keeps a streak alive when the last daily win was yesterday', () => {
    const s = computeOverallStats(
      { a: [win('1', { mode: 'daily', dailyKey: '2026-09-19' })] },
      NOW,
    );
    expect(s.currentStreak).toBe(1);
  });

  it('lists the most recent wins first across games', () => {
    const s = computeOverallStats(
      {
        a: [win('old', { finishedAt: 10 }), win('new', { finishedAt: 30 })],
        b: [win('mid', { finishedAt: 20 })],
      },
      NOW,
      2,
    );
    expect(s.recentWins.map((w) => [w.gameId, w.record.id])).toEqual([
      ['a', 'new'],
      ['b', 'mid'],
    ]);
  });
});

describe('formatPlayTime', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatPlayTime(42_000)).toBe('42s');
    expect(formatPlayTime(14 * 60_000 + 3_000)).toBe('14m 03s');
    expect(formatPlayTime(2 * 3_600_000 + 5 * 60_000)).toBe('2h 05m');
  });
});
