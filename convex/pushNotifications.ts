import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";

// Save a push subscription for a user
export const saveSubscription = mutation({
  args: {
    userId: v.id("users"),
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    // Check if subscription already exists
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        keys: args.keys,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      userId: args.userId,
      endpoint: args.endpoint,
      keys: args.keys,
      createdAt: Date.now(),
    });
  },
});

// Remove a push subscription
export const removeSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (sub) {
      await ctx.db.delete(sub._id);
    }
  },
});

// Get subscriptions for a user
export const getSubscriptions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Internal query to get subscriptions (for use in actions)
export const getSubscriptionsInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Internal mutation to remove subscription (for use in actions)
export const removeSubscriptionInternal = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (sub) {
      await ctx.db.delete(sub._id);
    }
  },
});

export const getAllSubscriptions = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("pushSubscriptions").collect();
  },
});
