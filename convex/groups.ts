import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all groups for a user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("groups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Create a new group
export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("groups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return await ctx.db.insert("groups", {
      userId: args.userId,
      name: args.name,
      order: existing.length,
      createdAt: Date.now(),
    });
  },
});

// Update group name
export const update = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, { name: args.name });
  },
});

// Delete a group (ungroups all buckets in it)
export const remove = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    // Ungroup all buckets in this group
    const buckets = await ctx.db.query("buckets").collect();
    for (const bucket of buckets) {
      if (bucket.groupId === args.groupId) {
        await ctx.db.patch(bucket._id, { groupId: undefined });
      }
    }
    await ctx.db.delete(args.groupId);
  },
});

// Assign a bucket to a group (or ungroup by passing undefined)
export const assignBucket = mutation({
  args: {
    bucketId: v.id("buckets"),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bucketId, { groupId: args.groupId });
  },
});
