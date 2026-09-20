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

  it("does not reopen an earlier day's paused daily after a refresh", async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    useKakuro.getState().startDaily(yesterday);
    useKakuro.getState().enterDigit(1);
    useKakuro.getState().abandon();
    await settle();

    // A fresh page load: the store starts empty, then restores from storage.
    useKakuro.setState({ puzzle: null, screen: 'play', running: true });
    await useKakuro.getState().init();

    const s = useKakuro.getState();
    expect(s.screen).toBe('home');
    expect(s.running).toBe(false);
    expect(s.dailyKey).toBe(yesterday.toISOString().slice(0, 10));
    expect(s.puzzle).not.toBeNull(); // still there to resume from Home
  });

  it("reopens today's paused daily after a refresh", async () => {
    useKakuro.getState().startDaily();
    useKakuro.getState().enterDigit(1);
    useKakuro.getState().abandon();
    await settle();

    useKakuro.setState({ puzzle: null, screen: 'home', running: false });
    await useKakuro.getState().init();

    expect(useKakuro.getState()).toMatchObject({ screen: 'play', running: true });
  });

  it('counts a forfeit in the stats immediately, before it has been saved', () => {
    useKakuro.getState().startFree('easy');
    useKakuro.getState().abandon();
    // No awaiting: storage (the cloud, for signed-in players) may still be busy.
    expect(useKakuro.getState().stats).toMatchObject({ played: 1, won: 0 });
  });

  it('counts a win in the stats and calendar immediately, before it has been saved', () => {
    const day = new Date('2026-03-02T09:00:00Z');
    useKakuro.getState().startDaily(day);
    const { puzzle } = useKakuro.getState();
    if (!puzzle) throw new Error('no puzzle');
    const cells = puzzle.cells.flatMap((c, i) => (c.fill ? [i] : []));
    const last = cells[cells.length - 1];
    useKakuro.setState({
      digits: puzzle.solution.map((d, i) => (i === last ? 0 : d)),
      selected: last,
    });

    useKakuro.getState().enterDigit(puzzle.solution[last]);

    const s = useKakuro.getState();
    expect(s.solved).toBe(true);
    expect(s.stats).toMatchObject({ played: 1, won: 1 });
    expect(s.games.some((g) => g.status === 'won' && g.dailyKey === '2026-03-02')).toBe(true);
  });
});
