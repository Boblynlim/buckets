/**
 * One-time backfill: reconstruct `carryoverBalance` for recurring buckets.
 *
 * Background: before the recurring-overspend fix, the monthly rollover skipped
 * recurring buckets entirely — it only bumped `lastRolloverDate` and never
 * accumulated over/underspend into `carryoverBalance`. So a month where the
 * real bill exceeded the plan (e.g. an annual insurance payment landing in one
 * month) silently dropped its debt instead of carrying it forward, and the
 * bucket looked like it had excess.
 *
 * This recomputes the correct carryover purely from stored history:
 *
 *   carryover = Σ over completed months m of ( funding(m) − spent(m) )
 *
 *   funding(m) = computeRecurringAmount(bucket, allBuckets, income(m))
 *                — the same number the rollover/sync would have funded.
 *   spent(m)   = every expense (auto-pay + real) dated within month m.
 *
 * "Completed months" = the bucket's earliest expense month through the month
 * before the current one. The current month is left out because its funding
 * lives in `fundedAmount` and its spending is still in-flight — carryover only
 * holds the settled past.
 *
 * Caveat: funding(m) is derived with the buckets' CURRENT plans and the income
 * actually recorded for month m. If income was comfortably above total plans
 * every month (funding ratio = 1, the common case), this is exact. If plans
 * changed over time or a month was under-funded, the reconstruction is a close
 * approximation — which is why this runs as a DRY RUN by default and returns a
 * per-month breakdown so you can sanity-check before applying.
 *
 * Usage (Convex dashboard / CLI), single-user app:
 *   npx convex run backfillCarryover:backfillRecurringCarryover '{"userId":"<id>"}'
 *   → prints what it WOULD set, writes nothing.
 *   npx convex run backfillCarryover:backfillRecurringCarryover '{"userId":"<id>","apply":true}'
 *   → writes the new carryoverBalance values.
 *
 * Scope to one bucket with "bucketId": "<id>".
 */

import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { computeRecurringAmount, monthKey } from './lib/recurring';

type MonthLine = {
  month: string;
  income: number;
  funding: number;
  spent: number;
  net: number;
};

type BucketReport = {
  bucketId: string;
  bucketName: string;
  previousCarryover: number;
  computedCarryover: number;
  delta: number;
  completedMonths: number;
  months: MonthLine[];
  applied: boolean;
};

// Inclusive list of "YYYY-MM" keys from `start` up to but NOT including the
// month containing `endExclusive`.
function monthsBetween(startMs: number, endExclusiveMs: number): string[] {
  const out: string[] = [];
  const s = new Date(startMs);
  let y = s.getFullYear();
  let m = s.getMonth();
  const end = new Date(endExclusiveMs);
  const endY = end.getFullYear();
  const endM = end.getMonth();
  while (y < endY || (y === endY && m < endM)) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

export const backfillRecurringCarryover = internalMutation({
  args: {
    userId: v.id('users'),
    bucketId: v.optional(v.id('buckets')),
    apply: v.optional(v.boolean()), // default false → dry run
  },
  handler: async (ctx, args): Promise<{
    apply: boolean;
    bucketsConsidered: number;
    reports: BucketReport[];
  }> => {
    const apply = args.apply === true;

    const allBuckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();

    // First of the current month (local) — the boundary between settled past
    // (rolled into carryover) and the in-flight current month.
    const now = new Date();
    const currentMonthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    ).getTime();

    const targets = allBuckets.filter(
      b =>
        b.bucketMode === 'recurring' &&
        (args.bucketId ? b._id === args.bucketId : true),
    );

    // Income per month, memoised across buckets.
    const incomeCache = new Map<string, number>();
    const incomeFor = async (month: string): Promise<number> => {
      const cached = incomeCache.get(month);
      if (cached !== undefined) return cached;
      const entries = await ctx.db
        .query('monthlyIncome')
        .withIndex('by_user_month', q =>
          q.eq('userId', args.userId).eq('month', month),
        )
        .collect();
      const total = entries.reduce((s, e) => s + e.amount, 0);
      incomeCache.set(month, total);
      return total;
    };

    const reports: BucketReport[] = [];

    for (const bucket of targets) {
      const expenses = await ctx.db
        .query('expenses')
        .withIndex('by_bucket', q => q.eq('bucketId', bucket._id))
        .collect();

      // Bucket the (settled) expenses by month. Current-month and future
      // expenses are excluded from carryover by construction.
      const spentByMonth = new Map<string, number>();
      let earliest = Infinity;
      for (const e of expenses) {
        if (e.date >= currentMonthStart) continue;
        const key = monthKey(e.date);
        spentByMonth.set(key, (spentByMonth.get(key) || 0) + e.amount);
        if (e.date < earliest) earliest = e.date;
      }

      const months: MonthLine[] = [];
      let carryover = 0;

      if (earliest !== Infinity) {
        const monthKeys = monthsBetween(earliest, currentMonthStart);
        for (const month of monthKeys) {
          const income = await incomeFor(month);
          const funding = computeRecurringAmount(
            bucket as any,
            allBuckets as any,
            income,
          ).amount;
          const spent = spentByMonth.get(month) || 0;
          const net = funding - spent;
          carryover += net;
          // Only surface months with any activity to keep the report readable.
          if (funding !== 0 || spent !== 0) {
            months.push({ month, income, funding, spent, net });
          }
        }
      }

      carryover = Math.round(carryover * 100) / 100;
      const previousCarryover = bucket.carryoverBalance || 0;

      if (apply) {
        await ctx.db.patch(bucket._id, { carryoverBalance: carryover });
      }

      reports.push({
        bucketId: bucket._id,
        bucketName: bucket.name,
        previousCarryover,
        computedCarryover: carryover,
        delta: Math.round((carryover - previousCarryover) * 100) / 100,
        completedMonths: months.length,
        months,
        applied: apply,
      });
    }

    return {
      apply,
      bucketsConsidered: targets.length,
      reports,
    };
  },
});
