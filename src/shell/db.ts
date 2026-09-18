// Shared persistence layer for all games (via idb), with a graceful in-memory
// fallback when IndexedDB is unavailable (e.g. some test/SSR environments).
//
// Records are namespaced by `game` so each game's history, saved progress and
// stats stay separate. The shell is game-agnostic: it never hardcodes a game
// id. A game that owns pre-existing (untagged) data can claim it explicitly
// via the `includeUntagged` / `legacyId` options.

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'inboxes';
const DB_VERSION = 1;

const STORE_GAMES = 'games';
const STORE_SAVED = 'saved';
const STORE_SETTINGS = 'settings';

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

interface Schema {
  [STORE_GAMES]: StoredGameRecord;
  [STORE_SAVED]: StoredSavedGame;
  [STORE_SETTINGS]: StoredSettings;
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getDb(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_GAMES)) {
          db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SAVED)) {
          db.createObjectStore(STORE_SAVED, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// --- In-memory fallback ---------------------------------------------------
const mem = {
  games: new Map<string, StoredGameRecord>(),
  saved: new Map<string, StoredSavedGame>(),
  settings: new Map<string, StoredSettings>(),
};

interface GameQuery {
  /** Also claim legacy records that predate the `game` field. */
  includeUntagged?: boolean;
}

function matchesGame(record: StoredGameRecord, game: string, includeUntagged: boolean): boolean {
  if (record.game === game) return true;
  return includeUntagged && record.game === undefined;
}

// --- Games ----------------------------------------------------------------
export async function putGameRecord<T extends StoredGameRecord>(record: T): Promise<void> {
  if (!hasIndexedDB()) {
    mem.games.set(record.id, record);
    return;
  }
  const db = await getDb();
  await db.put(STORE_GAMES, record);
}

export async function getGameRecords<T extends StoredGameRecord>(
  game: string,
  query: GameQuery = {},
): Promise<T[]> {
  const all = hasIndexedDB()
    ? await (await getDb()).getAll(STORE_GAMES)
    : [...mem.games.values()];
  return all.filter((r) => matchesGame(r, game, query.includeUntagged ?? false)) as T[];
}

export async function clearGameRecords(game: string, query: GameQuery = {}): Promise<void> {
  const includeUntagged = query.includeUntagged ?? false;
  if (!hasIndexedDB()) {
    for (const [id, r] of mem.games) {
      if (matchesGame(r, game, includeUntagged)) mem.games.delete(id);
    }
    return;
  }
  const db = await getDb();
  const all = await db.getAll(STORE_GAMES);
  const tx = db.transaction(STORE_GAMES, 'readwrite');
  for (const r of all) {
    if (matchesGame(r, game, includeUntagged)) await tx.store.delete(r.id);
  }
  await tx.done;
}

interface SavedQuery {
  /** A legacy key to fall back to when no record exists at the game's key. */
  legacyId?: string;
}

// --- Saved (in-progress) game --------------------------------------------
export async function putSavedGame<T extends StoredSavedGame>(saved: T): Promise<void> {
  if (!hasIndexedDB()) {
    mem.saved.set(saved.id, saved);
    return;
  }
  const db = await getDb();
  await db.put(STORE_SAVED, saved);
}

export async function getSavedGame<T extends StoredSavedGame>(
  game: string,
  query: SavedQuery = {},
): Promise<T | undefined> {
  const read = async (id: string): Promise<StoredSavedGame | undefined> =>
    hasIndexedDB() ? (await getDb()).get(STORE_SAVED, id) : mem.saved.get(id);
  const current = await read(game);
  if (current) return current as T;
  if (query.legacyId) return (await read(query.legacyId)) as T | undefined;
  return undefined;
}

export async function clearSavedGame(game: string, query: SavedQuery = {}): Promise<void> {
  const del = async (id: string): Promise<void> => {
    if (!hasIndexedDB()) {
      mem.saved.delete(id);
      return;
    }
    await (await getDb()).delete(STORE_SAVED, id);
  };
  await del(game);
  if (query.legacyId) await del(query.legacyId);
}

// --- Settings -------------------------------------------------------------
export async function getSettings<T extends StoredSettings>(
  id = 'settings',
): Promise<T | undefined> {
  if (!hasIndexedDB()) return mem.settings.get(id) as T | undefined;
  const db = await getDb();
  return (await db.get(STORE_SETTINGS, id)) as T | undefined;
}

export async function putSettings<T extends StoredSettings>(settings: T): Promise<void> {
  if (!hasIndexedDB()) {
    mem.settings.set(settings.id, settings);
    return;
  }
  const db = await getDb();
  await db.put(STORE_SETTINGS, settings);
}
