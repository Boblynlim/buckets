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
  },
  handler: async (ctx, args) => {
    // Create income record
    const incomeId = await ctx.db.insert('income', {
      userId: args.userId,
      amount: args.amount,
      date: args.date,
      note: args.note,
      isRecurring: args.isRecurring,
      createdAt: Date.now(),
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
