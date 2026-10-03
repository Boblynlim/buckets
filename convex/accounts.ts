import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const group = v.union(v.literal("now"), v.literal("soon"), v.literal("later"));

/** Accounts with their latest balance, for the check-in (prefilled) and home. */
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const accounts = (
      await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    ).filter((a) => a.isActive);
    const out = [];
    for (const a of accounts.sort((x, y) => x.order - y.order)) {
      const latest = await ctx.db
        .query("balanceSnapshots")
        .withIndex("by_account_month", (q) => q.eq("accountId", a._id))
        .order("desc")
        .first();
      out.push({ ...a, amount: latest?.amount ?? 0, month: latest?.month ?? null });
    }
    return out;
  },
});

/**
 * Net worth per month, split by group. Accounts without a snapshot that month
 * carry their previous balance forward (a skipped update costs nothing).
 */
export const netWorthHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const accounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const groupOf = new Map(accounts.map((a) => [a._id, a.group]));
    const snaps = await ctx.db
      .query("balanceSnapshots")
      .withIndex("by_user_month", (q) => q.eq("userId", userId))
      .collect();
    const months = [...new Set(snaps.map((s) => s.month))].sort();
    const last = new Map<Id<"accounts">, number>();
    return months.map((month) => {
      for (const s of snaps) if (s.month === month) last.set(s.accountId, s.amount);
      const totals = { now: 0, soon: 0, later: 0 };
      for (const [id, amt] of last) totals[groupOf.get(id) ?? "later"] += amt;
      return { month, ...totals, total: totals.now + totals.soon + totals.later };
    });
  },
});

/** Save this month's balances (the check-in's "change only what moved" step). */
export const saveBalances = mutation({
  args: {
    userId: v.id("users"),
    month: v.string(),
    entries: v.array(v.object({ accountId: v.id("accounts"), amount: v.number() })),
  },
  handler: async (ctx, { userId, month, entries }) => {
    for (const e of entries) {
      const acct = await ctx.db.get(e.accountId);
      if (!acct || acct.userId !== userId) throw new Error("Account not found");
      const existing = await ctx.db
        .query("balanceSnapshots")
        .withIndex("by_account_month", (q) => q.eq("accountId", e.accountId).eq("month", month))
        .first();
      if (existing) await ctx.db.patch(existing._id, { amount: e.amount, updatedAt: Date.now() });
      else await ctx.db.insert("balanceSnapshots", { userId, accountId: e.accountId, month, amount: e.amount, updatedAt: Date.now() });
    }
  },
});

export const addAccount = mutation({
  args: { userId: v.id("users"), name: v.string(), group },
  handler: async (ctx, { userId, name, group }) => {
    const all = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return await ctx.db.insert("accounts", { userId, name, group, order: all.length, isActive: true, createdAt: Date.now() });
  },
});

export const listEarmarks = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await ctx.db.query("earmarks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
});

export const setEarmark = mutation({
  args: { userId: v.id("users"), name: v.string(), amount: v.number(), goalBucketId: v.optional(v.id("buckets")) },
  handler: async (ctx, { userId, name, amount, goalBucketId }) => {
    const existing = (
      await ctx.db.query("earmarks").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    ).find((e) => e.name === name);
    if (existing) await ctx.db.patch(existing._id, { amount, goalBucketId, updatedAt: Date.now() });
    else await ctx.db.insert("earmarks", { userId, name, amount, goalBucketId, updatedAt: Date.now() });
  },
});

/**
 * One-off: seed accounts and past monthly balances (e.g. from the old money
 * sheet). Idempotent: accounts match by name, snapshots by account + month.
 * The data is passed in at run time; none of it lives in the repo.
 */
export const importSnapshots = internalMutation({
  args: {
    userId: v.id("users"),
    dryRun: v.boolean(),
    accounts: v.array(v.object({ name: v.string(), group, isActive: v.optional(v.boolean()) })),
    snapshots: v.array(v.object({ name: v.string(), month: v.string(), amount: v.number(), amountIn: v.optional(v.number()) })),
  },
  handler: async (ctx, { userId, dryRun, accounts, snapshots }) => {
    const log: string[] = [];
    const existing = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const idOf = new Map<string, Id<"accounts">>(existing.map((a) => [a.name, a._id]));
    for (const [i, a] of accounts.entries()) {
      if (idOf.has(a.name)) continue;
      log.push(`account "${a.name}" (${a.group}${a.isActive === false ? ", closed" : ""})`);
      if (!dryRun) {
        idOf.set(a.name, await ctx.db.insert("accounts", { userId, name: a.name, group: a.group, order: i, isActive: a.isActive ?? true, createdAt: Date.now() }));
      }
    }
    let n = 0;
    for (const s of snapshots) {
      const accountId = idOf.get(s.name);
      if (!accountId) {
        if (dryRun) n++;
        continue;
      }
      const prior = await ctx.db
        .query("balanceSnapshots")
        .withIndex("by_account_month", (q) => q.eq("accountId", accountId).eq("month", s.month))
        .first();
      if (prior) continue;
      n++;
      if (!dryRun) {
        await ctx.db.insert("balanceSnapshots", { userId, accountId, month: s.month, amount: s.amount, amountIn: s.amountIn, updatedAt: Date.now() });
      }
    }
    log.push(`${n} monthly balances`);
    return { dryRun, changes: log };
  },
});
