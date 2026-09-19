import { describe, expect, it } from 'vitest';
import { mergeLocalIntoCloud, recordsToUpload } from './sync';
import type {
  PersistenceProvider,
  StoredGameRecord,
  StoredSavedGame,
  StoredSettings,
} from './types';

/** A minimal in-memory provider for exercising the merge without Firebase. */
function memoryProvider(): PersistenceProvider {
  const games = new Map<string, StoredGameRecord>();
  const saved = new Map<string, StoredSavedGame>();
  const settings = new Map<string, StoredSettings>();
  return {
    async putGameRecord(record) {
      games.set(record.id, record);
    },
    async getGameRecords(game) {
      return [...games.values()].filter((r) => r.game === game) as never;
    },
    async clearGameRecords(game) {
      for (const [id, r] of games) if (r.game === game) games.delete(id);
    },
    async putSavedGame(s) {
      saved.set(s.id, s);
    },
    async getSavedGame(game) {
      return saved.get(game) as never;
    },
    async clearSavedGame(game) {
      saved.delete(game);
    },
    async getSettings(id = 'settings') {
      return settings.get(id) as never;
    },
    async putSettings(s) {
      settings.set(s.id, s);
    },
  };
}

describe('recordsToUpload', () => {
  it('returns local records missing from the cloud', () => {
    const local = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const cloud = [{ id: 'b' }];
    expect(recordsToUpload(local, cloud).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('returns nothing when the cloud already has everything', () => {
    const local = [{ id: 'a' }];
    const cloud = [{ id: 'a' }, { id: 'z' }];
    expect(recordsToUpload(local, cloud)).toEqual([]);
  });
});

describe('mergeLocalIntoCloud', () => {
  it('uploads local records the cloud lacks, unioning by id', async () => {
    const local = memoryProvider();
    const cloud = memoryProvider();
    await local.putGameRecord({ id: 'l1', game: 'shikaku' });
    await local.putGameRecord({ id: 'shared', game: 'shikaku' });
    await cloud.putGameRecord({ id: 'shared', game: 'shikaku' });
    await cloud.putGameRecord({ id: 'c1', game: 'shikaku' });

    await mergeLocalIntoCloud(local, cloud, ['shikaku']);

    const merged = await cloud.getGameRecords('shikaku');
    expect(merged.map((r) => r.id).sort()).toEqual(['c1', 'l1', 'shared']);
  });

  it('keeps records separate per game', async () => {
    const local = memoryProvider();
    const cloud = memoryProvider();
    await local.putGameRecord({ id: 's1', game: 'shikaku' });
    await local.putGameRecord({ id: 'b1', game: 'battleships' });

    await mergeLocalIntoCloud(local, cloud, ['shikaku', 'battleships']);

    expect((await cloud.getGameRecords('shikaku')).map((r) => r.id)).toEqual(['s1']);
    expect((await cloud.getGameRecords('battleships')).map((r) => r.id)).toEqual(['b1']);
  });

  it('seeds cloud settings only when the cloud has none', async () => {
    const local = memoryProvider();
    const cloud = memoryProvider();
    await local.putSettings({ id: 'settings', theme: 'dark' } as StoredSettings);
    await cloud.putSettings({ id: 'settings', theme: 'light' } as StoredSettings);

    await mergeLocalIntoCloud(local, cloud, []);

    // Existing cloud settings win (not overwritten by local).
    expect((await cloud.getSettings()) as unknown as { theme: string }).toMatchObject({
      theme: 'light',
    });
  });

  it('uploads local settings when the cloud has none', async () => {
    const local = memoryProvider();
    const cloud = memoryProvider();
    await local.putSettings({ id: 'settings', theme: 'dark' } as StoredSettings);

    await mergeLocalIntoCloud(local, cloud, []);

    expect((await cloud.getSettings()) as unknown as { theme: string }).toMatchObject({
      theme: 'dark',
    });
  });

  it('seeds an in-progress save only when the cloud lacks one', async () => {
    const local = memoryProvider();
    const cloud = memoryProvider();
    await local.putSavedGame({ id: 'shikaku', game: 'shikaku' });

    await mergeLocalIntoCloud(local, cloud, ['shikaku']);

    expect((await cloud.getSavedGame('shikaku'))?.id).toBe('shikaku');
  });
});
