// Registry of all games available in the app. To add a game, implement a
// GameDefinition and add it here — the hub and router pick it up automatically.
import type { GameDefinition } from './types';
import { shikakuGame } from '../games/shikaku';

export const GAMES: GameDefinition[] = [shikakuGame];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
