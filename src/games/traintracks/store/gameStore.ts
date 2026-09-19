// Train Tracks game store (Zustand). Owns the current puzzle, the player's
// piece grid, timer, mistakes, persistence (via the shared shell DB) and stats.

import { create } from 'zustand';
import {
  EMPTY,
  PIECES,
  dailyFor,
  generate,
  idx,
  type Difficulty,
  type Mode,
  type Piece,
  type Puzzle,
} from '../engine';
import {
  clearGameRecords,
  clearSavedGame,
  getGameRecords,
  getSavedGame,
  getSettings,
  putGameRecord,
  putSavedGame,
} from '../../../shell/db';
import { computeStats, emptyStats } from './stats';
import type { GameRecord, SavedGame, Stats } from './types';
import { trackGameCompleted, trackGameStarted } from '../../../shell/analytics';

const GAME_ID = 'traintracks';

export type Screen = 'home' | 'play' | 'stats';

export type Theme = 'light' | 'dark';

interface StartedPuzzle {
  puzzle: Puzzle;
  locked: boolean[]; // cells fixed by a given piece
}

interface GameState {
  ready: boolean;
  screen: Screen;
  theme: Theme;

  puzzle: Puzzle | null;
  locked: boolean[];

  pieces: Piece[];
  history: Piece[][];
  future: Piece[][];

  mode: Mode;
  dailyKey?: string;
  mistakes: number;
  startedAt: number;
  elapsedMs: number;
  running: boolean;
  solved: boolean;
  review: boolean;
  recordId: string | null;

  stats: Stats;
  games: GameRecord[];

  init: () => Promise<void>;
  navigate: (screen: Screen) => void;
  startFree: (difficulty: Difficulty) => void;
  startDaily: (date?: Date) => void;
  viewSolution: (date?: Date) => void;
  nextFree: () => void;
  cycleCell: (row: number, col: number, reverse?: boolean) => void;
  undo: () => void;
  redo: () => void;
  clearMarks: () => void;
  tick: () => void;
  abandon: () => void;
  resetStats: () => Promise<void>;
}

function newRecordId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** The ordered cycle of cell states the player taps through. */
const CYCLE: Piece[] = [EMPTY, ...PIECES];

function prepare(puzzle: Puzzle): StartedPuzzle {
  const n = puzzle.size * puzzle.size;
  const locked = new Array(n).fill(false);
  for (const g of puzzle.givens) locked[idx(g.row, g.col, puzzle.size)] = true;
  return { puzzle, locked };
}

function initialPieces(puzzle: Puzzle): Piece[] {
  const n = puzzle.size * puzzle.size;
  const pieces: Piece[] = new Array(n).fill(EMPTY);
  for (const g of puzzle.givens) pieces[idx(g.row, g.col, puzzle.size)] = g.piece;
  return pieces;
}

function isWin(pieces: Piece[], solution: Piece[]): boolean {
  for (let i = 0; i < pieces.length; i++) {
    if (pieces[i] !== solution[i]) return false;
  }
  return true;
}

export const useTrainTracks = create<GameState>((set, get) => {
  async function saveCurrent(): Promise<void> {
    const s = get();
    if (!s.puzzle || s.solved || s.review) return;
    const saved: SavedGame = {
      id: GAME_ID,
      game: GAME_ID,
      seed: s.puzzle.seed,
      mode: s.mode,
      difficulty: s.puzzle.difficulty,
      dailyKey: s.dailyKey,
      pieces: s.pieces,
      startedAt: s.startedAt,
      elapsedMs: s.elapsedMs,
      mistakes: s.mistakes,
    };
    await putSavedGame(saved);
  }

  async function refreshStats(): Promise<void> {
    const games = await getGameRecords<GameRecord>(GAME_ID);
    set({ games, stats: computeStats(games) });
  }

  function beginGame(puzzle: Puzzle, mode: Mode, dailyKey?: string): void {
    const { locked } = prepare(puzzle);
    const pieces = initialPieces(puzzle);
    set({
      puzzle,
      locked,
      pieces,
      history: [],
      future: [],
      mode,
      dailyKey,
      mistakes: 0,
      startedAt: Date.now(),
      elapsedMs: 0,
      running: true,
      solved: false,
      review: false,
      recordId: newRecordId(),
      screen: 'play',
    });
    trackGameStarted({ game: GAME_ID, mode, difficulty: puzzle.difficulty });
    void saveCurrent();
  }

  async function finishGame(): Promise<void> {
    const s = get();
    if (!s.puzzle) return;
    const durationMs = s.elapsedMs;

    trackGameCompleted({
      game: GAME_ID,
      mode: s.mode,
      difficulty: s.puzzle.difficulty,
      durationMs,
    });

    const alreadyWonDaily =
      s.mode === 'daily' &&
      s.dailyKey !== undefined &&
      s.games.some(
        (g) => g.mode === 'daily' && g.status === 'won' && g.dailyKey === s.dailyKey,
      );

    set({ running: false, solved: true });

    if (!alreadyWonDaily) {
      const record: GameRecord = {
        id: s.recordId ?? newRecordId(),
        game: GAME_ID,
        seed: s.puzzle.seed,
        mode: s.mode,
        difficulty: s.puzzle.difficulty,
        startedAt: s.startedAt,
        finishedAt: Date.now(),
        durationMs,
        status: 'won',
        mistakes: s.mistakes,
        dailyKey: s.dailyKey,
      };
      await putGameRecord(record);
    }
    await clearSavedGame(GAME_ID);
    await refreshStats();
  }

  return {
    ready: false,
    screen: 'home',
    theme: 'light',
    puzzle: null,
    locked: [],
    pieces: [],
    history: [],
    future: [],
    mode: 'free',
    dailyKey: undefined,
    mistakes: 0,
    startedAt: 0,
    elapsedMs: 0,
    running: false,
    solved: false,
    review: false,
    recordId: null,
    stats: emptyStats(),
    games: [],

    async init() {
      const [settings, games, saved] = await Promise.all([
        getSettings<{ id: string; theme?: Theme }>(),
        getGameRecords<GameRecord>(GAME_ID),
        getSavedGame<SavedGame>(GAME_ID),
      ]);
      set({
        theme: settings?.theme ?? 'light',
        games,
        stats: computeStats(games),
        ready: true,
      });

      if (saved) {
        const puzzle = generate(saved.seed, saved.difficulty);
        const { locked } = prepare(puzzle);
        // Re-lock given cells; overlay the player's saved pieces.
        const pieces = initialPieces(puzzle);
        for (let i = 0; i < pieces.length; i++) {
          if (!locked[i] && saved.pieces[i] !== undefined) pieces[i] = saved.pieces[i];
        }
        set({
          puzzle,
          locked,
          pieces,
          mode: saved.mode,
          dailyKey: saved.dailyKey,
          mistakes: saved.mistakes,
          startedAt: Date.now() - saved.elapsedMs,
          elapsedMs: saved.elapsedMs,
          running: false,
          solved: false,
          review: false,
          recordId: newRecordId(),
        });

        // A saved board can already be complete (e.g. finished via undo before
        // a reload); recognise the win on resume rather than requiring a move.
        if (isWin(pieces, puzzle.solution)) void finishGame();
      }
    },

    navigate(screen) {
      set({ screen });
    },

    startFree(difficulty) {
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      beginGame(generate(seed, difficulty), 'free');
    },

    startDaily(date) {
      const { seed, difficulty, dateKey } = dailyFor(date ?? new Date());
      beginGame(generate(seed, difficulty), 'daily', dateKey);
    },

    viewSolution(date) {
      const { seed, difficulty, dateKey } = dailyFor(date ?? new Date());
      const puzzle = generate(seed, difficulty);
      const { locked } = prepare(puzzle);
      // Read-only review of the finished board: reveal the full solution with no
      // timer, recording, or touching any in-progress saved game.
      set({
        puzzle,
        locked,
        pieces: puzzle.solution.slice(),
        history: [],
        future: [],
        mode: 'daily',
        dailyKey: dateKey,
        mistakes: 0,
        startedAt: Date.now(),
        elapsedMs: 0,
        running: false,
        solved: false,
        review: true,
        recordId: null,
        screen: 'play',
      });
    },

    nextFree() {
      const s = get();
      const difficulty = s.puzzle?.difficulty ?? 'easy';
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      beginGame(generate(seed, difficulty), 'free');
    },

    cycleCell(row, col, reverse = false) {
      const s = get();
      if (!s.puzzle || s.solved || s.review) return;
      const i = idx(row, col, s.puzzle.size);
      if (s.locked[i]) return;

      const cur = CYCLE.indexOf(s.pieces[i]);
      const at = cur < 0 ? 0 : cur;
      const nextIdx = (at + (reverse ? -1 : 1) + CYCLE.length) % CYCLE.length;
      const next = CYCLE[nextIdx];

      const pieces = s.pieces.slice();
      pieces[i] = next;

      let mistakes = s.mistakes;
      if (next !== EMPTY && next !== s.puzzle.solution[i]) mistakes++;

      set({
        pieces,
        history: [...s.history, s.pieces],
        future: [],
        mistakes,
      });

      if (isWin(pieces, s.puzzle.solution)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    undo() {
      const s = get();
      if (s.history.length === 0 || !s.puzzle) return;
      const prev = s.history[s.history.length - 1];
      set({
        pieces: prev,
        history: s.history.slice(0, -1),
        future: [s.pieces, ...s.future],
      });
      if (!s.solved && isWin(prev, s.puzzle.solution)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    redo() {
      const s = get();
      if (s.future.length === 0 || !s.puzzle) return;
      const next = s.future[0];
      set({
        pieces: next,
        history: [...s.history, s.pieces],
        future: s.future.slice(1),
      });
      if (!s.solved && isWin(next, s.puzzle.solution)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    clearMarks() {
      const s = get();
      if (!s.puzzle || s.review) return;
      const pieces = initialPieces(s.puzzle);
      set({ pieces, history: [...s.history, s.pieces], future: [] });
      void saveCurrent();
    },

    tick() {
      const s = get();
      if (!s.running || s.solved) return;
      set({ elapsedMs: Date.now() - s.startedAt });
    },

    abandon() {
      const s = get();
      set({ running: false });
      if (s.puzzle && !s.solved && !s.review) void clearSavedGame(GAME_ID);
      set({ screen: 'home', review: false });
    },

    async resetStats() {
      await clearGameRecords(GAME_ID);
      await clearSavedGame(GAME_ID);
      set({ games: [], stats: emptyStats() });
    },
  };
});
