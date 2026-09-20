import { describe, expect, it } from 'vitest';
import { clearNote, noteDigits, toggleNote } from './notes';

describe('kakuro notes', () => {
  it('starts empty', () => {
    expect(noteDigits(0)).toEqual([]);
  });

  it('toggles digits on and off', () => {
    let mask = toggleNote(0, 3);
    mask = toggleNote(mask, 9);
    mask = toggleNote(mask, 1);
    expect(noteDigits(mask)).toEqual([1, 3, 9]);
    mask = toggleNote(mask, 3);
    expect(noteDigits(mask)).toEqual([1, 9]);
  });

  it('returns to an empty mask when every mark is removed', () => {
    expect(toggleNote(toggleNote(0, 5), 5)).toBe(0);
  });

  it('removes a single digit without disturbing the others', () => {
    const mask = toggleNote(toggleNote(toggleNote(0, 2), 5), 8);
    expect(noteDigits(clearNote(mask, 5))).toEqual([2, 8]);
    expect(clearNote(mask, 7)).toBe(mask);
  });
});
