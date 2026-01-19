import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/**
 * Memory Management System
 * Stores user preferences, goals, insights, and context for personalization
 */

// Create a new memory
export const create = mutation({
  args: {
    userId: v.id('users'),
    memoryType: v.union(v.literal('preference'), v.literal('goal'), v.literal('insight'), v.literal('context')),
    content: v.string(),
    source: v.optional(v.string()),
    metadata: v.optional(v.object({
      bucketId: v.optional(v.id('buckets')),
      category: v.optional(v.string()),
      targetAmount: v.optional(v.number()),
      targetDate: v.optional(v.number()),
    })),
    importance: v.number(), // 1-5
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const memoryId = await ctx.db.insert('memories', {
      userId: args.userId,
      memoryType: args.memoryType,
      content: args.content,
      source: args.source,
      metadata: args.metadata,
      importance: args.importance,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return memoryId;
  },
});

// Get all active memories for a user
export const getByUser = query({
  args: {
    userId: v.id('users'),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('memories')
      .withIndex('by_user', (q) => q.eq('userId', args.userId));

    if (!args.includeInactive) {
      query = query.filter((q) => q.eq(q.field('isActive'), true));
    }

    const memories = await query
      .order('desc')
      .collect();

    // Sort by importance and recency
    memories.sort((a, b) => {
      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }
      return b.updatedAt - a.updatedAt;
    });

    return memories;
  },
});

// Get memories by type
export const getByType = query({
  args: {
    userId: v.id('users'),
    memoryType: v.union(v.literal('preference'), v.literal('goal'), v.literal('insight'), v.literal('context')),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query('memories')
      .withIndex('by_user_and_type', (q) =>
        q.eq('userId', args.userId).eq('memoryType', args.memoryType)
      )
      .filter((q) => q.eq(q.field('isActive'), true))
      .order('desc')
      .collect();

    return memories;
  },
});

// Get important memories for chat context (top N by importance)
export const getContextMemories = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const memories = await ctx.db
      .query('memories')
      .withIndex('by_user_and_active', (q) =>
        q.eq('userId', args.userId).eq('isActive', true)
      )
      .order('desc')
      .take(50); // Get more than needed to sort properly

    // Sort by importance (descending) and take top N
    memories.sort((a, b) => {
      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }
      return b.updatedAt - a.updatedAt;
    });

    return memories.slice(0, limit);
  },
});

// Update a memory
export const update = mutation({
  args: {
    memoryId: v.id('memories'),
    content: v.optional(v.string()),
    importance: v.optional(v.number()),
    metadata: v.optional(v.object({
      bucketId: v.optional(v.id('buckets')),
      category: v.optional(v.string()),
      targetAmount: v.optional(v.number()),
      targetDate: v.optional(v.number()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { memoryId, ...updates } = args;

    await ctx.db.patch(memoryId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return memoryId;
  },
});

// Deactivate a memory (soft delete)
export const deactivate = mutation({
  args: {
    memoryId: v.id('memories'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoryId, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

// Delete a memory (hard delete)
export const remove = mutation({
  args: {
    memoryId: v.id('memories'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memoryId);
  },
});

// Auto-create memory from insight
export const createFromInsight = mutation({
  args: {
    userId: v.id('users'),
    insight: v.string(),
    source: v.string(),
    category: v.optional(v.string()),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const memoryId = await ctx.db.insert('memories', {
      userId: args.userId,
      memoryType: 'insight',
      content: args.insight,
      source: args.source,
      metadata: args.category ? { category: args.category } : undefined,
      importance: args.importance || 3,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return memoryId;
  },
});
