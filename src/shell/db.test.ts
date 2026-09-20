import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUD_SAVE_DELAY_MS,
  flushPendingSaves,
  localProvider,
  setActiveProvider,
  clearGameRecords,
  clearSavedGame,
  getGameRecords,
  getSavedGame,
  putGameRecord,
  putSavedGame,
} from './db';
import type { PersistenceProvider, StoredSavedGame } from './persistence/types';

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

describe('shell db cloud save batching', () => {
  const stored: StoredSavedGame[] = [];
  const cloud = {
    putSavedGame: vi.fn(async (saved: StoredSavedGame) => {
      stored.push(saved);
    }),
    getSavedGame: vi.fn(async () => undefined),
    clearSavedGame: vi.fn(async () => {}),
  } as unknown as PersistenceProvider;

  afterEach(() => {
    vi.useRealTimers();
    setActiveProvider(localProvider);
    stored.length = 0;
  });

  it('coalesces a burst of cloud saves into one write, readable meanwhile', async () => {
    vi.useFakeTimers();
    setActiveProvider(cloud);
    for (let n = 1; n <= 5; n++) await putSavedGame({ id: 'omega', game: 'omega', n });
    expect(cloud.putSavedGame).not.toHaveBeenCalled();
    expect(await getSavedGame('omega')).toMatchObject({ n: 5 });

    await vi.advanceTimersByTimeAsync(CLOUD_SAVE_DELAY_MS);
    expect(stored).toEqual([{ id: 'omega', game: 'omega', n: 5 }]);
  });

  it('flushes on demand and when the account changes', async () => {
    vi.useFakeTimers();
    setActiveProvider(cloud);
    await putSavedGame({ id: 'psi', game: 'psi', n: 1 });
    await flushPendingSaves();
    expect(stored.map((s) => s.id)).toEqual(['psi']);

    await putSavedGame({ id: 'chi', game: 'chi', n: 1 });
    setActiveProvider(localProvider); // sign-out: the queued save must not be lost
    await vi.advanceTimersByTimeAsync(0);
    expect(stored.map((s) => s.id)).toEqual(['psi', 'chi']);
  });

  it('does not write a save that was cleared before it fired', async () => {
    vi.useFakeTimers();
    setActiveProvider(cloud);
    await putSavedGame({ id: 'phi', game: 'phi', n: 1 });
    await clearSavedGame('phi');
    await vi.advanceTimersByTimeAsync(CLOUD_SAVE_DELAY_MS * 2);
    expect(stored).toHaveLength(0);
  });

  it('writes guest saves straight away', async () => {
    await putSavedGame({ id: 'rho', game: 'rho', n: 1 });
    expect((await localProvider.getSavedGame('rho'))?.id).toBe('rho');
  });
});
