import { describe, expect, it } from 'vitest';
import {
  clearGameRecords,
  clearSavedGame,
  getGameRecords,
  getSavedGame,
  putGameRecord,
  putSavedGame,
} from './db';

describe('shell db game scoping', () => {
  it('separates records by game', async () => {
    await putGameRecord({ id: 'a1', game: 'alpha' });
    await putGameRecord({ id: 'a2', game: 'alpha' });
    await putGameRecord({ id: 'b1', game: 'beta' });

    const alpha = await getGameRecords('alpha');
    const beta = await getGameRecords('beta');
    expect(alpha.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
    expect(beta.map((r) => r.id)).toEqual(['b1']);
  });

  it('only claims untagged (legacy) records when asked', async () => {
    await putGameRecord({ id: 'legacy1' }); // no game field
    const withoutClaim = await getGameRecords('gamma');
    expect(withoutClaim.some((r) => r.id === 'legacy1')).toBe(false);

    const withClaim = await getGameRecords('gamma', { includeUntagged: true });
    expect(withClaim.some((r) => r.id === 'legacy1')).toBe(true);
  });

  it('clears only the targeted game', async () => {
    await putGameRecord({ id: 'x1', game: 'delta' });
    await putGameRecord({ id: 'y1', game: 'epsilon' });
    await clearGameRecords('delta');
    expect(await getGameRecords('delta')).toHaveLength(0);
    expect((await getGameRecords('epsilon')).map((r) => r.id)).toEqual(['y1']);
  });

  it('keeps saved games per-game with a legacy fallback', async () => {
    await putSavedGame({ id: 'zeta', game: 'zeta', state: 1 });
    expect((await getSavedGame('zeta'))?.id).toBe('zeta');

    // Legacy singleton falls back only for the game that claims it.
    await putSavedGame({ id: 'current', state: 2 });
    expect((await getSavedGame('eta', { legacyId: 'current' }))?.id).toBe('current');
    expect(await getSavedGame('eta')).toBeUndefined();

    await clearSavedGame('eta', { legacyId: 'current' });
    expect(await getSavedGame('eta', { legacyId: 'current' })).toBeUndefined();
  });
});
