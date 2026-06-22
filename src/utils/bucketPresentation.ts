import type { Bucket, BucketMode, Expense } from '../types';

/**
 * One source of truth for "what kind of bucket → what copy do we show."
 *
 * Each bucket mode reads its money very differently, and hardcoding that at each
 * call site is how we ended up showing a recurring investment as "TOTAL SPENT …
 * $0 remaining" (it's accumulating, not spending). A presenter per mode keeps
 * the framing correct and in one place; add a mode → add a presenter.
 */

export type BucketDisplay = {
  /** Eyebrow label above the hero number, e.g. "TOTAL CONTRIBUTED". */
  label: string;
  /** The hero number. */
  amount: number;
  /** Line under the hero number, e.g. "$250.00 this month". */
  subtext: string;
  /** Smaller supporting line; '' to hide it. */
  allocationText: string;
};

export type BucketDisplayContext = {
  /** All expenses for THIS bucket (any month). */
  expenses: Pick<Expense, 'amount' | 'date'>[];
  /** Inclusive bounds of the month being viewed. */
  monthStart: number;
  monthEnd: number;
};

const money = (n: number) => `$${n.toFixed(2)}`;

const sumInMonth = (ctx: BucketDisplayContext) =>
  ctx.expenses
    .filter((e) => e.date >= ctx.monthStart && e.date <= ctx.monthEnd)
    .reduce((s, e) => s + e.amount, 0);

const sumAll = (ctx: BucketDisplayContext) =>
  ctx.expenses.reduce((s, e) => s + e.amount, 0);

type Presenter = (bucket: Bucket, ctx: BucketDisplayContext) => BucketDisplay;

const PRESENTERS: Record<BucketMode, Presenter> = {
  // Money you're building up toward a goal — show the balance, not spending.
  save: (bucket) => {
    const currentBalance = bucket.currentBalance || 0;
    const targetAmount = bucket.targetAmount || 0;
    let allocationText = '';
    if (bucket.contributionType && bucket.contributionType !== 'none') {
      const contribution =
        bucket.contributionType === 'amount'
          ? money(bucket.contributionAmount || 0)
          : `${bucket.contributionPercent || 0}% of income`;
      allocationText = `Monthly contribution: ${contribution}`;
    }
    return {
      label: 'CURRENT SAVINGS',
      amount: currentBalance,
      subtext: `${money(currentBalance)} saved of ${money(targetAmount)}`,
      allocationText,
    };
  },

  // Bills / investments / fixed contributions — money goes out (or in) on a
  // schedule and accumulates. Frame as a running total, never "$0 remaining".
  recurring: (bucket, ctx) => {
    const thisMonth = sumInMonth(ctx);
    const allTime = sumAll(ctx);
    const planned = bucket.plannedAmount ?? bucket.fundedAmount ?? 0;
    return {
      label: 'TOTAL CONTRIBUTED',
      amount: allTime,
      subtext: `${money(thisMonth)} this month`,
      allocationText: planned ? `Monthly: ${money(planned)}` : '',
    };
  },

  // Discretionary spending against a monthly allocation (plus any carryover).
  spend: (bucket, ctx) => {
    const totalSpent = sumInMonth(ctx);
    const allocated = bucket.fundedAmount || 0;
    const carryover = bucket.carryoverBalance || 0;
    const totalAvailable = allocated + carryover;
    return {
      label: 'TOTAL SPENT',
      amount: totalSpent,
      subtext: `${money(totalAvailable - totalSpent)} remaining of ${money(totalAvailable)}`,
      allocationText: `Allocated this month: ${money(allocated)}`,
    };
  },
};

/**
 * Resolve the display copy for a bucket. Falls back to the 'spend' presenter for
 * a missing/unknown mode (legacy rows), so the header never renders blank.
 */
export function getBucketDisplay(
  bucket: Bucket,
  ctx: BucketDisplayContext,
): BucketDisplay {
  const presenter = PRESENTERS[bucket.bucketMode as BucketMode] ?? PRESENTERS.spend;
  return presenter(bucket, ctx);
}
