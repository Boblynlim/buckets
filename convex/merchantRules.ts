import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { merchantKey, isPaymentCompany } from "./lib/merchantKey";
import { addInvestment } from "./accounts";

// Learned filing: file a merchant once and its next transactions file
// themselves. Payment-company names never learn (they always ask).

export async function learn(
  ctx: MutationCtx,
  userId: Id<"users">,
  merchant: string | undefined,
  target: { bucketId: Id<"buckets"> } | { ignore: true } | { accountId: Id<"accounts"> }
) {
  if (isPaymentCompany(merchant)) return;
  const key = merchantKey(merchant);
  const existing = await ctx.db
    .query("merchantRules")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
    .first();
  const fields = {
    bucketId: "bucketId" in target ? target.bucketId : undefined,
    ignore: "ignore" in target ? true : undefined,
    accountId: "accountId" in target ? target.accountId : undefined,
    example: merchant,
    updatedAt: Date.now(),
  };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("merchantRules", { userId, key, ...fields });
}

async function ruleFor(ctx: MutationCtx, userId: Id<"users">, merchant: string | undefined) {
  if (isPaymentCompany(merchant)) return null;
  const rule = await ctx.db
    .query("merchantRules")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", merchantKey(merchant)))
    .first();
  if (!rule) return null;
  if (rule.bucketId) {
    const bucket = await ctx.db.get(rule.bucketId);
    if (!bucket || !bucket.isActive) return null; // cup gone: ask again
  }
  if (rule.accountId) {
    const acct = await ctx.db.get(rule.accountId);
    if (!acct || !acct.isActive) return null;
  }
  return rule;
}

// Apply a learned rule to one pending row. Returns what happened.
export async function autoFile(
  ctx: MutationCtx,
  row: Doc<"pendingTransactions">
): Promise<"filed" | "ignored" | "asked"> {
  if (row.status !== "pending") return "asked";
  const rule = await ruleFor(ctx, row.userId, row.merchant);
  if (!rule) return "asked";
  // Money in only ever matches a "not spending" rule (e.g. an insurer's refunds).
  if ((row.direction ?? "out") === "in" && !rule.ignore) return "asked";
  const now = Date.now();
  if (rule.ignore) {
    await ctx.db.patch(row._id, { status: "dismissed", autoFiled: true, updatedAt: now });
    return "ignored";
  }
  if (rule.accountId) {
    if ((row.direction ?? "out") === "in") return "asked";
    await addInvestment(ctx, rule.accountId, row.amount, row.date);
    await ctx.db.patch(row._id, { status: "dismissed", autoFiled: true, updatedAt: now });
    return "ignored";
  }
  const expenseId: Id<"expenses"> = await ctx.runMutation(api.expenses.create, {
    userId: row.userId,
    bucketId: rule.bucketId!,
    amount: row.amount,
    date: row.date,
    note: row.merchant ?? `${row.bank.toUpperCase()} transaction`,
  });
  await ctx.db.patch(row._id, {
    status: "confirmed",
    suggestedBucketId: rule.bucketId,
    confirmedExpenseId: expenseId,
    autoFiled: true,
    updatedAt: now,
  });
  return "filed";
}

/** Not spending (card bill, transfer between my own accounts): dismiss and remember. */
export const markNotSpending = mutation({
  args: { pendingId: v.id("pendingTransactions") },
  handler: async (ctx, { pendingId }) => {
    const row = await ctx.db.get(pendingId);
    if (!row) throw new Error("Pending transaction not found");
    await ctx.db.patch(pendingId, { status: "dismissed", updatedAt: Date.now() });
    await learn(ctx, row.userId, row.merchant, { ignore: true });
  },
});

/** Money moved into an investment: add it to that account and remember. */
export const markInvested = mutation({
  args: { pendingId: v.id("pendingTransactions"), accountId: v.id("accounts") },
  handler: async (ctx, { pendingId, accountId }) => {
    const row = await ctx.db.get(pendingId);
    if (!row) throw new Error("Pending transaction not found");
    if (row.status !== "pending") throw new Error(`Transaction already ${row.status}`);
    const acct = await ctx.db.get(accountId);
    if (!acct || acct.userId !== row.userId) throw new Error("Account not found");
    await addInvestment(ctx, accountId, row.amount, row.date);
    await ctx.db.patch(pendingId, { status: "dismissed", updatedAt: Date.now() });
    await learn(ctx, row.userId, row.merchant, { accountId });
  },
});

/**
 * Move an auto-filed (or any imported) expense to another cup. Updates the
 * rule so that merchant goes there from now on.
 */
export const refile = mutation({
  args: { expenseId: v.id("expenses"), bucketId: v.id("buckets") },
  handler: async (ctx, { expenseId, bucketId }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new Error("Expense not found");
    await ctx.db.patch(expenseId, { bucketId, updatedAt: Date.now() });
    const source = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_user_status", (q) => q.eq("userId", expense.userId).eq("status", "confirmed"))
      .filter((q) => q.eq(q.field("confirmedExpenseId"), expenseId))
      .first();
    if (source) {
      await ctx.db.patch(source._id, { suggestedBucketId: bucketId, updatedAt: Date.now() });
      await learn(ctx, expense.userId, source.merchant, { bucketId });
    }
  },
});

/** Auto-filed rows since a date, grouped by merchant, for "Filed for you". */
export const filedForYou = query({
  args: { userId: v.id("users"), since: v.number() },
  handler: async (ctx, { userId, since }) => {
    const rows = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "confirmed"))
      .collect();
    const groups = new Map<string, { merchant: string; bucketId?: Id<"buckets">; count: number; total: number; expenseIds: Id<"expenses">[] }>();
    for (const r of rows) {
      if (!r.autoFiled || r.date < since) continue;
      const key = merchantKey(r.merchant);
      const g = groups.get(key) ?? { merchant: r.merchant ?? key, bucketId: r.suggestedBucketId, count: 0, total: 0, expenseIds: [] };
      g.count += 1;
      g.total += r.amount;
      if (r.confirmedExpenseId) g.expenseIds.push(r.confirmedExpenseId);
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.total - a.total);
  },
});

// ---------------------------------------------------------------------------
// One-off backfill: learn from what was already filed, seed the known
// transfers, then file the waiting queue. Rows matching a manually logged
// expense (same amount within a day) are dismissed as duplicates.
export const backfill = internalMutation({
  args: { userId: v.id("users"), dryRun: v.boolean() },
  handler: async (ctx, { userId, dryRun }) => {
    const log: string[] = [];
    const buckets = await ctx.db.query("buckets").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const byName = (n: string) => buckets.find((b) => b.isActive && b.name === n)?._id;
    const nameOf = (id?: Id<"buckets">) => buckets.find((b) => b._id === id)?.name ?? "?";

    const rows = await ctx.db.query("pendingTransactions").filter((q) => q.eq(q.field("userId"), userId)).collect();

    // 1. Learn from confirmed rows (latest filing wins; that is "one filing").
    const learned = new Map<string, { merchant?: string; bucketId: Id<"buckets">; date: number }>();
    for (const r of rows) {
      if (r.status !== "confirmed" || !r.confirmedExpenseId || isPaymentCompany(r.merchant)) continue;
      const exp = await ctx.db.get(r.confirmedExpenseId);
      if (!exp) continue;
      const key = merchantKey(r.merchant);
      const prev = learned.get(key);
      if (!prev || r.date > prev.date) learned.set(key, { merchant: r.merchant, bucketId: exp.bucketId, date: r.date });
    }
    // 2. Known transfers from the replan.
    const seeds: Array<[string, { bucketId: Id<"buckets"> } | { ignore: true } | null]> = [
      ["House", byName("Shared account") ? { bucketId: byName("Shared account")! } : null],
      ["UOB KAY HIAN P L", byName("Endowus") ? { bucketId: byName("Endowus")! } : null],
      ["Ibkr", byName("IBKR") ? { bucketId: byName("IBKR")! } : null],
      ["Jaz hsbc", { ignore: true }],
      ["HSBC CREDIT CARD", { ignore: true }],
      // Told by Jaz on 3 Oct: the two $300 PayNows on the same day are parents.
      ["MX LIX SOXX MEXX", byName("Parents") ? { bucketId: byName("Parents")! } : null],
      ["ONX HWXX LEX", byName("Parents") ? { bucketId: byName("Parents")! } : null],
      ["STREET STRENGTH BY SCA PTE", byName("Fitness") ? { bucketId: byName("Fitness")! } : null],
      ["SURE AESTHETIC PTE. LTD", byName("Self care") ? { bucketId: byName("Self care")! } : null],
      ["Qas*7am Hair Pte Ltd", byName("Self care") ? { bucketId: byName("Self care")! } : null],
    ];
    for (const l of learned.values()) {
      log.push(`learn "${merchantKey(l.merchant)}" -> ${nameOf(l.bucketId)}`);
      if (!dryRun) await learn(ctx, userId, l.merchant, { bucketId: l.bucketId });
    }
    for (const [m, t] of seeds) {
      if (!t) continue;
      log.push(`seed "${merchantKey(m)}" -> ${"ignore" in t ? "not spending" : nameOf(t.bucketId)}`);
      if (!dryRun) await learn(ctx, userId, m, t);
    }

    // 3. File the queue.
    const manual = await ctx.db.query("expenses").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const linked = new Set(rows.map((r) => r.confirmedExpenseId).filter(Boolean) as Id<"expenses">[]);
    const counts = { filed: 0, ignored: 0, duplicate: 0, asked: 0 };
    const askedNames = new Map<string, number>();
    const DAY = 36 * 3600 * 1000;
    const rules = new Map<string, { bucketId?: Id<"buckets">; ignore?: boolean }>();
    for (const l of learned.values()) rules.set(merchantKey(l.merchant), { bucketId: l.bucketId });
    for (const [m, t] of seeds) if (t) rules.set(merchantKey(m), "ignore" in t ? { ignore: true } : { bucketId: t.bucketId });

    for (const r of rows) {
      if (r.status !== "pending" || (r.direction ?? "out") !== "out") continue;
      const dup = manual.find((e) => !linked.has(e._id) && !e.isAutoGenerated && Math.abs(e.amount - r.amount) < 0.005 && Math.abs(e.date - r.date) <= DAY);
      if (dup) {
        counts.duplicate++;
        linked.add(dup._id);
        log.push(`duplicate of logged "${dup.note}" $${r.amount} -> dismiss`);
        if (!dryRun) await ctx.db.patch(r._id, { status: "dismissed", updatedAt: Date.now() });
        continue;
      }
      if (dryRun) {
        const rule = isPaymentCompany(r.merchant) ? undefined : rules.get(merchantKey(r.merchant));
        if (rule?.ignore) counts.ignored++;
        else if (rule?.bucketId) counts.filed++;
        else {
          counts.asked++;
          askedNames.set(r.merchant ?? "(no name)", (askedNames.get(r.merchant ?? "(no name)") ?? 0) + 1);
        }
        continue;
      }
      const res = await autoFile(ctx, r);
      if (res === "filed") counts.filed++;
      else if (res === "ignored") counts.ignored++;
      else {
        counts.asked++;
        askedNames.set(r.merchant ?? "(no name)", (askedNames.get(r.merchant ?? "(no name)") ?? 0) + 1);
      }
    }
    const stillAsking = [...askedNames.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}${c > 1 ? " x" + c : ""}`);
    return { dryRun, counts, stillAsking, changes: log };
  },
});
