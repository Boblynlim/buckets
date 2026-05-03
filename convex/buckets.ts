import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Create a new bucket
export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    bucketMode: v.union(v.literal("spend"), v.literal("save"), v.literal("recurring")),

    // For spend buckets
    allocationType: v.optional(v.union(v.literal("amount"), v.literal("percentage"))),
    plannedAmount: v.optional(v.number()),
    plannedPercent: v.optional(v.number()),

    // For save buckets
    targetAmount: v.optional(v.number()),
    contributionType: v.optional(v.union(v.literal("amount"), v.literal("percentage"), v.literal("none"))),
    contributionAmount: v.optional(v.number()),
    contributionPercent: v.optional(v.number()),
    goalAlerts: v.optional(v.array(v.number())),
    reminderDays: v.optional(v.number()),
    notifyOnComplete: v.optional(v.boolean()),
    capBehavior: v.optional(v.union(
      v.literal("stop"),
      v.literal("unallocated"),
      v.literal("bucket"),
      v.literal("proportional")
    )),
    capRerouteBucketId: v.optional(v.id("buckets")),

    // Shared
    alertThreshold: v.number(),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bucketId = await ctx.db.insert("buckets", {
      userId: args.userId,
      name: args.name,
      bucketMode: args.bucketMode,
      allocationType: args.allocationType,
      plannedAmount: args.plannedAmount,
      plannedPercent: args.plannedPercent,
      fundedAmount: 0,
      carryoverBalance: 0,
      lastRolloverDate: Date.now(),
      targetAmount: args.targetAmount,
      currentBalance: 0,
      contributionType: args.contributionType,
      contributionAmount: args.contributionAmount,
      contributionPercent: args.contributionPercent,
      goalAlerts: args.goalAlerts,
      reminderDays: args.reminderDays,
      notifyOnComplete: args.notifyOnComplete ?? true, // Default to true
      capBehavior: args.capBehavior || "stop", // Default to stop
      capRerouteBucketId: args.capRerouteBucketId,
      alertThreshold: args.alertThreshold,
      color: args.color,
      icon: args.icon,
      createdAt: Date.now(),
      isActive: true,
    });

    // Recalculate distribution after creating bucket
    await ctx.runMutation(api.distribution.calculateDistribution, {
      userId: args.userId,
    });

    return bucketId;
  },
});

/**
 * Get all buckets for a user with computed spent amounts
 *
 * CRITICAL: Spent amounts are DERIVED from the transactions table, not stored.
 * This ensures:
 * - Delete operations automatically refund buckets (no manual adjustment needed)
 * - Edit operations automatically update spent amounts
 * - Spent amount is always accurate and consistent with transactions
 *
 * Source of Truth: expenses table
 * Computation: spentAmount = sum of expense.amount where bucketId matches
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
    monthStart: v.optional(v.number()), // Optional: filter expenses by month
    monthEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const buckets = await ctx.db
      .query("buckets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Add spent amount for each spend/recurring bucket (DERIVED from transactions)
    const bucketsWithSpent = await Promise.all(
      buckets.map(async (bucket) => {
        if (bucket.bucketMode === 'spend' || bucket.bucketMode === 'recurring') {
          // IMPORTANT: Query transactions to compute spent
          // This ensures deletes/edits automatically update the value
          let expensesQuery = ctx.db
            .query("expenses")
            .withIndex("by_bucket", (q) => q.eq("bucketId", bucket._id));

          // Filter by month if provided
          if (args.monthStart !== undefined && args.monthEnd !== undefined) {
            const allExpenses = await expensesQuery.collect();
            const filteredExpenses = allExpenses.filter(
              e => e.date >= args.monthStart! && e.date <= args.monthEnd!
            );
            const spentAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

            return {
              ...bucket,
              spentAmount, // Derived from transactions (source of truth)
              allocationValue: bucket.plannedAmount || bucket.plannedPercent || 0, // For backward compat
            };
          } else {
            // No month filter - get all expenses
            const expenses = await expensesQuery.collect();
            const spentAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

            return {
              ...bucket,
              spentAmount, // Derived from transactions (source of truth)
              allocationValue: bucket.plannedAmount || bucket.plannedPercent || 0, // For backward compat
            };
          }
        } else {
          return {
            ...bucket,
            allocationValue: bucket.targetAmount || 0, // For backward compat
          };
        }
      })
    );

    return bucketsWithSpent;
  },
});

// Update bucket balance (for save buckets or legacy support)
export const updateBalance = mutation({
  args: {
    bucketId: v.id("buckets"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const bucket = await ctx.db.get(args.bucketId);
    if (!bucket) {
      throw new Error("Bucket not found");
    }

    await ctx.db.patch(args.bucketId, {
      currentBalance: (bucket.currentBalance || 0) + args.amount,
    });
  },
});

// Update bucket details
export const update = mutation({
  args: {
    bucketId: v.id("buckets"),
    name: v.optional(v.string()),
    bucketMode: v.optional(v.union(v.literal("spend"), v.literal("save"), v.literal("recurring"))),
    allocationType: v.optional(v.union(v.literal("amount"), v.literal("percentage"))),
    plannedAmount: v.optional(v.number()),
    plannedPercent: v.optional(v.number()),
    targetAmount: v.optional(v.number()),
    contributionType: v.optional(v.union(v.literal("amount"), v.literal("percentage"), v.literal("none"))),
    contributionAmount: v.optional(v.number()),
    contributionPercent: v.optional(v.number()),
    goalAlerts: v.optional(v.array(v.number())),
    reminderDays: v.optional(v.number()),
    notifyOnComplete: v.optional(v.boolean()),
    capBehavior: v.optional(v.union(
      v.literal("stop"),
      v.literal("unallocated"),
      v.literal("bucket"),
      v.literal("proportional")
    )),
    capRerouteBucketId: v.optional(v.id("buckets")),
    alertThreshold: v.optional(v.number()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { bucketId, ...updates } = args;
    const bucket = await ctx.db.get(bucketId);
    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // If the bucket's mode is changing, clear fields from the previous mode and
    // reset balances so distribution/rollover can recompute cleanly. Stale fields
    // would otherwise produce wrong allocations (e.g. a leftover plannedPercent
    // could double-count a now-save bucket against income).
    //
    // We deliberately do NOT bump `lastRolloverDate` here. That timestamp is
    // owned by the rollover process — overwriting it on edits used to confuse
    // checkAndPerformRollover into thinking rollover had already run.
    const patch: Partial<typeof bucket> = { ...updates };
    const isModeChange =
      updates.bucketMode !== undefined && updates.bucketMode !== bucket.bucketMode;
    if (isModeChange) {
      const newMode = updates.bucketMode!;
      if (newMode === "spend" || newMode === "recurring") {
        // Clear save-mode fields
        patch.targetAmount = undefined;
        patch.currentBalance = undefined;
        patch.contributionType = undefined;
        patch.contributionAmount = undefined;
        patch.contributionPercent = undefined;
        patch.lastContributionDate = undefined;
        patch.goalAlerts = undefined;
        patch.reminderDays = undefined;
        patch.notifyOnComplete = undefined;
        patch.capBehavior = undefined;
        patch.capRerouteBucketId = undefined;
        // Reset spend/recurring balances — distribution will refund this month
        patch.carryoverBalance = 0;
        patch.fundedAmount = 0;
      } else {
        // Switching to save — clear spend/recurring-mode fields
        patch.allocationType = undefined;
        patch.plannedAmount = undefined;
        patch.plannedPercent = undefined;
        patch.carryoverBalance = undefined;
        patch.fundedAmount = undefined;
        patch.allocationValue = undefined; // legacy
        patch.allocationType_legacy = undefined; // legacy
        // Start savings balance at zero
        patch.currentBalance = 0;
      }
    }

    await ctx.db.patch(bucketId, patch);

    // Recalculate distribution after updating bucket
    await ctx.runMutation(api.distribution.calculateDistribution, {
      userId: bucket.userId,
    });

    // Reconcile this month's recurring auto-pays. If the bucket just flipped
    // to recurring, the sync inserts the missing auto-pay; if it flipped away
    // from recurring (or its plan shrank to zero), the sync removes the
    // stale row. Idempotent for unrelated edits.
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await ctx.runMutation(api.recurringSync.syncRecurringExpensesForMonth, {
      userId: bucket.userId,
      month,
    });
  },
});

// Delete bucket (soft delete)
export const remove = mutation({
  args: { bucketId: v.id("buckets") },
  handler: async (ctx, args) => {
    const bucket = await ctx.db.get(args.bucketId);
    if (!bucket) {
      throw new Error("Bucket not found");
    }

    await ctx.db.patch(args.bucketId, { isActive: false });

    // Recalculate distribution after deleting bucket
    await ctx.runMutation(api.distribution.calculateDistribution, {
      userId: bucket.userId,
    });
  },
});

// Migration: Convert old buckets to new model
export const migrateToNewModel = mutation({
  args: {},
  handler: async (ctx) => {
    const buckets = await ctx.db.query("buckets").collect();

    for (const bucket of buckets) {
      // Skip if already migrated
      if (bucket.bucketMode) continue;

      // Assume all old buckets are spend buckets
      const updates: any = {
        bucketMode: 'spend' as const,
        fundedAmount: bucket.currentBalance || 0,
      };

      if (bucket.allocationType === 'amount') {
        updates.plannedAmount = bucket.allocationValue;
      } else if (bucket.allocationType === 'percentage') {
        updates.plannedPercent = bucket.allocationValue;
      }

      await ctx.db.patch(bucket._id, updates);
    }

    return { migrated: buckets.length };
  },
});

// Migration: Add random icons to buckets that don't have one
export const addIconsToExistingBuckets = mutation({
  args: {},
  handler: async (ctx) => {
    const icons = ['octopus', 'frog', 'fish', 'duck', 'hippo', 'shrimp', 'seahorse', 'pufferfish', 'turtle'];
    const buckets = await ctx.db.query("buckets").collect();

    for (const bucket of buckets) {
      if (!bucket.icon) {
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        await ctx.db.patch(bucket._id, { icon: randomIcon });
      }
    }

    return { updated: buckets.filter(b => !b.icon).length };
  },
});
