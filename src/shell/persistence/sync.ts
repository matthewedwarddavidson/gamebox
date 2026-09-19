// One-time migration of a guest's local data into their cloud account on first
// sign-in. The strategy is auto-merge: game records are unioned by id so no
// history is ever lost, and settings / in-progress saves seed the cloud only
// when it has none (an existing account's choices win).

import type { PersistenceProvider, StoredGameRecord } from './types';

/**
 * Records present locally but missing from the cloud — the set that needs
 * uploading to union the two by id. Pure and unit-tested.
 */
export function recordsToUpload<T extends StoredGameRecord>(local: T[], cloud: T[]): T[] {
  const cloudIds = new Set(cloud.map((r) => r.id));
  return local.filter((r) => !cloudIds.has(r.id));
}

/**
 * Merge a guest's local data into the cloud. For each game, uploads any local
 * game records the cloud lacks (union by id). Seeds the cloud's settings and
 * in-progress save only when it has none, so a returning user's existing
 * account data is never clobbered.
 */
export async function mergeLocalIntoCloud(
  local: PersistenceProvider,
  cloud: PersistenceProvider,
  gameIds: string[],
): Promise<void> {
  for (const game of gameIds) {
    const [localRecords, cloudRecords] = await Promise.all([
      local.getGameRecords(game),
      cloud.getGameRecords(game),
    ]);
    const toUpload = recordsToUpload(localRecords, cloudRecords);
    await Promise.all(toUpload.map((r) => cloud.putGameRecord(r)));

    // Seed an in-progress save only if the cloud has none for this game.
    const cloudSaved = await cloud.getSavedGame(game);
    if (!cloudSaved) {
      const localSaved = await local.getSavedGame(game);
      if (localSaved) await cloud.putSavedGame(localSaved);
    }
  }

  // Seed settings only if the cloud has none.
  const cloudSettings = await cloud.getSettings();
  if (!cloudSettings) {
    const localSettings = await local.getSettings();
    if (localSettings) await cloud.putSettings(localSettings);
  }
}
