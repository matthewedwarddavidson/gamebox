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

interface ShellState {
  activeGameId: string | null;
  openGame: (id: string) => void;
  goHome: () => void;
}

export const useShell = create<ShellState>((set) => ({
  activeGameId: loadActiveGame(),
  openGame: (id) => {
    saveActiveGame(id);
    set({ activeGameId: id });
  },
  goHome: () => {
    saveActiveGame(null);
    set({ activeGameId: null });
  },
}));
