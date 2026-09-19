import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveProvider,
  localProvider,
  onProviderChange,
  putGameRecord,
  setActiveProvider,
} from '../db';
import type { PersistenceProvider } from './types';

/** A fully-mocked provider so we can assert delegation without any storage. */
function fakeProvider(): PersistenceProvider {
  return {
    putGameRecord: vi.fn(async () => {}),
    getGameRecords: vi.fn(async () => []),
    clearGameRecords: vi.fn(async () => {}),
    putSavedGame: vi.fn(async () => {}),
    getSavedGame: vi.fn(async () => undefined),
    clearSavedGame: vi.fn(async () => {}),
    getSettings: vi.fn(async () => undefined),
    putSettings: vi.fn(async () => {}),
  };
}

// Always restore the default backend so other suites aren't affected.
afterEach(() => setActiveProvider(localProvider));

describe('provider delegation', () => {
  it('delegates calls to the active provider', async () => {
    const provider = fakeProvider();
    setActiveProvider(provider);
    expect(getActiveProvider()).toBe(provider);

    await putGameRecord({ id: 'x', game: 'shikaku' });
    expect(provider.putGameRecord).toHaveBeenCalledWith({ id: 'x', game: 'shikaku' });
  });

  it('notifies listeners when the backend swaps, once per change', () => {
    const listener = vi.fn();
    const unsubscribe = onProviderChange(listener);

    const provider = fakeProvider();
    setActiveProvider(provider);
    expect(listener).toHaveBeenCalledTimes(1);

    // Re-setting the same provider is a no-op and fires nothing.
    setActiveProvider(provider);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setActiveProvider(localProvider);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
