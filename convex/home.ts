import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Everything the new home screen and payday check-in read, in one place.

const SHELVES = ["Everyday", "For me", "Saving up"] as const;
const SPENDABLE_SHELVES = new Set(["Everyday", "For me"]);

// Month boundaries in Singapore time (UTC+8), as ms timestamps.
export function monthRange(month: string): { start: number; end: number } {
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1) - 8 * 3600 * 1000;
  const end = Date.UTC(y, m, 1) - 8 * 3600 * 1000 - 1;
  return { start, end };
}

/** A cup's spends in [start, end], read by date range rather than all-time. */
export async function spendsBetween(ctx: QueryCtx, bucketId: Id<"buckets">, start: number, end: number) {
  const exps = await ctx.db
    .query("expenses")
    .withIndex("by_bucket_and_date", (q) => q.eq("bucketId", bucketId).gte("date", start).lte("date", end))
    .collect();
  return exps.filter((e) => !e.superseded);
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export const summary = query({
  args: { userId: v.id("users"), month: v.string() },
  handler: async (ctx, { userId, month }) => {
    const { start, end } = monthRange(month);
    const groups = await ctx.db.query("groups").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const groupName = new Map(groups.map((g) => [g._id, g.name]));
    const buckets = (
      await ctx.db.query("buckets").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    ).filter((b) => b.isActive);

    const spentOf = async (b: Doc<"buckets">) => {
      const exps = await spendsBetween(ctx, b._id, start, end);
      return exps.reduce((s, e) => s + e.amount, 0);
    };

    const spentBy = new Map(await Promise.all(buckets.map(async (b) => [b._id, await spentOf(b)] as const)));
    const shelves = [];
    let spendable = 0;
    for (const name of SHELVES) {
      const cups = [];
      for (const b of buckets.filter((x) => x.groupId && groupName.get(x.groupId) === name)) {
        const funded = b.fundedAmount ?? b.plannedAmount ?? 0;
        const carry = b.carryoverBalance ?? 0;
        const spent = spentBy.get(b._id) ?? 0;
        const full = Math.max(0, funded + carry);
        const left = funded + carry - spent;
        cups.push({ id: b._id, name: b.name, planned: b.plannedAmount ?? 0, funded, carry, spent, left, full });
      }
      cups.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
      const total = cups.reduce((s, c) => s + c.left, 0);
      if (SPENDABLE_SHELVES.has(name)) spendable += total;
      shelves.push({ name, total, cups });
    }

    // Money that goes out before spending: fixed bills (Tax, Parents...) and
    // regular investing (AIA). Not part of "yours to spend"; shown below it.
    const cupOf = (b: Doc<"buckets">) => {
      const funded = b.fundedAmount ?? b.plannedAmount ?? 0;
      const carry = b.carryoverBalance ?? 0;
      const spent = spentBy.get(b._id) ?? 0;
      return { id: b._id, name: b.name, planned: b.plannedAmount ?? 0, funded, carry, spent, left: funded + carry - spent, full: Math.max(0, funded + carry) };
    };
    const inGroup = (name: string) => buckets.filter((b) => b.groupId && groupName.get(b.groupId) === name).map(cupOf);
    const fixedCups = inGroup("Fixed");
    const investCups = inGroup("Investments");

    const goals = buckets
      .filter((b) => b.bucketMode === "save")
      .map((b) => ({ id: b._id, name: b.name, balance: b.currentBalance ?? 0, target: b.targetAmount ?? 0, monthly: b.contributionType === "amount" ? b.contributionAmount ?? 0 : 0 }));
    const earmarks = await ctx.db.query("earmarks").withIndex("by_user", (q) => q.eq("userId", userId)).collect();

    // Net worth: latest month on record vs the month before it.
    const accounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const snaps = await ctx.db.query("balanceSnapshots").withIndex("by_user_month", (q) => q.eq("userId", userId)).collect();
    const months = [...new Set(snaps.map((s) => s.month))].sort();
    const totalAt = (upTo: string) => {
      const last = new Map<Id<"accounts">, number>();
      for (const s of snaps.filter((x) => x.month <= upTo).sort((a, b) => a.month.localeCompare(b.month))) last.set(s.accountId, s.amount);
      let t = 0;
      for (const [, amt] of last) t += amt;
      return t;
    };
    const latest = months[months.length - 1] ?? null;
    const netWorth = latest
      ? { month: latest, total: totalAt(latest), change: months.length > 1 ? totalAt(latest) - totalAt(months[months.length - 2]) : 0 }
      : null;

    const pending = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "pending"))
      .collect();

    return {
      month,
      spendable,
      shelves,
      fixedCups,
      investCups,
      goals,
      earmarks: earmarks.map((e) => ({ name: e.name, amount: e.amount, goalBucketId: e.goalBucketId })),
      netWorth,
      accountsCount: accounts.filter((a) => a.isActive).length,
      pendingCount: pending.length,
      moneyInCount: pending.filter((p) => p.direction === "in").length,
      prevMonth: prevMonth(month),
    };
  },
});

// Fixed display order inside each shelf (matches the prototype).
const ORDER = [
  "Food", "Grocery", "Transport", "Maintenance",
  "Self care", "Fitness", "Shopping", "Entertainment",
  "Adventures", "Family trips", "Gifts", "Home decor", "Enrichment",
];

/** One cup's transactions this month, marking the ones filed automatically. */
export const cupTransactions = query({
  args: { bucketId: v.id("buckets"), month: v.string() },
  handler: async (ctx, { bucketId, month }) => {
    const { start, end } = monthRange(month);
    const bucket = await ctx.db.get(bucketId);
    if (!bucket) return [];
    const exps = (await spendsBetween(ctx, bucketId, start, end))
      .sort((a, b) => b.date - a.date);
    // Look up only this cup's spends (reading every imported email was slow).
    return await Promise.all(
      exps.map(async (e) => {
        const source = await ctx.db
          .query("pendingTransactions")
          .withIndex("by_confirmed_expense", (q) => q.eq("confirmedExpenseId", e._id))
          .first();
        return { id: e._id, note: e.note, amount: e.amount, date: e.date, autoFiled: !!source?.autoFiled };
      })
    );
  },
});

/** Last month, per shelf: what went in, what was spent, what stays. */
export const monthRecap = query({
  args: { userId: v.id("users"), month: v.string() },
  handler: async (ctx, { userId, month }) => {
    const { start, end } = monthRange(month);
    const groups = await ctx.db.query("groups").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const groupName = new Map(groups.map((g) => [g._id, g.name]));
    const buckets = (await ctx.db.query("buckets").withIndex("by_user", (q) => q.eq("userId", userId)).collect()).filter((b) => b.isActive);
    const out = [];
    for (const name of SHELVES) {
      const cups = [];
      for (const b of buckets.filter((x) => x.groupId && groupName.get(x.groupId) === name)) {
        const spent = (await spendsBetween(ctx, b._id, start, end)).reduce((s, e) => s + e.amount, 0);
        const had = (b.plannedAmount ?? 0) + (b.carryoverBalance ?? 0);
        cups.push({ id: b._id, name: b.name, had, spent, left: had - spent });
      }
      cups.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
      out.push({ name, cups, left: cups.reduce((s, c) => s + Math.max(0, c.left), 0) });
    }
    return out;
  },
});
