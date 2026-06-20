import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/**
 * Report Generation System
 * Generates weekly reflective and monthly strategic reports
 */

// Get reports by user
export const getByUser = query({
  args: {
    userId: v.id('users'),
    reportType: v.optional(v.union(v.literal('weekly'), v.literal('monthly'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('reports')
      .withIndex('by_user', (q) => q.eq('userId', args.userId));

    if (args.reportType) {
      query = ctx.db
        .query('reports')
        .withIndex('by_user_and_type', (q) =>
          q.eq('userId', args.userId).eq('reportType', args.reportType as 'weekly' | 'monthly')
        );
    }

    const reports = await query
      .order('desc')
      .take(args.limit || 10);

    return reports;
  },
});

// Delete a report
export const remove = mutation({
  args: {
    reportId: v.id('reports'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reportId);
  },
});
