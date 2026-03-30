import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const claimOrCreateUser = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    token: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Look for an existing user without an email (unclaimed account)
    const allUsers = await ctx.db.query("users").collect();
    const unclaimed = allUsers.find((u) => !u.email);

    let userId;
    if (unclaimed) {
      // Claim the existing user — preserve their data
      await ctx.db.patch(unclaimed._id, {
        email: args.email,
        passwordHash: args.passwordHash,
        name: args.name,
      });
      userId = unclaimed._id;
    } else {
      // Create a brand new user
      userId = await ctx.db.insert("users", {
        name: args.name,
        email: args.email,
        passwordHash: args.passwordHash,
        createdAt: args.now,
      });
    }

    // Create session
    await ctx.db.insert("sessions", {
      userId,
      token: args.token,
      createdAt: args.now,
      expiresAt: args.expiresAt,
    });

    return { userId };
  },
});

export const getUserBySession = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;
    return await ctx.db.get(session.userId);
  },
});

export const updatePasswordHash = internalMutation({
  args: { userId: v.id("users"), passwordHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { passwordHash: args.passwordHash });
  },
});

export const updatePasscodeHash = internalMutation({
  args: { userId: v.id("users"), passcodeHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { passcodeHash: args.passcodeHash });
  },
});

export const checkPasscodeExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.some((u) => !!u.passcodeHash);
  },
});

export const getAllUsersWithPasscode = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => !!u.passcodeHash);
  },
});

export const claimOrCreateUserWithPasscode = internalMutation({
  args: {
    passcodeHash: v.string(),
    name: v.string(),
    token: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Look for an existing user without a passcode (unclaimed)
    const allUsers = await ctx.db.query("users").collect();
    const unclaimed = allUsers.find((u) => !u.passcodeHash);

    let userId;
    if (unclaimed) {
      await ctx.db.patch(unclaimed._id, {
        passcodeHash: args.passcodeHash,
        name: args.name,
      });
      userId = unclaimed._id;
    } else {
      userId = await ctx.db.insert("users", {
        name: args.name,
        passcodeHash: args.passcodeHash,
        createdAt: args.now,
      });
    }

    await ctx.db.insert("sessions", {
      userId,
      token: args.token,
      createdAt: args.now,
      expiresAt: args.expiresAt,
    });

    return { userId };
  },
});

export const getAllUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const patchUser = internalMutation({
  args: {
    userId: v.id("users"),
    fields: v.object({
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      passcodeHash: v.optional(v.string()),
      passwordHash: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const patch: any = {};
    if (args.fields.email !== undefined) patch.email = args.fields.email;
    if (args.fields.name !== undefined) patch.name = args.fields.name;
    if (args.fields.passcodeHash !== undefined) patch.passcodeHash = args.fields.passcodeHash;
    if (args.fields.passwordHash !== undefined) patch.passwordHash = args.fields.passwordHash;
    await ctx.db.patch(args.userId, patch);
  },
});

export const createUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    passcodeHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      passcodeHash: args.passcodeHash,
      createdAt: args.now,
    });
  },
});

export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      userId: args.userId,
      token: args.token,
      createdAt: args.now,
      expiresAt: args.expiresAt,
    });
  },
});
