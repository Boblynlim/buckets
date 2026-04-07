import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { api } from './_generated/api';
import { Id, Doc } from './_generated/dataModel';

// Add income and trigger distribution recalculation
export const add = mutation({
  args: {
    userId: v.id('users'),
    amount: v.number(),
    date: v.number(),
    note: v.optional(v.string()),
    isRecurring: v.boolean(),
    startMonth: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Create income record
    const incomeId = await ctx.db.insert('income', {
      userId: args.userId,
      amount: args.amount,
      date: args.date,
      note: args.note,
      isRecurring: args.isRecurring,
      createdAt: Date.now(),
      startMonth: args.startMonth || defaultMonth,
    });

    // Recalculate distribution for all buckets
    await ctx.runMutation(api.distribution.calculateDistribution, {
      userId: args.userId,
    });

    return incomeId;
  },
});

// Get income for a user
export const getByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const income = await ctx.db
      .query('income')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .order('desc')
      .collect();
    return income;
  },
});

// Get recurring income
export const getRecurring = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const income = await ctx.db
      .query('income')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isRecurring'), true))
      .collect();
    return income;
  },
});

// Soft-delete income entry by setting endMonth
export const remove = mutation({
  args: {
    incomeId: v.id('income'),
    endMonth: v.optional(v.string()), // "2026-03" — last month it applies; defaults to current month
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endMonth = args.endMonth || defaultMonth;

    await ctx.db.patch(args.incomeId, { endMonth });

    return { success: true };
  },
});

// Permanently delete an income entry (for cleanup)
export const hardRemove = mutation({
  args: { incomeId: v.id('income') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.incomeId);
    return { success: true };
  },
});
