import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Log a receipt (confirm income received for a month)
export const log = mutation({
  args: {
    userId: v.id('users'),
    sourceId: v.optional(v.id('income')),
    amount: v.number(),
    month: v.string(), // "2026-03"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('incomeReceipts', {
      userId: args.userId,
      sourceId: args.sourceId,
      amount: args.amount,
      month: args.month,
      note: args.note,
      receivedAt: Date.now(),
    });
  },
});

// Get all receipts for a given month
export const getByMonth = query({
  args: {
    userId: v.id('users'),
    month: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('incomeReceipts')
      .withIndex('by_user_month', q =>
        q.eq('userId', args.userId).eq('month', args.month)
      )
      .collect();
  },
});

// Get all receipts for a user (for history)
export const getAll = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('incomeReceipts')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .order('desc')
      .collect();
  },
});

// Remove a receipt
export const remove = mutation({
  args: { receiptId: v.id('incomeReceipts') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.receiptId);
    return { success: true };
  },
});
