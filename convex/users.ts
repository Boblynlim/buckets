import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user by ID
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user;
  },
});

// Get current user from session token
export const getCurrentUser = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken!))
      .unique();

    if (!session || session.expiresAt < Date.now()) return null;

    return await ctx.db.get(session.userId);
  },
});

// Logout — delete session
export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
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
