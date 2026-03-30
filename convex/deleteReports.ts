import { mutation } from './_generated/server';

// Delete all reports for the current user (demo mode - uses first user)
export const deleteMyReports = mutation({
  handler: async (ctx) => {
    // Get current user (demo - just get first user)
    const users = await ctx.db.query('users').collect();
    if (users.length === 0) {
      throw new Error('No users found');
    }
    const user = users[0];

    // Delete all reports for this user
    const reports = await ctx.db
      .query('reports')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    for (const report of reports) {
      await ctx.db.delete(report._id);
    }

    return { message: `Deleted ${reports.length} reports`, count: reports.length };
  },
});
