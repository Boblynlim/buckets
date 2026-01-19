import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a recurring expense
export const create = mutation({
  args: {
    userId: v.id("users"),
    bucketId: v.id("buckets"),
    name: v.string(),
    amount: v.number(),
    dayOfMonth: v.number(),
  },
  handler: async (ctx, args) => {
    const recurringExpenseId = await ctx.db.insert("recurringExpenses", {
      userId: args.userId,
      bucketId: args.bucketId,
      name: args.name,
      amount: args.amount,
      dayOfMonth: args.dayOfMonth,
      isActive: true,
      createdAt: Date.now(),
    });
    return recurringExpenseId;
  },
});

// Get recurring expenses for a user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const recurringExpenses = await ctx.db
      .query("recurringExpenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    return recurringExpenses;
  },
});

// Update a recurring expense
export const update = mutation({
  args: {
    recurringExpenseId: v.id("recurringExpenses"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    bucketId: v.optional(v.id("buckets")),
    dayOfMonth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { recurringExpenseId, ...updates } = args;
    await ctx.db.patch(recurringExpenseId, updates);
  },
});

// Delete a recurring expense (soft delete)
export const remove = mutation({
  args: { recurringExpenseId: v.id("recurringExpenses") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recurringExpenseId, { isActive: false });
  },
});

// Process recurring expenses (to be called by a scheduled function)
export const processRecurringExpenses = mutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const dayOfMonth = today.getDate();

    // Get all active recurring expenses for today
    const allRecurringExpenses = await ctx.db
      .query("recurringExpenses")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const dueExpenses = allRecurringExpenses.filter(
      (re) => re.dayOfMonth === dayOfMonth
    );

    for (const recurringExpense of dueExpenses) {
      const bucket = await ctx.db.get(recurringExpense.bucketId);
      if (!bucket) continue;

      if (bucket.bucketMode === 'spend') {
        // Calculate available balance
        const existingExpenses = await ctx.db
          .query("expenses")
          .withIndex("by_bucket", (q) => q.eq("bucketId", recurringExpense.bucketId))
          .collect();
        const alreadySpent = existingExpenses.reduce((sum, e) => sum + e.amount, 0);
        const available = (bucket.fundedAmount || 0) - alreadySpent;

        // Only create expense if sufficient balance
        if (available >= recurringExpense.amount) {
          await ctx.db.insert("expenses", {
            userId: recurringExpense.userId,
            bucketId: recurringExpense.bucketId,
            amount: recurringExpense.amount,
            date: Date.now(),
            note: `Recurring: ${recurringExpense.name}`,
            happinessRating: 3, // Default neutral rating for auto-generated expenses
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        // If insufficient balance, skip (could add notification here)
      }
    }
  },
});
