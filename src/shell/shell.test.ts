import { beforeEach, describe, expect, it } from 'vitest';
import { GAMES, getGame } from './registry';
import { useShell } from './shellStore';

describe('shell registry', () => {
  it('registers the shikaku game', () => {
    expect(getGame('shikaku')).toBeDefined();
    expect(GAMES.some((g) => g.id === 'shikaku')).toBe(true);
  });

  it('returns undefined for unknown games', () => {
    expect(getGame('nope')).toBeUndefined();
  });

  it('every game has an id, title, tagline and Root', () => {
    for (const g of GAMES) {
      expect(g.id).toBeTruthy();
      expect(g.title).toBeTruthy();
      expect(g.tagline).toBeTruthy();
      expect(typeof g.Root).toBe('function');
    }
  });
});

describe('shell store', () => {
  beforeEach(() => {
    useShell.getState().goHome();
  });

  it('starts at the hub after goHome', () => {
    expect(useShell.getState().activeGameId).toBeNull();
  });

  it('opens and closes a game', () => {
    useShell.getState().openGame('shikaku');
    expect(useShell.getState().activeGameId).toBe('shikaku');
    useShell.getState().goHome();
    expect(useShell.getState().activeGameId).toBeNull();
  });
});
