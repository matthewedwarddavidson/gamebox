// Battleships game store (Zustand). Owns the current puzzle, the player's cell
// marks, timer, mistakes, persistence (via the shared shell DB) and stats.

import { create } from 'zustand';
import {
  dailyFor,
  GENERATOR_VERSION,
  generate,
  idx,
  isShip,
  type CellType,
  type Difficulty,
  type Mode,
  type Puzzle,
  type Mark,
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

const GAME_ID = 'battleships';

export type Screen = 'home' | 'play' | 'stats';

export type Theme = 'light' | 'dark';

interface StartedPuzzle {
  puzzle: Puzzle;
  hintLocked: boolean[]; // cells fixed by a revealed hint
  solutionShip: boolean[]; // solution ship mask
}

interface GameState {
  ready: boolean;
  screen: Screen;
  theme: Theme;

  puzzle: Puzzle | null;
  hintLocked: boolean[];
  solutionShip: boolean[];

  tool: Mark; // active paint tool: 'ship' or 'water'
  marks: Mark[];
  history: Mark[][];
  future: Mark[][];

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
  setTool: (tool: Mark) => void;
  startFree: (difficulty: Difficulty) => void;
  startDaily: (date?: Date) => void;
  viewSolution: (date?: Date) => void;
  nextFree: () => void;
  cycleCell: (row: number, col: number) => void;
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

function prepare(puzzle: Puzzle): StartedPuzzle {
  const n = puzzle.size * puzzle.size;
  const hintLocked = new Array(n).fill(false);
  const solutionShip = new Array(n).fill(false);
  for (let i = 0; i < n; i++) solutionShip[i] = isShip(puzzle.solution[i]);
  return { puzzle, hintLocked, solutionShip };
}

function initialMarks(puzzle: Puzzle, hintLocked: boolean[]): Mark[] {
  const n = puzzle.size * puzzle.size;
  const marks: Mark[] = new Array(n).fill('unknown');
  for (const h of puzzle.hints) {
    const i = idx(h.row, h.col, puzzle.size);
    hintLocked[i] = true;
    marks[i] = isShip(h.type) ? 'ship' : 'water';
  }
  return marks;
}

function isWin(marks: Mark[], solutionShip: boolean[]): boolean {
  for (let i = 0; i < marks.length; i++) {
    const marked = marks[i] === 'ship';
    if (marked !== solutionShip[i]) return false;
  }
  return true;
}

export const useBattleships = create<GameState>((set, get) => {
  async function saveCurrent(): Promise<void> {
    const s = get();
    if (!s.puzzle || s.solved || s.review) return;
    const saved: SavedGame = {
      id: GAME_ID,
      game: GAME_ID,
      generatorVersion: GENERATOR_VERSION,
      seed: s.puzzle.seed,
      mode: s.mode,
      difficulty: s.puzzle.difficulty,
      dailyKey: s.dailyKey,
      marks: s.marks,
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
    const { hintLocked, solutionShip } = prepare(puzzle);
    const marks = initialMarks(puzzle, hintLocked);
    set({
      puzzle,
      hintLocked,
      solutionShip,
      marks,
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
    hintLocked: [],
    solutionShip: [],
    tool: 'ship',
    marks: [],
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

      // Ignore a save made by an older generator: its puzzle would now differ.
      if (saved && (saved.generatorVersion ?? 1) === GENERATOR_VERSION) {
        const puzzle = generate(saved.seed, saved.difficulty);
        const { hintLocked, solutionShip } = prepare(puzzle);
        // Re-lock hint cells; overlay the player's saved marks.
        const marks = initialMarks(puzzle, hintLocked);
        for (let i = 0; i < marks.length; i++) {
          if (!hintLocked[i] && saved.marks[i]) marks[i] = saved.marks[i];
        }
        set({
          puzzle,
          hintLocked,
          solutionShip,
          marks,
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
        if (isWin(marks, solutionShip)) void finishGame();
      }
    },

    navigate(screen) {
      set({ screen });
    },

    setTool(tool) {
      set({ tool });
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
      const { hintLocked, solutionShip } = prepare(puzzle);
      // Read-only review of the finished board: reveal every cell without a
      // timer, recording, or touching any in-progress saved game.
      const marks: Mark[] = puzzle.solution.map((t) => (isShip(t) ? 'ship' : 'water'));
      set({
        puzzle,
        hintLocked,
        solutionShip,
        marks,
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

    cycleCell(row, col) {
      const s = get();
      if (!s.puzzle || s.solved || s.review) return;
      const i = idx(row, col, s.puzzle.size);
      if (s.hintLocked[i]) return;

      // Toggle the active tool on/off; tapping a cell that already holds the
      // other mark switches it to the active tool.
      const next: Mark = s.marks[i] === s.tool ? 'unknown' : s.tool;
      const marks = s.marks.slice();
      marks[i] = next;

      let mistakes = s.mistakes;
      if (next === 'ship' && !s.solutionShip[i]) mistakes++;

      set({
        marks,
        history: [...s.history, s.marks],
        future: [],
        mistakes,
      });

      if (isWin(marks, s.solutionShip)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    undo() {
      const s = get();
      if (s.history.length === 0) return;
      const prev = s.history[s.history.length - 1];
      set({
        marks: prev,
        history: s.history.slice(0, -1),
        future: [s.marks, ...s.future],
      });
      if (!s.solved && isWin(prev, s.solutionShip)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    redo() {
      const s = get();
      if (s.future.length === 0) return;
      const next = s.future[0];
      set({
        marks: next,
        history: [...s.history, s.marks],
        future: s.future.slice(1),
      });
      if (!s.solved && isWin(next, s.solutionShip)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    clearMarks() {
      const s = get();
      if (!s.puzzle || s.review) return;
      const marks = initialMarks(s.puzzle, s.hintLocked.slice());
      set({ marks, history: [...s.history, s.marks], future: [] });
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

/** Convenience selector: the solution ship type at a cell (for review mode). */
export function solutionTypeAt(puzzle: Puzzle, row: number, col: number): CellType {
  return puzzle.solution[idx(row, col, puzzle.size)];
}
