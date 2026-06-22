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
 * Pass expenses for a SINGLE bucket (the caller scopes by bucket). `dismissed`
 * holds ids the user marked "not a duplicate" — a pair is skipped entirely if
 * either member was dismissed, so confirming one row as fine clears its pill
 * (and its partner's, since they no longer have an active match).
 */
export function findDuplicateExpenseIds(
  expenses: Pick<Expense, '_id' | 'amount' | 'date'>[],
  opts: { windowMs?: number; dismissed?: Set<string> } = {},
): Set<string> {
  const windowMs = opts.windowMs ?? DUP_WINDOW_MS;
  const dismissed = opts.dismissed;
  const dupes = new Set<string>();
  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i];
      const b = expenses[j];
      if (dismissed && (dismissed.has(a._id) || dismissed.has(b._id))) continue;
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

// "Not a duplicate" dismissals, persisted locally (mirrors the dismissed-
// insights pattern). Keyed by expense id; an id here is never flagged.
const DISMISS_KEY = 'buckets_dismissed_duplicates';

export function getDismissedDuplicates(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function dismissDuplicate(expenseId: string): void {
  try {
    const s = getDismissedDuplicates();
    s.add(expenseId);
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s]));
  } catch {
    // ignore storage failures — flag just stays visible
  }
}
