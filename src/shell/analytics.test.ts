import { afterEach, describe, expect, it, vi } from 'vitest';
import { toFirestoreFields, trackGameStarted, trackVisit } from './analytics';

describe('toFirestoreFields', () => {
  it('maps primitive types to Firestore value shapes and drops undefined', () => {
    expect(
      toFirestoreFields({ a: 'x', b: 3, c: true, d: 1.5, e: undefined }),
    ).toEqual({
      a: { stringValue: 'x' },
      b: { integerValue: '3' },
      c: { booleanValue: true },
      d: { doubleValue: 1.5 },
    });
  });
});

describe('analytics is a no-op when unconfigured', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not call fetch for game events', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    trackGameStarted({ game: 'shikaku', mode: 'free', difficulty: 'easy' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not call fetch for visits', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    trackVisit();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
