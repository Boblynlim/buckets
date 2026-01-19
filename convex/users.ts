import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new user
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      name: args.name,
      createdAt: Date.now(),
    });
    return userId;
  },
});

// Get user by ID
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user;
  },
});

// Update user
export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { name: args.name });
  },
});

// Get or create the current user (demo - will be replaced with proper auth)
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // For demo, just return the first user or null
    const users = await ctx.db.query("users").collect();
    return users.length > 0 ? users[0] : null;
  },
});

// Initialize demo user
export const initDemoUser = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if user already exists
    const users = await ctx.db.query("users").collect();
    if (users.length > 0) {
      return users[0]._id;
    }

    // Create demo user
    const userId = await ctx.db.insert("users", {
      name: "Demo User",
      createdAt: Date.now(),
    });
    return userId;
  },
});
