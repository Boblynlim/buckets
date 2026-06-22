import type { Expense } from '../types';

// Two expenses are "likely duplicates" when they sit in the same bucket, share
// an amount, and fall within a few days of each other — e.g. a recurring
// bucket's monthly auto-pay plus a manually-logged copy of the same bill, or
// the same imported bank alert confirmed twice. A genuine monthly recurring
// charge appears once per month (well outside the window), so it isn't flagged.
export const DUP_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Ids of expenses that look like duplicates of another expense in the same set.
 * Every member of a same-amount/near-date cluster is included, so callers can
 * tag them all and let the user choose which to keep.
 *
 * Pass expenses for a SINGLE bucket (the caller scopes by bucket).
 */
export function findDuplicateExpenseIds(
  expenses: Pick<Expense, '_id' | 'amount' | 'date'>[],
  windowMs: number = DUP_WINDOW_MS,
): Set<string> {
  const dupes = new Set<string>();
  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i];
      const b = expenses[j];
      if (
        Math.abs(a.amount - b.amount) < 0.01 &&
        Math.abs(a.date - b.date) <= windowMs
      ) {
        dupes.add(a._id);
        dupes.add(b._id);
      }
    }
  }
  return dupes;
}
