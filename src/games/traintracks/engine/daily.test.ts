import { describe, expect, it } from 'vitest';
import { dailyFor, utcDateKey } from './daily';
import { DIFFICULTIES } from './types';

describe('train tracks daily', () => {
  it('formats a UTC date key', () => {
    expect(utcDateKey(new Date(Date.UTC(2026, 8, 19)))).toBe('2026-09-19');
  });

  it('is deterministic for a given date', () => {
    const date = new Date(Date.UTC(2026, 0, 2));
    const a = dailyFor(date);
    const b = dailyFor(date);
    expect(a).toEqual(b);
    expect(a.dateKey).toBe('2026-01-02');
    expect(DIFFICULTIES).toContain(a.difficulty);
  });

  it('varies the seed across days', () => {
    const d1 = dailyFor(new Date(Date.UTC(2026, 0, 1)));
    const d2 = dailyFor(new Date(Date.UTC(2026, 0, 2)));
    expect(d1.seed).not.toBe(d2.seed);
  });
});
