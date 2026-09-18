import { beforeEach, describe, expect, it } from 'vitest';
import { useBattleships } from './gameStore';
import { idx } from '../engine';

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Drive the store to the puzzle's solution by marking every ship cell. */
async function solveCurrent(): Promise<void> {
  const { puzzle, hintLocked, solutionShip } = useBattleships.getState();
  if (!puzzle) throw new Error('no puzzle');
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      const i = idx(r, c, puzzle.size);
      if (solutionShip[i] && !hintLocked[i]) {
        useBattleships.getState().cycleCell(r, c); // unknown -> ship
      }
    }
  }
  await flush();
}

describe('battleships store', () => {
  beforeEach(async () => {
    await useBattleships.getState().resetStats();
    await useBattleships.getState().init();
  });

  it('marks a cell and counts a mistake on a wrong ship placement', () => {
    useBattleships.getState().startFree('hard');
    const { puzzle, solutionShip } = useBattleships.getState();
    if (!puzzle) throw new Error('no puzzle');
    // Find a non-hint water cell and mark it a ship.
    const { hintLocked } = useBattleships.getState();
    let placed = false;
    for (let i = 0; i < solutionShip.length && !placed; i++) {
      if (!solutionShip[i] && !hintLocked[i]) {
        useBattleships.getState().cycleCell(Math.floor(i / puzzle.size), i % puzzle.size);
        placed = true;
      }
    }
    expect(useBattleships.getState().mistakes).toBe(1);
    expect(useBattleships.getState().solved).toBe(false);
  });

  it('detects a win and records a completed game', async () => {
    useBattleships.getState().startFree('hard');
    await solveCurrent();
    expect(useBattleships.getState().solved).toBe(true);
    expect(useBattleships.getState().mistakes).toBe(0);
    const games = useBattleships.getState().games;
    expect(games.length).toBe(1);
    expect(games[0].status).toBe('won');
    expect(games[0].game).toBe('battleships');
    expect(useBattleships.getState().stats.won).toBe(1);
  });

  it('undo reverts the last mark', () => {
    useBattleships.getState().startFree('easy');
    const { puzzle, solutionShip, hintLocked } = useBattleships.getState();
    if (!puzzle) throw new Error('no puzzle');
    const target = solutionShip.findIndex((v, i) => v && !hintLocked[i]);
    const r = Math.floor(target / puzzle.size);
    const c = target % puzzle.size;
    useBattleships.getState().cycleCell(r, c);
    expect(useBattleships.getState().marks[target]).toBe('ship');
    useBattleships.getState().undo();
    expect(useBattleships.getState().marks[target]).toBe('unknown');
  });
});
