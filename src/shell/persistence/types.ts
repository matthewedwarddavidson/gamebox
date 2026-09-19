// Persistence abstraction shared by all games. The concrete storage backend is
// pluggable: a `LocalProvider` (IndexedDB) is used for guests, and a
// `CloudProvider` (Firestore) is swapped in when a user signs in. Games only
// ever talk to the delegating functions in `db.ts`, never to a provider
// directly.

/** Common shape every stored game record shares. */
export interface StoredGameRecord {
  id: string;
  game?: string;
}

/** Common shape every stored saved-game shares (keyed by game id). */
export interface StoredSavedGame {
  id: string;
  game?: string;
}

/** Common shape every stored settings blob shares. */
export interface StoredSettings {
  id: string;
}

export interface GameQuery {
  /** Also claim legacy records that predate the `game` field. */
  includeUntagged?: boolean;
}

export interface SavedQuery {
  /** A legacy key to fall back to when no record exists at the game's key. */
  legacyId?: string;
}

/** A pluggable storage backend. All methods are game-scoped by convention. */
export interface PersistenceProvider {
  putGameRecord<T extends StoredGameRecord>(record: T): Promise<void>;
  getGameRecords<T extends StoredGameRecord>(game: string, query?: GameQuery): Promise<T[]>;
  clearGameRecords(game: string, query?: GameQuery): Promise<void>;

  putSavedGame<T extends StoredSavedGame>(saved: T): Promise<void>;
  getSavedGame<T extends StoredSavedGame>(game: string, query?: SavedQuery): Promise<T | undefined>;
  clearSavedGame(game: string, query?: SavedQuery): Promise<void>;

  getSettings<T extends StoredSettings>(id?: string): Promise<T | undefined>;
  putSettings<T extends StoredSettings>(settings: T): Promise<void>;
}
