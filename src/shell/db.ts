// Public persistence API used by every game. This module is a thin delegating
// layer over a pluggable `PersistenceProvider`: games call these functions and
// never know whether data is stored locally (guest) or in the cloud (signed
// in). The active provider defaults to local and can be swapped at runtime via
// `setActiveProvider` (e.g. by the auth layer on sign-in / sign-out).

import { localProvider } from './persistence/localProvider';
import type {
  GameQuery,
  PersistenceProvider,
  SavedQuery,
  StoredGameRecord,
  StoredSavedGame,
  StoredSettings,
} from './persistence/types';

export type {
  GameQuery,
  PersistenceProvider,
  SavedQuery,
  StoredGameRecord,
  StoredSavedGame,
  StoredSettings,
} from './persistence/types';

/** The always-available, guest-facing local backend. */
export { localProvider } from './persistence/localProvider';

let activeProvider: PersistenceProvider = localProvider;

type ProviderListener = () => void;
const providerListeners = new Set<ProviderListener>();

/** Swap the backend all persistence calls delegate to (e.g. on sign-in). */
export function setActiveProvider(provider: PersistenceProvider): void {
  if (provider === activeProvider) return;
  activeProvider = provider;
  providerListeners.forEach((l) => l());
}

/** The backend persistence currently delegates to. */
export function getActiveProvider(): PersistenceProvider {
  return activeProvider;
}

/**
 * Subscribe to backend swaps (sign-in / sign-out). Callers use this to reload
 * data from the newly-active provider. Returns an unsubscribe function.
 */
export function onProviderChange(listener: ProviderListener): () => void {
  providerListeners.add(listener);
  return () => providerListeners.delete(listener);
}

// --- Games ----------------------------------------------------------------
export function putGameRecord<T extends StoredGameRecord>(record: T): Promise<void> {
  return activeProvider.putGameRecord(record);
}

export function getGameRecords<T extends StoredGameRecord>(
  game: string,
  query?: GameQuery,
): Promise<T[]> {
  return activeProvider.getGameRecords<T>(game, query);
}

export function clearGameRecords(game: string, query?: GameQuery): Promise<void> {
  return activeProvider.clearGameRecords(game, query);
}

// --- Saved (in-progress) game --------------------------------------------
export function putSavedGame<T extends StoredSavedGame>(saved: T): Promise<void> {
  return activeProvider.putSavedGame(saved);
}

export function getSavedGame<T extends StoredSavedGame>(
  game: string,
  query?: SavedQuery,
): Promise<T | undefined> {
  return activeProvider.getSavedGame<T>(game, query);
}

export function clearSavedGame(game: string, query?: SavedQuery): Promise<void> {
  return activeProvider.clearSavedGame(game, query);
}

// --- Settings -------------------------------------------------------------
export function getSettings<T extends StoredSettings>(id?: string): Promise<T | undefined> {
  return activeProvider.getSettings<T>(id);
}

export function putSettings<T extends StoredSettings>(settings: T): Promise<void> {
  return activeProvider.putSettings(settings);
}
