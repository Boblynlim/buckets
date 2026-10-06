import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// One-off: correct spends after checking them against bank statements.
// Adds what the app never recorded and removes duplicates. The figures are
// passed in at run time (from statements kept outside the repo). dryRun first.

export const run = internalMutation({
  args: {
    userId: v.id("users"),
    dryRun: v.boolean(),
    add: v.array(v.object({ cup: v.string(), amount: v.number(), date: v.string(), note: v.string() })),
    remove: v.array(v.id("expenses")),
  },
  handler: async (ctx, { userId, dryRun, add, remove }) => {
    const log: string[] = [];
    const buckets = await ctx.db.query("buckets").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    for (const a of add) {
      const cup = buckets.find((b) => b.name === a.cup && b.isActive);
      if (!cup) throw new Error(`No cup "${a.cup}"`);
      // Noon SGT on that day, so it lands in the right month.
      const date = Date.parse(`${a.date}T12:00:00+08:00`);
      log.push(`add ${a.date} $${a.amount} ${a.cup}: ${a.note}`);
      if (!dryRun) {
        await ctx.db.insert("expenses", { userId, bucketId: cup._id, amount: a.amount, date, note: a.note, worthIt: false, createdAt: Date.now(), updatedAt: Date.now() });
      }
    }
    for (const id of remove) {
      const e = await ctx.db.get(id);
      if (!e || e.userId !== userId) throw new Error(`No spend ${id}`);
      const cup = buckets.find((b) => b._id === e.bucketId);
      log.push(`remove ${new Date(e.date + 8 * 3600 * 1000).toISOString().slice(0, 10)} $${e.amount} ${cup?.name}: ${e.note}`);
      if (!dryRun) await ctx.db.delete(id);
    }
    return { dryRun, changes: log };
  },
});
