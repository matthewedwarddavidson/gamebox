// Coalesces rapid in-progress saves. Games save after every move, which is
// free for local storage but costs a billable write per move against a cloud
// backend. The buffer keeps only the latest save per game and writes it once
// the player pauses (or when flushed, e.g. as the tab is hidden).

import type { PersistenceProvider, StoredSavedGame } from './types';

interface Pending {
  saved: StoredSavedGame;
  provider: PersistenceProvider;
  timer: ReturnType<typeof setTimeout>;
}

export interface SaveBuffer {
  /** Queue a save, replacing any earlier one for the same game. */
  put(provider: PersistenceProvider, saved: StoredSavedGame): void;
  /** The queued (not yet written) save for `id` on `provider`, if any. */
  peek<T extends StoredSavedGame>(provider: PersistenceProvider, id: string): T | undefined;
  /** Drop a queued save without writing it (the game is being cleared). */
  discard(id: string): void;
  /** Write every queued save now. */
  flush(): Promise<void>;
}

export function createSaveBuffer(delayMs: number): SaveBuffer {
  const pending = new Map<string, Pending>();

  async function write(id: string): Promise<void> {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
    await entry.provider.putSavedGame(entry.saved);
  }

  return {
    put(provider, saved) {
      const existing = pending.get(saved.id);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => void write(saved.id), delayMs);
      pending.set(saved.id, { saved, provider, timer });
    },
    peek<T extends StoredSavedGame>(provider: PersistenceProvider, id: string) {
      const entry = pending.get(id);
      return entry && entry.provider === provider ? (entry.saved as T) : undefined;
    },
    discard(id) {
      const entry = pending.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(id);
    },
    async flush() {
      await Promise.all([...pending.keys()].map(write));
    },
  };
}
