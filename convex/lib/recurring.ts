/**
 * Pure helpers for computing recurring auto-pay amounts.
 *
 * No Convex APIs, no IO — every consumer (cron rollover, sync mutation, UI
 * preview, tests) calls the same function with the same inputs and gets the
 * same answer. When the calc rule changes, this is the one place to edit.
 */

export type RecurringBucketLike = {
  _id: string;
  bucketMode?: 'spend' | 'save' | 'recurring';
  allocationType?: 'amount' | 'percentage';
  plannedAmount?: number;
  plannedPercent?: number;
  isActive?: boolean;
};

export type ComputeReason =
  | 'paid'
  | 'no-plan'       // bucket is recurring but missing plannedAmount/plannedPercent
  | 'no-income'    // percentage-based with totalIncome === 0
  | 'wrong-mode'   // bucket is not 'recurring'
  | 'inactive';    // bucket.isActive === false

export type ComputeResult = {
  amount: number;
  reason: ComputeReason;
};

/**
 * Returns "YYYY-MM" for the given Date or timestamp. Local time, matching how
 * users see months in the UI.
 */
export function monthKey(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Local-time [start, end] timestamps for the calendar month containing `d`.
 * end is the last millisecond of the last day so range checks stay inclusive.
 */
export function monthRange(d: Date | number): { start: number; end: number } {
  const date = typeof d === 'number' ? new Date(d) : d;
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

/**
 * Sum of monthly plans across spend + recurring buckets. Used as the
 * denominator of the funding ratio.
 */
export function totalPlannedFor(
  buckets: RecurringBucketLike[],
  totalIncome: number,
): number {
  let sum = 0;
  for (const b of buckets) {
    if (b.isActive === false) continue;
    if (b.bucketMode !== 'spend' && b.bucketMode !== 'recurring') continue;
    if (b.allocationType === 'percentage' && b.plannedPercent !== undefined) {
      sum += (totalIncome * b.plannedPercent) / 100;
    } else if (b.allocationType === 'amount' && b.plannedAmount !== undefined) {
      sum += b.plannedAmount;
    }
  }
  return sum;
}

/**
 * Funding ratio applied when total plans (spend + recurring) overrun income.
 * Capped at 1 — extra income doesn't inflate plans.
 */
export function fundingRatioFor(totalIncome: number, totalPlanned: number): number {
  if (totalPlanned <= 0) return 1;
  if (totalPlanned <= totalIncome) return 1;
  return totalIncome / totalPlanned;
}

/**
 * Compute the auto-pay amount for a single recurring bucket, given the full
 * set of buckets to derive the funding ratio. Returns the amount plus the
 * reason it landed there so callers can surface "skipped" cases instead of
 * silently writing nothing.
 */
export function computeRecurringAmount(
  bucket: RecurringBucketLike,
  allBuckets: RecurringBucketLike[],
  totalIncome: number,
): ComputeResult {
  if (bucket.isActive === false) return { amount: 0, reason: 'inactive' };
  if (bucket.bucketMode !== 'recurring') return { amount: 0, reason: 'wrong-mode' };

  let base = 0;
  if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
    if (totalIncome <= 0) return { amount: 0, reason: 'no-income' };
    base = (totalIncome * bucket.plannedPercent) / 100;
  } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
    base = bucket.plannedAmount;
  } else {
    return { amount: 0, reason: 'no-plan' };
  }

  if (base <= 0) return { amount: 0, reason: 'no-plan' };

  // Amount-based bills with no income produce 0 via the funding ratio. That
  // collapses silently if we just return amount=0 — surface it explicitly
  // so the caller (and any debug UI) can distinguish "no income to draw
  // from" from "no plan configured."
  if (totalIncome <= 0) return { amount: 0, reason: 'no-income' };

  const planned = totalPlannedFor(allBuckets, totalIncome);
  const ratio = fundingRatioFor(totalIncome, planned);
  const amount = base * ratio;

  return { amount, reason: 'paid' };
}
