// Persistence + stats types for Train Tracks. Records are stored in the shared
// shell DB (namespaced by game), so these extend the shell's stored shapes.

import type { StoredGameRecord, StoredSavedGame } from '../../../shell/db';
import type { Difficulty, Mode, Piece } from '../engine/types';

export interface GameRecord extends StoredGameRecord {
  id: string;
  game: string; // 'traintracks'
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
  game: string; // 'traintracks'
  generatorVersion?: number; // engine version the puzzle was generated with
  seed: number;
  mode: Mode;
  difficulty: Difficulty;
  dailyKey?: string;
  pieces: Piece[];
  crosses: boolean[];
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
