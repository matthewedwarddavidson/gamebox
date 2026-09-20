import { describe, expect, it } from 'vitest';
import { dailyFor, utcDateKey } from './daily';
import { DIFFICULTIES } from './types';

describe('kakuro daily', () => {
  it('derives a stable date key in UTC', () => {
    const d = new Date(Date.UTC(2024, 0, 5, 23, 30));
    expect(utcDateKey(d)).toBe('2024-01-05');
  });

  it('is deterministic for a given date', () => {
    const date = new Date(Date.UTC(2024, 5, 15));
    const a = dailyFor(date);
    const b = dailyFor(date);
    expect(a).toEqual(b);
    expect(a.dateKey).toBe('2024-06-15');
    expect(DIFFICULTIES).toContain(a.difficulty);
  });

  it('varies the seed across dates', () => {
    const a = dailyFor(new Date(Date.UTC(2024, 0, 1)));
    const b = dailyFor(new Date(Date.UTC(2024, 0, 2)));
    expect(a.seed).not.toBe(b.seed);
  });
});
