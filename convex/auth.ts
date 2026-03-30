"use node";

import crypto from "crypto";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

export const signup = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string; userId: string }> => {
    const email = args.email.toLowerCase().trim();

    // Check if email already taken
    const existing = await ctx.runQuery(internal.authHelpers.getUserByEmail, { email });
    if (existing) {
      throw new Error("An account with this email already exists");
    }

    const passwordHash = hashPassword(args.password);
    const token: string = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Try to claim an existing unclaimed user (one without an email)
    const result: { userId: string } = await ctx.runMutation(internal.authHelpers.claimOrCreateUser, {
      email,
      passwordHash,
      name: args.name,
      token,
      now,
      expiresAt,
    }) as any;

    return { token, userId: result.userId };
  },
});

export const login = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string; userId: string }> => {
    const email = args.email.toLowerCase().trim();

    const user: any = await ctx.runQuery(internal.authHelpers.getUserByEmail, { email });
    if (!user || !user.passwordHash) {
      throw new Error("Invalid email or password");
    }

    if (!verifyPassword(args.password, user.passwordHash)) {
      throw new Error("Invalid email or password");
    }

    const token: string = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    await ctx.runMutation(internal.authHelpers.createSession, {
      userId: user._id,
      token,
      now,
      expiresAt,
    });

    return { token, userId: user._id };
  },
});

export const hasUsersWithPasscode = action({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const result: any = await ctx.runQuery(internal.authHelpers.checkPasscodeExists);
    return result;
  },
});

export const setupPasscode = action({
  args: {
    passcode: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string; userId: string }> => {
    if (args.passcode.length !== 6 || !/^\d{6}$/.test(args.passcode)) {
      throw new Error("Passcode must be 6 digits");
    }

    const passcodeHash = hashPassword(args.passcode);
    const token: string = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 365 * 24 * 60 * 60 * 1000; // 1 year

    const result: { userId: string } = await ctx.runMutation(internal.authHelpers.claimOrCreateUserWithPasscode, {
      passcodeHash,
      name: args.name,
      token,
      now,
      expiresAt,
    }) as any;

    return { token, userId: result.userId };
  },
});

export const loginWithPasscode = action({
  args: {
    passcode: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string; userId: string }> => {
    const users: any[] = await ctx.runQuery(internal.authHelpers.getAllUsersWithPasscode);

    let matchedUser = null;
    for (const user of users) {
      if (user.passcodeHash && verifyPassword(args.passcode, user.passcodeHash)) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      throw new Error("Incorrect passcode");
    }

    const token: string = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 365 * 24 * 60 * 60 * 1000; // 1 year

    await ctx.runMutation(internal.authHelpers.createSession, {
      userId: matchedUser._id,
      token,
      now,
      expiresAt,
    });

    return { token, userId: matchedUser._id };
  },
});

// Email + passcode signup
export const signupWithEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    passcode: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string; userId: string }> => {
    const email = args.email.toLowerCase().trim();
    if (args.passcode.length !== 6 || !/^\d{6}$/.test(args.passcode)) {
      throw new Error("Passcode must be 6 digits");
    }

    const existing = await ctx.runQuery(internal.authHelpers.getUserByEmail, { email });
    if (existing) {
      throw new Error("An account with this email already exists");
    }

    const passcodeHash = hashPassword(args.passcode);
    const token: string = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 365 * 24 * 60 * 60 * 1000; // 1 year

    // Try to claim an existing unclaimed user (one without an email)
    const allUsers: any[] = await ctx.runQuery(internal.authHelpers.getAllUsers);
    const unclaimed = allUsers.find((u: any) => !u.email);

    let userId: string;
    if (unclaimed) {
      await ctx.runMutation(internal.authHelpers.patchUser, {
        userId: unclaimed._id,
        fields: { email, name: args.name, passcodeHash },
      });
      userId = unclaimed._id;
    } else {
      userId = await ctx.runMutation(internal.authHelpers.createUser, {
        name: args.name,
        email,
        passcodeHash,
        now,
      });
    }

    await ctx.runMutation(internal.authHelpers.createSession, {
      userId: userId as any,
      token,
      now,
      expiresAt,
    });

    return { token, userId };
  },
});

// Email + passcode login
export const loginWithEmail = action({
  args: {
    email: v.string(),
    passcode: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string; userId: string }> => {
    const email = args.email.toLowerCase().trim();

    const user: any = await ctx.runQuery(internal.authHelpers.getUserByEmail, { email });
    if (!user || !user.passcodeHash) {
      throw new Error("No account found with this email");
    }

    if (!verifyPassword(args.passcode, user.passcodeHash)) {
      throw new Error("Incorrect passcode");
    }

    const token: string = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 365 * 24 * 60 * 60 * 1000; // 1 year

    await ctx.runMutation(internal.authHelpers.createSession, {
      userId: user._id,
      token,
      now,
      expiresAt,
    });

    return { token, userId: user._id };
  },
});

export const changePassword = action({
  args: {
    sessionToken: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const user: any = await ctx.runQuery(internal.authHelpers.getUserBySession, {
      sessionToken: args.sessionToken,
    });
    if (!user || !user.passwordHash) {
      throw new Error("Not authenticated");
    }
    if (!verifyPassword(args.currentPassword, user.passwordHash)) {
      throw new Error("Current password is incorrect");
    }
    const newHash = hashPassword(args.newPassword);
    await ctx.runMutation(internal.authHelpers.updatePasswordHash, {
      userId: user._id,
      passwordHash: newHash,
    });
    return { success: true };
  },
});

export const changePasscode = action({
  args: {
    sessionToken: v.string(),
    currentPasscode: v.string(),
    newPasscode: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    if (args.newPasscode.length !== 6 || !/^\d{6}$/.test(args.newPasscode)) {
      throw new Error("Passcode must be 6 digits");
    }
    const user: any = await ctx.runQuery(internal.authHelpers.getUserBySession, {
      sessionToken: args.sessionToken,
    });
    if (!user || !user.passcodeHash) {
      throw new Error("Not authenticated");
    }
    if (!verifyPassword(args.currentPasscode, user.passcodeHash)) {
      throw new Error("Current passcode is incorrect");
    }
    const newHash = hashPassword(args.newPasscode);
    await ctx.runMutation(internal.authHelpers.updatePasscodeHash, {
      userId: user._id,
      passcodeHash: newHash,
    });
    return { success: true };
  },
});
