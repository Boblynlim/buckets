/**
 * Recurring auto-pay sync — RETIRED.
 *
 * Recurring buckets are sinking funds now: the monthly allocation accumulates
 * and real (logged / bank-imported) payments draw it down. We no longer
 * synthesize an auto-pay expense equal to the allocation — it blocked
 * accumulation and collided with imported payments (duplicates).
 *
 * This mutation used to reconcile exactly one auto-pay per recurring bucket per
 * month. It's now a deliberate no-op: it creates nothing and — importantly —
 * deletes nothing, so all existing expense rows (including historical
 * auto-generated ones) are left exactly as they are. The many callers
 * (rollover, monthlyIncome mutations, app load) can keep calling it harmlessly.
 */

import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const syncRecurringExpensesForMonth = mutation({
  args: {
    userId: v.id('users'),
    month: v.string(), // "YYYY-MM"
  },
  handler: async (_ctx, args): Promise<{ month: string; diff: [] }> => {
    return { month: args.month, diff: [] };
  },
});
