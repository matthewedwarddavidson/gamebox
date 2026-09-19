// CloudProvider: a Firestore-backed persistence backend, scoped to a single
// signed-in user. All data lives under `users/{uid}/…` so Firestore security
// rules can restrict access to the owning user. Implements the same
// `PersistenceProvider` interface as the local backend, so games are unaware of
// which one is active.
//
// The legacy query options (`includeUntagged`, `legacyId`) are local-only
// migration concerns and have no meaning in the cloud, so they are ignored.

import { getFirebaseDb } from './firebase';
import type {
  PersistenceProvider,
  StoredGameRecord,
  StoredSavedGame,
  StoredSettings,
} from './types';

const GAMES = 'games';
const SAVED = 'saved';
const SETTINGS = 'settings';

export async function createCloudProvider(uid: string): Promise<PersistenceProvider> {
  // Load the Firestore SDK and database handle on demand so this code splits
  // into a separate chunk that guests never download.
  const [{ collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch }, db] =
    await Promise.all([import('firebase/firestore'), getFirebaseDb()]);
  const userPath = (sub: string) => `users/${uid}/${sub}`;

  return {
    // --- Games ------------------------------------------------------------
    async putGameRecord<T extends StoredGameRecord>(record: T): Promise<void> {
      await setDoc(doc(db, userPath(GAMES), record.id), record);
    },

    async getGameRecords<T extends StoredGameRecord>(game: string): Promise<T[]> {
      const q = query(collection(db, userPath(GAMES)), where('game', '==', game));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as T);
    },

    async clearGameRecords(game: string): Promise<void> {
      const q = query(collection(db, userPath(GAMES)), where('game', '==', game));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    },

    // --- Saved (in-progress) game -----------------------------------------
    async putSavedGame<T extends StoredSavedGame>(saved: T): Promise<void> {
      await setDoc(doc(db, userPath(SAVED), saved.id), saved);
    },

    async getSavedGame<T extends StoredSavedGame>(game: string): Promise<T | undefined> {
      const snap = await getDoc(doc(db, userPath(SAVED), game));
      return snap.exists() ? (snap.data() as T) : undefined;
    },

    async clearSavedGame(game: string): Promise<void> {
      await deleteDoc(doc(db, userPath(SAVED), game));
    },

    // --- Settings ---------------------------------------------------------
    async getSettings<T extends StoredSettings>(id = 'settings'): Promise<T | undefined> {
      const snap = await getDoc(doc(db, userPath(SETTINGS), id));
      return snap.exists() ? (snap.data() as T) : undefined;
    },

    async putSettings<T extends StoredSettings>(settings: T): Promise<void> {
      await setDoc(doc(db, userPath(SETTINGS), settings.id), settings);
    },
  };
}
