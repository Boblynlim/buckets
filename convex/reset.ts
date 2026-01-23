import { v } from 'convex/values';
import { mutation } from './_generated/server';

/**
 * Delete all data for a user and reset to clean slate
 * WARNING: This is irreversible!
 */
export const deleteAllUserData = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    // Delete all buckets
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    for (const bucket of buckets) {
      await ctx.db.delete(bucket._id);
    }

    // Delete all income
    const income = await ctx.db
      .query('income')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    for (const inc of income) {
      await ctx.db.delete(inc._id);
    }

    // Delete all expenses
    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    for (const expense of expenses) {
      await ctx.db.delete(expense._id);
    }

    // Delete all recurring expenses
    const recurringExpenses = await ctx.db
      .query('recurringExpenses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    for (const recurring of recurringExpenses) {
      await ctx.db.delete(recurring._id);
    }

    // Delete all Claude conversations
    const conversations = await ctx.db
      .query('claudeConversations')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    for (const convo of conversations) {
      await ctx.db.delete(convo._id);
    }

    // Delete all memories
    const memories = await ctx.db
      .query('memories')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    for (const memory of memories) {
      await ctx.db.delete(memory._id);
    }

    return {
      success: true,
      deletedCounts: {
        buckets: buckets.length,
        income: income.length,
        expenses: expenses.length,
        recurringExpenses: recurringExpenses.length,
        conversations: conversations.length,
        memories: memories.length,
      },
    };
  },
});
