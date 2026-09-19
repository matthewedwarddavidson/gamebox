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

/** The active palette tool: one of the six track pieces, or the empty (cross) mark. */
export type Tool = Piece | 'cross';

/** An undo/redo snapshot of the mutable board state. */
interface Snapshot {
  pieces: Piece[];
  crosses: boolean[];
}

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
  crosses: boolean[]; // player-annotated “no track here” marks
  tool: Tool; // active palette selection
  history: Snapshot[];
  future: Snapshot[];

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
  setTool: (tool: Tool) => void;
  startFree: (difficulty: Difficulty) => void;
  startDaily: (date?: Date) => void;
  viewSolution: (date?: Date) => void;
  nextFree: () => void;
  placeCell: (row: number, col: number) => void;
  dropTool: (row: number, col: number, tool: Tool) => void;
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

/** The default palette tool when a game starts (first available track piece). */
const DEFAULT_TOOL: Tool = PIECES[0];

function emptyCrosses(puzzle: Puzzle): boolean[] {
  return new Array(puzzle.size * puzzle.size).fill(false);
}

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
      crosses: s.crosses,
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
      crosses: emptyCrosses(puzzle),
      tool: DEFAULT_TOOL,
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

  /**
   * Apply a palette tool to a cell. `toggle` (tap) clears a cell that already
   * holds the same mark; drag-drop always places. A mistake is only counted when
   * an actual track piece is committed that differs from the solution.
   */
  function applyTool(row: number, col: number, tool: Tool, toggle: boolean): void {
    const s = get();
    if (!s.puzzle || s.solved || s.review) return;
    const i = idx(row, col, s.puzzle.size);
    if (s.locked[i]) return;

    const pieces = s.pieces.slice();
    const crosses = s.crosses.slice();

    if (tool === 'cross') {
      if (toggle && crosses[i]) {
        crosses[i] = false;
      } else {
        crosses[i] = true;
        pieces[i] = EMPTY;
      }
    } else if (toggle && pieces[i] === tool) {
      pieces[i] = EMPTY;
    } else {
      pieces[i] = tool;
      crosses[i] = false;
    }

    // Skip no-op interactions (e.g. dropping a piece already present).
    if (pieces[i] === s.pieces[i] && crosses[i] === s.crosses[i]) return;

    let mistakes = s.mistakes;
    const placed = tool !== 'cross' && pieces[i] === tool;
    if (placed && tool !== s.puzzle.solution[i]) mistakes++;

    set({
      pieces,
      crosses,
      history: [...s.history, { pieces: s.pieces, crosses: s.crosses }],
      future: [],
      mistakes,
    });

    if (isWin(pieces, s.puzzle.solution)) {
      void finishGame();
    } else {
      void saveCurrent();
    }
  }

  return {
    ready: false,
    screen: 'home',
    theme: 'light',
    puzzle: null,
    locked: [],
    pieces: [],
    crosses: [],
    tool: DEFAULT_TOOL,
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
        const crosses = emptyCrosses(puzzle);
        for (let i = 0; i < crosses.length; i++) {
          if (!locked[i] && saved.crosses?.[i]) crosses[i] = true;
        }
        set({
          puzzle,
          locked,
          pieces,
          crosses,
          tool: DEFAULT_TOOL,
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
      const { locked } = prepare(puzzle);
      // Read-only review of the finished board: reveal the full solution with no
      // timer, recording, or touching any in-progress saved game.
      set({
        puzzle,
        locked,
        pieces: puzzle.solution.slice(),
        crosses: emptyCrosses(puzzle),
        tool: DEFAULT_TOOL,
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

    placeCell(row, col) {
      applyTool(row, col, get().tool, true);
    },

    dropTool(row, col, tool) {
      set({ tool });
      applyTool(row, col, tool, false);
    },

    undo() {
      const s = get();
      if (s.history.length === 0 || !s.puzzle) return;
      const prev = s.history[s.history.length - 1];
      set({
        pieces: prev.pieces,
        crosses: prev.crosses,
        history: s.history.slice(0, -1),
        future: [{ pieces: s.pieces, crosses: s.crosses }, ...s.future],
      });
      if (!s.solved && isWin(prev.pieces, s.puzzle.solution)) {
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
        pieces: next.pieces,
        crosses: next.crosses,
        history: [...s.history, { pieces: s.pieces, crosses: s.crosses }],
        future: s.future.slice(1),
      });
      if (!s.solved && isWin(next.pieces, s.puzzle.solution)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    clearMarks() {
      const s = get();
      if (!s.puzzle || s.review) return;
      const pieces = initialPieces(s.puzzle);
      const crosses = emptyCrosses(s.puzzle);
      set({
        pieces,
        crosses,
        history: [...s.history, { pieces: s.pieces, crosses: s.crosses }],
        future: [],
      });
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
