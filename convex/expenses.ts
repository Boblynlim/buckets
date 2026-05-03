import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Create a new expense
 *
 * Validation: Checks if bucket has sufficient funded amount before creating.
 * After creation, derived queries automatically update:
 * - buckets.getByUser recomputes spentAmount
 * - analytics.getMonthlyTotalSpent updates monthly total
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    bucketId: v.id("buckets"),
    amount: v.number(),
    date: v.number(),
    note: v.string(),
    // Binary worth-it rating (default: false)
    worthIt: v.optional(v.boolean()),
    // Legacy fields
    worthRating: v.optional(v.number()),
    alignmentRating: v.optional(v.number()),
    happinessRating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bucket = await ctx.db.get(args.bucketId);
    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // Check if this note is remembered as necessary
    const normalizedNote = args.note.toLowerCase().trim();
    const necessaryNotes = await ctx.db
      .query("necessaryNotes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const isAutoNecessary = necessaryNotes.some((n) => n.note === normalizedNote);

    const expenseId = await ctx.db.insert("expenses", {
      userId: args.userId,
      bucketId: args.bucketId,
      amount: args.amount,
      date: args.date,
      note: args.note,
      worthIt: args.worthIt ?? false,
      isNecessary: isAutoNecessary || undefined,
      worthRating: args.worthRating,
      alignmentRating: args.alignmentRating,
      happinessRating: args.happinessRating,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Auto-generate metadata tags
    try {
      await ctx.runMutation(api.tagging.generateMetadata, {
        expenseId,
      });
    } catch (error) {
      console.error('Failed to generate metadata:', error);
      // Don't fail the expense creation if tagging fails
    }

    return expenseId;
  },
});

// Get expenses for a user
export const getByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }

    return await query.collect();
  },
});

// Get expenses for a specific bucket
export const getByBucket = query({
  args: { bucketId: v.id("buckets") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_bucket", (q) => q.eq("bucketId", args.bucketId))
      .order("desc")
      .collect();
    return expenses;
  },
});

/**
 * Update an expense
 *
 * Validates: If amount or bucket changes, checks new bucket has sufficient funds.
 * After update, derived queries automatically reflect changes:
 * - If amount changed: spentAmount updates
 * - If bucket changed: spentAmount moves from old bucket to new bucket
 * - If date changed: monthly totals shift between months
 *
 * All updates propagate via reactive queries - no manual adjustment needed.
 */
export const update = mutation({
  args: {
    expenseId: v.id("expenses"),
    amount: v.optional(v.number()),
    bucketId: v.optional(v.id("buckets")),
    date: v.optional(v.number()),
    note: v.optional(v.string()),
    worthIt: v.optional(v.boolean()),
    isNecessary: v.optional(v.boolean()),
    worthRating: v.optional(v.number()),
    alignmentRating: v.optional(v.number()),
    happinessRating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const { expenseId, ...updates } = args;
      console.log('Updating expense:', expenseId, updates);

      const expense = await ctx.db.get(expenseId);
      if (!expense) {
        throw new Error("Expense not found");
      }
      console.log('Found expense:', expense);

    // If amount or bucket changed, validate new expense against bucket funding
    if (updates.amount !== undefined || updates.bucketId !== undefined) {
      const newAmount = updates.amount ?? expense.amount;
      const newBucketId = updates.bucketId ?? expense.bucketId;
      const newBucket = await ctx.db.get(newBucketId);

      if (!newBucket) {
        throw new Error("Bucket not found");
      }

      // Allow overspending - validation disabled to allow debt tracking
      /*
      const bucketMode = newBucket.bucketMode || 'spend';
      if (bucketMode === 'spend' || bucketMode === 'recurring') {
        const otherExpenses = await ctx.db
          .query("expenses")
          .withIndex("by_bucket", (q) => q.eq("bucketId", newBucketId))
          .filter((q) => q.neq(q.field("_id"), expenseId))
          .collect();

        const otherSpent = otherExpenses.reduce((sum, e) => sum + e.amount, 0);
        const fundedAmount = newBucket.fundedAmount || 0;
        const carryover = newBucket.carryoverBalance || 0;
        const available = (fundedAmount + carryover) - otherSpent;

        if (available < newAmount) {
          throw new Error(
            `Insufficient balance in ${newBucket.name}. Available: $${available.toFixed(2)}, Required: $${newAmount.toFixed(2)}`
          );
        }
      }
      */
    }

    // If the user is editing an auto-generated recurring payment, mark it
    // so the sync mutation stops managing it. Their value wins from now on,
    // and sync won't insert a duplicate auto-pay for the same (bucket, month).
    if (expense.isAutoGenerated && !expense.userOverridden) {
      (updates as any).userOverridden = true;
    }

    console.log('Updating expense with:', updates);
    await ctx.db.patch(expenseId, {
      ...updates,
      updatedAt: Date.now(),
    });
    console.log('Expense updated successfully');
    } catch (error) {
      console.error('Error updating expense:', error);
      throw new Error(`Failed to update expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

/**
 * Delete an expense
 *
 * CRITICAL: This mutation ONLY deletes the transaction.
 * It does NOT manually update bucket balances or spent amounts.
 *
 * Why: All spent amounts are DERIVED from the transactions table via queries.
 * When this transaction is deleted:
 * - buckets.getByUser will automatically recompute spentAmount (queries expenses)
 * - analytics.getMonthlyTotalSpent will automatically update (queries expenses)
 * - The bucket's available amount automatically increases (derived: funded - spent)
 *
 * This ensures the delete properly "refunds" the bucket without manual intervention.
 * The reactive query system guarantees UI updates immediately.
 */
export const remove = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    // Delete the transaction - derived queries will handle the rest
    await ctx.db.delete(args.expenseId);
  },
});

// Bulk import expenses from CSV
export const bulkImport = mutation({
  args: {
    userId: v.id("users"),
    expenses: v.array(v.object({
      bucketId: v.id("buckets"),
      amount: v.number(),
      date: v.number(), // timestamp
      note: v.string(),
      worthIt: v.optional(v.boolean()),
      worthRating: v.optional(v.number()),
      alignmentRating: v.optional(v.number()),
      happinessRating: v.optional(v.number()),
      category: v.optional(v.string()),
      merchant: v.optional(v.string()),
      needsVsWants: v.optional(v.union(v.literal("need"), v.literal("want"))),
    })),
  },
  handler: async (ctx, args) => {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < args.expenses.length; i++) {
      const expense = args.expenses[i];

      try {
        // Validate bucket exists
        const bucket = await ctx.db.get(expense.bucketId);
        if (!bucket) {
          throw new Error(`Bucket not found`);
        }

        // Allow overspending - validation disabled to allow debt tracking
        /*
        if (bucket.bucketMode === 'spend' || bucket.bucketMode === 'recurring') {
          const fundedAmount = bucket.fundedAmount || 0;
          const carryover = bucket.carryoverBalance || 0;
          const existingExpenses = await ctx.db
            .query("expenses")
            .withIndex("by_bucket", (q) => q.eq("bucketId", expense.bucketId))
            .collect();
          const alreadySpent = existingExpenses.reduce((sum, e) => sum + e.amount, 0);
          const available = (fundedAmount + carryover) - alreadySpent;

          if (available < expense.amount) {
            results.errors.push(
              `Row ${i + 1}: Insufficient balance in ${bucket.name}. Available: $${available.toFixed(2)}, Required: $${expense.amount.toFixed(2)}`
            );
            results.failed++;
            continue;
          }
        }
        */

        // Create the expense
        await ctx.db.insert("expenses", {
          userId: args.userId,
          bucketId: expense.bucketId,
          amount: expense.amount,
          date: expense.date,
          note: expense.note,
          worthIt: expense.worthIt ?? false,
          worthRating: expense.worthRating,
          alignmentRating: expense.alignmentRating,
          happinessRating: expense.happinessRating,
          category: expense.category,
          merchant: expense.merchant,
          needsVsWants: expense.needsVsWants,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${(error as Error).message}`);
      }
    }

    return results;
  },
});

// Mark a single expense as necessary
export const markNecessary = mutation({
  args: {
    expenseId: v.id("expenses"),
    isNecessary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");
    await ctx.db.patch(args.expenseId, {
      isNecessary: args.isNecessary,
      updatedAt: Date.now(),
    });
  },
});

// Mark all expenses with a matching note as necessary + remember the note
export const markNoteAsNecessary = mutation({
  args: {
    userId: v.id("users"),
    note: v.string(),
    isNecessary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const normalizedNote = args.note.toLowerCase().trim();

    // Find all expenses with this note
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const matching = allExpenses.filter(
      (e) => e.note.toLowerCase().trim() === normalizedNote
    );

    // Update all matching expenses
    for (const expense of matching) {
      await ctx.db.patch(expense._id, {
        isNecessary: args.isNecessary,
        updatedAt: Date.now(),
      });
    }

    if (args.isNecessary) {
      // Remember this note for auto-suggest on future expenses
      const existing = await ctx.db
        .query("necessaryNotes")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      const alreadySaved = existing.find(
        (n) => n.note === normalizedNote
      );

      if (!alreadySaved) {
        await ctx.db.insert("necessaryNotes", {
          userId: args.userId,
          note: normalizedNote,
          createdAt: Date.now(),
        });
      }
    } else {
      // Remove from remembered notes
      const existing = await ctx.db
        .query("necessaryNotes")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();

      const saved = existing.find((n) => n.note === normalizedNote);
      if (saved) {
        await ctx.db.delete(saved._id);
      }
    }

    return { updated: matching.length };
  },
});

// Get all remembered necessary notes for a user
export const getNecessaryNotes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("necessaryNotes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Count expenses matching a note
export const countByNote = query({
  args: {
    userId: v.id("users"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedNote = args.note.toLowerCase().trim();
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return allExpenses.filter(
      (e) => e.note.toLowerCase().trim() === normalizedNote
    ).length;
  },
});

// Toggle the worthIt flag on an expense
export const toggleWorthIt = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    console.log("toggleWorthIt called with:", args.expenseId);
    try {
      const expense = await ctx.db.get(args.expenseId);
      console.log("Found expense:", expense?._id, "current worthIt:", expense?.worthIt);
      if (!expense) {
        throw new Error("Expense not found");
      }
      const newValue = !(expense.worthIt ?? false);
      console.log("Setting worthIt to:", newValue);
      await ctx.db.patch(args.expenseId, {
        worthIt: newValue,
        updatedAt: Date.now(),
      });
      console.log("toggleWorthIt success");
    } catch (error) {
      console.error("toggleWorthIt error:", error);
      throw error;
    }
  },
});

/**
 * Fix timestamps on CSV-imported expenses that were parsed as UTC midnight.
 *
 * The CSV import used `new Date("YYYY-MM-DD")` which JavaScript interprets as
 * UTC midnight. This causes month-boundary mismatches with the local-time
 * filters used in bucket spent calculations and rollover.
 *
 * This mutation detects expenses whose timestamps land exactly on UTC midnight
 * (the hallmark of the bug) and shifts them to noon local time on the same
 * calendar date, matching how manually-created expenses behave.
 */
export const fixUTCImportedDates = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let fixed = 0;

    for (const expense of allExpenses) {
      const d = new Date(expense.date);
      // UTC midnight = hours/minutes/seconds/ms are all 0 in UTC
      if (
        d.getUTCHours() === 0 &&
        d.getUTCMinutes() === 0 &&
        d.getUTCSeconds() === 0 &&
        d.getUTCMilliseconds() === 0
      ) {
        // Reconstruct as local noon on the same calendar date (UTC date)
        const localNoon = new Date(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          12, 0, 0,
        ).getTime();

        await ctx.db.patch(expense._id, {
          date: localNoon,
          updatedAt: Date.now(),
        });
        fixed++;
      }
    }

    return { fixed, total: allExpenses.length };
  },
});
