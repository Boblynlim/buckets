import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Analytics queries for spending totals
 *
 * IMPORTANT: All spending calculations MUST be derived from the transactions table.
 * Do NOT use bucket balances or stored aggregates as the source of truth.
 */

/**
 * Get monthly total spent
 *
 * Definition: Sum of all expense transactions in spend buckets for the selected month
 *
 * Source of Truth: transactions table (expenses)
 * Filters:
 * - transaction type = expense
 * - bucket mode = spend
 * - transaction date within selected month
 */
export const getMonthlyTotalSpent = query({
  args: {
    userId: v.id('users'),
    monthStart: v.number(), // timestamp for start of month (inclusive)
    monthEnd: v.number(),   // timestamp for end of month (inclusive)
  },
  handler: async (ctx, args) => {
    // Get all expenses for the user in the selected month
    const allExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    // Filter by date range
    const monthExpenses = allExpenses.filter(
      expense => expense.date >= args.monthStart && expense.date <= args.monthEnd
    );

    // Get all buckets to filter by bucket mode
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    // Create a map of bucket ID to bucket mode
    const bucketModeMap = new Map(
      buckets.map(b => [b._id, b.bucketMode || 'spend']) // Default to 'spend' for legacy buckets
    );

    // Filter to only expenses in spend buckets
    const spendBucketExpenses = monthExpenses.filter(
      expense => bucketModeMap.get(expense.bucketId) === 'spend'
    );

    // Sum the amounts - this is the source of truth for monthly total spent
    const totalSpent = spendBucketExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    return {
      totalSpent,
      transactionCount: spendBucketExpenses.length,
      monthStart: args.monthStart,
      monthEnd: args.monthEnd,
    };
  },
});

/**
 * Get spending by bucket for a month
 *
 * Returns the spent amount per bucket, derived from transactions
 */
export const getMonthlySpendingByBucket = query({
  args: {
    userId: v.id('users'),
    monthStart: v.number(),
    monthEnd: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all expenses for the user in the selected month
    const allExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    // Filter by date range
    const monthExpenses = allExpenses.filter(
      expense => expense.date >= args.monthStart && expense.date <= args.monthEnd
    );

    // Get all buckets
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();

    // Group expenses by bucket
    const spendingByBucket = buckets.map(bucket => {
      const bucketExpenses = monthExpenses.filter(e => e.bucketId === bucket._id);
      const spent = bucketExpenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        bucketId: bucket._id,
        bucketName: bucket.name,
        bucketMode: bucket.bucketMode || 'spend',
        spent,
        transactionCount: bucketExpenses.length,
      };
    });

    return spendingByBucket;
  },
});

/**
 * Get spending trends over time
 *
 * Returns monthly spending totals for the last N months
 */
export const getSpendingTrends = query({
  args: {
    userId: v.id('users'),
    months: v.number(), // Number of months to look back
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const trends: Array<{
      monthStart: number;
      monthEnd: number;
      totalSpent: number;
      transactionCount: number;
    }> = [];

    // Get all expenses (we'll filter by date)
    const allExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    // Get all buckets for filtering
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const bucketModeMap = new Map(
      buckets.map(b => [b._id, b.bucketMode || 'spend'])
    );

    // For each month, calculate totals
    for (let i = 0; i < args.months; i++) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      monthDate.setDate(1);
      monthDate.setHours(0, 0, 0, 0);
      const monthStart = monthDate.getTime();

      const nextMonth = new Date(monthDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = nextMonth.getTime() - 1;

      // Filter expenses for this month
      const monthExpenses = allExpenses.filter(
        e => e.date >= monthStart && e.date <= monthEnd &&
             bucketModeMap.get(e.bucketId) === 'spend'
      );

      const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

      trends.unshift({
        monthStart,
        monthEnd,
        totalSpent,
        transactionCount: monthExpenses.length,
      });
    }

    return trends;
  },
});
