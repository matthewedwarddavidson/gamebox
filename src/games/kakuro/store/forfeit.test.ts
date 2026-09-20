import { beforeEach, describe, expect, it } from 'vitest';
import { getGameRecords, getSavedGame } from '../../../shell/db';
import { useKakuro } from './gameStore';
import { computeStats } from './stats';
import type { GameRecord } from './types';

const records = () => getGameRecords<GameRecord>('kakuro');

async function settle() {
  await new Promise((r) => setTimeout(r, 50));
}

describe('kakuro forfeit', () => {
  beforeEach(async () => {
    await useKakuro.getState().resetStats();
  });

  it('records an abandoned game and clears the save when leaving mid-puzzle', async () => {
    useKakuro.getState().startFree('easy');
    await settle();
    expect(await getSavedGame('kakuro')).toBeDefined();

    useKakuro.getState().abandon();
    await settle();

    expect(useKakuro.getState().screen).toBe('home');
    const saved = await records();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: 'abandoned', mode: 'free', difficulty: 'easy' });
    expect(await getSavedGame('kakuro')).toBeUndefined();

    const stats = computeStats(saved);
    expect(stats.played).toBe(1);
    expect(stats.won).toBe(0);
  });

  it('records the forfeit only once however many times it is called', async () => {
    useKakuro.getState().startFree('easy');
    useKakuro.getState().abandon();
    useKakuro.getState().abandon();
    await settle();
    expect(await records()).toHaveLength(1);
  });

  it('does not count leaving a solved or review board as a forfeit', async () => {
    useKakuro.getState().viewSolution(new Date('2026-01-05T00:00:00Z'));
    useKakuro.getState().abandon();
    await settle();
    expect(await records()).toHaveLength(0);
  });

  it('exempts dailies: no loss is recorded and the progress is kept', async () => {
    const day = new Date('2026-03-02T09:00:00Z');
    useKakuro.getState().startDaily(day);
    const first = useKakuro.getState().selected as number;
    useKakuro.getState().enterDigit(1);
    const puzzleId = useKakuro.getState().puzzle?.id;
    await settle();

    useKakuro.getState().abandon();
    await settle();

    expect(useKakuro.getState()).toMatchObject({ screen: 'home', running: false });
    expect(await records()).toHaveLength(0);
    expect(await getSavedGame('kakuro')).toBeDefined();

    // Coming back to the same day's puzzle resumes it rather than starting over.
    useKakuro.getState().startDaily(day);
    const s = useKakuro.getState();
    expect(s.screen).toBe('play');
    expect(s.running).toBe(true);
    expect(s.puzzle?.id).toBe(puzzleId);
    expect(s.digits[first]).toBe(1);
  });

  it('starts a different day fresh instead of resuming the paused one', async () => {
    useKakuro.getState().startDaily(new Date('2026-03-02T09:00:00Z'));
    useKakuro.getState().enterDigit(1);
    useKakuro.getState().abandon();
    useKakuro.getState().startDaily(new Date('2026-03-03T09:00:00Z'));
    expect(useKakuro.getState().dailyKey).toBe('2026-03-03');
    expect(useKakuro.getState().digits.every((d) => d === 0)).toBe(true);
  });
});
