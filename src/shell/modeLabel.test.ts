import { describe, expect, it } from 'vitest';
import { modeLabel } from './modeLabel';

const NOW = new Date('2026-09-20T12:00:00Z');

describe('mode label', () => {
  it('labels free play', () => {
    expect(modeLabel('free', undefined, NOW)).toBe('Free');
  });

  it("labels today's daily plainly", () => {
    expect(modeLabel('daily', '2026-09-20', NOW)).toBe('Daily');
  });

  it("names the day when a daily isn't today's", () => {
    expect(modeLabel('daily', '2026-09-19', NOW)).toBe('Daily · 2026-09-19');
  });
});
