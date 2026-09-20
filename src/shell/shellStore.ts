// Shell store: tracks which game is active (null = the hub / game picker).
// The active game is persisted to localStorage so a refresh resumes into the
// same game (letting that game restore its own in-progress state).
import { create } from 'zustand';

const STORAGE_KEY = 'shell:activeGame';

function loadActiveGame(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveActiveGame(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures (private mode, disabled, etc.).
  }
}

/** What the shell shows when no game is open. */
export type ShellView = 'hub' | 'stats';

interface ShellState {
  activeGameId: string | null;
  view: ShellView;
  openGame: (id: string) => void;
  openStats: () => void;
  goHome: () => void;
}

export const useShell = create<ShellState>((set) => ({
  activeGameId: loadActiveGame(),
  view: 'hub',
  openGame: (id) => {
    saveActiveGame(id);
    set({ activeGameId: id, view: 'hub' });
  },
  openStats: () => {
    saveActiveGame(null);
    set({ activeGameId: null, view: 'stats' });
  },
  goHome: () => {
    saveActiveGame(null);
    set({ activeGameId: null, view: 'hub' });
  },
}));
