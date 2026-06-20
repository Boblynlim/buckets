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
