// Pencil marks for Kakuro. Each cell's candidate digits are held in a bitmask:
// bit `d` set means digit `d` is pencilled in. Pure helpers.

/** Toggle digit `d` in a note mask. */
export function toggleNote(mask: number, d: number): number {
  return mask ^ (1 << d);
}

/** A note mask with digit `d` removed. */
export function clearNote(mask: number, d: number): number {
  return mask & ~(1 << d);
}

/** The pencilled-in digits of a note mask, in ascending order. */
export function noteDigits(mask: number): number[] {
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) digits.push(d);
  return digits;
}
