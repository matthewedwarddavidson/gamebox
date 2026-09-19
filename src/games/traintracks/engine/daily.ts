// Daily Train Tracks puzzle: deterministic seed + difficulty from a UTC date.

import { hashString } from '../../../shared/rng';
import { DIFFICULTIES, type Difficulty } from './types';

export function utcDateKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DailyDescriptor {
  dateKey: string;
  seed: number;
  difficulty: Difficulty;
}

export function dailyFor(date: Date = new Date()): DailyDescriptor {
  const dateKey = utcDateKey(date);
  const seed = hashString(`traintracks-daily-${dateKey}`);
  const dIndex = hashString(`traintracks-daily-diff-${dateKey}`) % DIFFICULTIES.length;
  return { dateKey, seed, difficulty: DIFFICULTIES[dIndex] };
}
