import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { monthRange } from "./home";

// The Adventures cup funds the list in order: the first adventure fills
// before the next one starts.

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const items = (await ctx.db.query("adventures").withIndex("by_user", (q) => q.eq("userId", userId)).collect())
      .filter((a) => !a.done)
      .sort((a, b) => a.order - b.order);
    const cup = (await ctx.db.query("buckets").withIndex("by_user", (q) => q.eq("userId", userId)).collect())
      .find((b) => b.isActive && b.name === "Adventures");
    let balance = 0;
    let monthly = 0;
    if (cup) {
      const now = new Date(Date.now() + 8 * 3600 * 1000);
      const { start, end } = monthRange(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`);
      const exps = await ctx.db.query("expenses").withIndex("by_bucket", (q) => q.eq("bucketId", cup._id)).collect();
      const spent = exps.filter((e) => !e.superseded && e.date >= start && e.date <= end).reduce((s, e) => s + e.amount, 0);
      balance = (cup.fundedAmount ?? cup.plannedAmount ?? 0) + (cup.carryoverBalance ?? 0) - spent;
      monthly = cup.plannedAmount ?? 0;
    }
    let pool = Math.max(0, balance);
    let ahead = 0; // money still needed by earlier adventures
    return {
      balance,
      monthly,
      items: items.map((a) => {
        const saved = Math.min(pool, a.cost);
        pool -= saved;
        const need = a.cost - saved;
        // Months until funded at the monthly rate, after the ones ahead of it.
        const months = monthly > 0 ? Math.ceil((ahead + need) / monthly) : null;
        ahead += need;
        return { id: a._id, name: a.name, cost: a.cost, when: a.when ?? null, saved, funded: need <= 0.005, monthsToGo: need <= 0.005 ? 0 : months };
      }),
    };
  },
});

export const add = mutation({
  args: { userId: v.id("users"), name: v.string(), cost: v.number(), when: v.optional(v.string()) },
  handler: async (ctx, { userId, name, cost, when }) => {
    const all = await ctx.db.query("adventures").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    return await ctx.db.insert("adventures", {
      userId, name, cost, when, order: all.reduce((m, a) => Math.max(m, a.order), -1) + 1, createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { id: v.id("adventures"), name: v.optional(v.string()), cost: v.optional(v.number()), when: v.optional(v.string()), done: v.optional(v.boolean()) },
  handler: async (ctx, { id, ...fields }) => {
    const patch = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined));
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("adventures") },
  handler: async (ctx, { id }) => { await ctx.db.delete(id); },
});

/** Move an adventure one place earlier (dir -1) or later (+1) in the queue. */
export const move = mutation({
  args: { id: v.id("adventures"), dir: v.number() },
  handler: async (ctx, { id, dir }) => {
    const me = await ctx.db.get(id);
    if (!me) return;
    const list = (await ctx.db.query("adventures").withIndex("by_user", (q) => q.eq("userId", me.userId)).collect())
      .filter((a) => !a.done)
      .sort((a, b) => a.order - b.order);
    const i = list.findIndex((a) => a._id === id);
    const j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= list.length) return;
    await ctx.db.patch(list[i]._id, { order: list[j].order });
    await ctx.db.patch(list[j]._id, { order: list[i].order });
  },
});
