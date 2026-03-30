// Run this with: npx convex run delete-reports:deleteMyReports
import { mutation } from "./_generated/server";

export const deleteMyReports = mutation({
  handler: async (ctx) => {
    // Get current user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Delete all reports
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const report of reports) {
      await ctx.db.delete(report._id);
    }

    return { message: `Deleted ${reports.length} reports` };
  },
});
