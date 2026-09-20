// Kakuro game store (Zustand). Owns the current puzzle, the player's entered
// digits, the selected cell, timer, mistakes, persistence (via the shared shell
// DB) and stats.

import { create } from 'zustand';
import {
  computeRuns,
  dailyFor,
  GENERATOR_VERSION,
  generate,
  type Difficulty,
  type Mode,
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
import { clearNote, toggleNote } from './notes';
import type { GameRecord, SavedGame, Stats } from './types';
import { trackGameCompleted, trackGameStarted } from '../../../shell/analytics';

const GAME_ID = 'kakuro';

export type Screen = 'home' | 'play' | 'stats';

export type Theme = 'light' | 'dark';

/** An undo/redo snapshot of the mutable board state. */
interface Snapshot {
  digits: number[];
  notes: number[];
}

interface GameState {
  ready: boolean;
  screen: Screen;
  theme: Theme;

  puzzle: Puzzle | null;
  digits: number[]; // player entry per cell, 0 = blank; clue cells stay 0
  notes: number[]; // pencil-mark bitmask per cell
  pencil: boolean; // digit input toggles pencil marks instead of entering
  selected: number | null; // selected fill-cell index
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
  startFree: (difficulty: Difficulty) => void;
  startDaily: (date?: Date) => void;
  viewSolution: (date?: Date) => void;
  nextFree: () => void;
  select: (index: number | null) => void;
  moveSelection: (dRow: number, dCol: number) => void;
  enterDigit: (digit: number) => void;
  erase: () => void;
  togglePencil: () => void;
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

function emptyDigits(puzzle: Puzzle): number[] {
  return new Array(puzzle.size * puzzle.size).fill(0);
}

/** The first selectable (white) cell, so play starts with a sensible cursor. */
function firstFillCell(puzzle: Puzzle): number | null {
  for (let i = 0; i < puzzle.cells.length; i++) if (puzzle.cells[i].fill) return i;
  return null;
}

function emptyNotes(puzzle: Puzzle): number[] {
  return new Array(puzzle.size * puzzle.size).fill(0);
}

function isWin(digits: number[], puzzle: Puzzle): boolean {
  const { cells, solution } = puzzle;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].fill && digits[i] !== solution[i]) return false;
  }
  return true;
}

export const useKakuro = create<GameState>((set, get) => {
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
      digits: s.digits,
      notes: s.notes,
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
    set({
      puzzle,
      digits: emptyDigits(puzzle),
      notes: emptyNotes(puzzle),
      pencil: false,
      selected: firstFillCell(puzzle),
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
   * Write `digit` (0 clears) into the selected white cell. A mistake is only
   * counted when a non-zero digit that differs from the solution is committed.
   * Entering a digit clears the cell's pencil marks, and that digit from the
   * notes of every other cell in its across and down runs; clearing an already empty
   * cell removes its pencil marks instead.
   */
  function place(digit: number): void {
    const s = get();
    if (!s.puzzle || s.solved || s.review) return;
    const i = s.selected;
    if (i === null || !s.puzzle.cells[i].fill) return;

    const clearingNotes = digit === 0 && s.digits[i] === 0;
    if (s.digits[i] === digit && !clearingNotes) return;
    if (clearingNotes && s.notes[i] === 0) return;

    const digits = s.digits.slice();
    digits[i] = digit;
    const notes = s.notes.slice();
    notes[i] = 0;
    if (digit !== 0) {
      // The digit can no longer appear elsewhere in this cell's runs.
      for (const run of computeRuns(s.puzzle.cells, s.puzzle.size)) {
        if (!run.cells.includes(i)) continue;
        for (const ci of run.cells) notes[ci] = clearNote(notes[ci], digit);
      }
    }

    let mistakes = s.mistakes;
    if (digit !== 0 && digit !== s.puzzle.solution[i]) mistakes++;

    set({
      digits,
      notes,
      history: [...s.history, { digits: s.digits, notes: s.notes }],
      future: [],
      mistakes,
    });

    if (isWin(digits, s.puzzle)) {
      void finishGame();
    } else {
      void saveCurrent();
    }
  }

  /** Toggle a pencil mark for `digit` in the selected cell (if still empty). */
  function pencilIn(digit: number): void {
    const s = get();
    if (!s.puzzle || s.solved || s.review) return;
    const i = s.selected;
    if (i === null || !s.puzzle.cells[i].fill || s.digits[i] !== 0) return;

    const notes = s.notes.slice();
    notes[i] = toggleNote(notes[i], digit);
    set({
      notes,
      history: [...s.history, { digits: s.digits, notes: s.notes }],
      future: [],
    });
    void saveCurrent();
  }

  return {
    ready: false,
    screen: 'home',
    theme: 'light',
    puzzle: null,
    digits: [],
    notes: [],
    pencil: false,
    selected: null,
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

      // Saves from an older generator (unstamped ones are version 1) no longer fit.
      if (saved && (saved.generatorVersion ?? 1) === GENERATOR_VERSION) {
        const puzzle = generate(saved.seed, saved.difficulty);
        const digits = emptyDigits(puzzle);
        const notes = emptyNotes(puzzle);
        for (let i = 0; i < digits.length; i++) {
          if (!puzzle.cells[i].fill) continue;
          if (saved.digits?.[i]) digits[i] = saved.digits[i];
          else if (saved.notes?.[i]) notes[i] = saved.notes[i];
        }
        set({
          puzzle,
          digits,
          notes,
          pencil: false,
          selected: firstFillCell(puzzle),
          history: [],
          future: [],
          mode: saved.mode,
          dailyKey: saved.dailyKey,
          mistakes: saved.mistakes,
          startedAt: Date.now() - saved.elapsedMs,
          elapsedMs: saved.elapsedMs,
          running: true,
          solved: false,
          review: false,
          recordId: newRecordId(),
          screen: 'play',
        });

        // A saved board can already be complete (e.g. finished via undo before
        // a reload); recognise the win on resume rather than requiring a move.
        if (isWin(digits, puzzle)) void finishGame();
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
      // Read-only review of the finished board: reveal the full solution with no
      // timer, recording, or touching any in-progress saved game.
      const digits = emptyDigits(puzzle);
      for (let i = 0; i < digits.length; i++) {
        if (puzzle.cells[i].fill) digits[i] = puzzle.solution[i];
      }
      set({
        puzzle,
        digits,
        notes: emptyNotes(puzzle),
        pencil: false,
        selected: null,
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

    select(index) {
      const s = get();
      if (index !== null && (!s.puzzle || !s.puzzle.cells[index]?.fill)) return;
      set({ selected: index });
    },

    moveSelection(dRow, dCol) {
      const s = get();
      if (!s.puzzle) return;
      const size = s.puzzle.size;
      const from = s.selected ?? firstFillCell(s.puzzle);
      if (from === null) return;
      let r = Math.floor(from / size);
      let c = from % size;
      // Step in the requested direction until we land on another white cell.
      for (let k = 0; k < size; k++) {
        r += dRow;
        c += dCol;
        if (r < 0 || c < 0 || r >= size || c >= size) return;
        const i = r * size + c;
        if (s.puzzle.cells[i].fill) {
          set({ selected: i });
          return;
        }
      }
    },

    enterDigit(digit) {
      if (get().pencil) pencilIn(digit);
      else place(digit);
    },

    erase() {
      place(0);
    },

    togglePencil() {
      set((s) => ({ pencil: !s.pencil }));
    },

    undo() {
      const s = get();
      if (s.history.length === 0 || !s.puzzle) return;
      const prev = s.history[s.history.length - 1];
      set({
        digits: prev.digits,
        notes: prev.notes,
        history: s.history.slice(0, -1),
        future: [{ digits: s.digits, notes: s.notes }, ...s.future],
      });
      if (!s.solved && isWin(prev.digits, s.puzzle)) {
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
        digits: next.digits,
        notes: next.notes,
        history: [...s.history, { digits: s.digits, notes: s.notes }],
        future: s.future.slice(1),
      });
      if (!s.solved && isWin(next.digits, s.puzzle)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
    },

    clearMarks() {
      const s = get();
      if (!s.puzzle || s.review) return;
      set({
        digits: emptyDigits(s.puzzle),
        notes: emptyNotes(s.puzzle),
        history: [...s.history, { digits: s.digits, notes: s.notes }],
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
