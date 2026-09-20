// Persistence + stats types for Kakuro. Records are stored in the shared shell
// DB (namespaced by game), so these extend the shell's stored shapes.

import type { StoredGameRecord, StoredSavedGame } from '../../../shell/db';
import type { Difficulty, Mode } from '../engine/types';

export interface GameRecord extends StoredGameRecord {
  id: string;
  game: string; // 'kakuro'
  seed: number;
  mode: Mode;
  difficulty: Difficulty;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  status: 'won' | 'abandoned' | 'in-progress';
  mistakes: number;
  dailyKey?: string;
}

export interface SavedGame extends StoredSavedGame {
  id: string; // the game id key
  game: string; // 'kakuro'
  seed: number;
  mode: Mode;
  difficulty: Difficulty;
  dailyKey?: string;
  digits: number[]; // player's entry per cell, 0 for blank/clue cells
  notes?: number[]; // pencil-mark bitmask per cell (absent in older saves)
  startedAt: number;
  elapsedMs: number;
  mistakes: number;
}

export interface DifficultyStats {
  played: number;
  won: number;
  bestMs?: number;
  avgMs?: number;
}

export interface Stats {
  played: number;
  won: number;
  currentStreak: number;
  longestStreak: number;
  byDifficulty: Record<Difficulty, DifficultyStats>;
}
