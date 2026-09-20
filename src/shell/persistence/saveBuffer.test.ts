import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaveBuffer } from './saveBuffer';
import type { PersistenceProvider, StoredSavedGame } from './types';

function fakeProvider() {
  const writes: StoredSavedGame[] = [];
  const provider = {
    putSavedGame: vi.fn(async (saved: StoredSavedGame) => {
      writes.push(saved);
    }),
  } as unknown as PersistenceProvider;
  return { provider, writes };
}

describe('save buffer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes only the latest of several rapid saves', async () => {
    const { provider, writes } = fakeProvider();
    const buffer = createSaveBuffer(1000);
    buffer.put(provider, { id: 'g', n: 1 } as StoredSavedGame);
    vi.advanceTimersByTime(500);
    buffer.put(provider, { id: 'g', n: 2 } as StoredSavedGame);
    vi.advanceTimersByTime(500);
    expect(writes).toHaveLength(0); // the timer restarted with the second save
    await vi.advanceTimersByTimeAsync(600);
    expect(writes).toEqual([{ id: 'g', n: 2 }]);
  });

  it('exposes a queued save until it has been written', async () => {
    const { provider } = fakeProvider();
    const buffer = createSaveBuffer(1000);
    buffer.put(provider, { id: 'g', n: 1 } as StoredSavedGame);
    expect(buffer.peek(provider, 'g')).toEqual({ id: 'g', n: 1 });
    expect(buffer.peek(fakeProvider().provider, 'g')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1000);
    expect(buffer.peek(provider, 'g')).toBeUndefined();
  });

  it('flushes immediately and keeps games separate', async () => {
    const { provider, writes } = fakeProvider();
    const buffer = createSaveBuffer(60_000);
    buffer.put(provider, { id: 'a' });
    buffer.put(provider, { id: 'b' });
    await buffer.flush();
    expect(writes.map((w) => w.id).sort()).toEqual(['a', 'b']);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(writes).toHaveLength(2); // nothing is written twice
  });

  it('drops a discarded save', async () => {
    const { provider, writes } = fakeProvider();
    const buffer = createSaveBuffer(1000);
    buffer.put(provider, { id: 'g' });
    buffer.discard('g');
    await vi.advanceTimersByTimeAsync(2000);
    await buffer.flush();
    expect(writes).toHaveLength(0);
  });
});
