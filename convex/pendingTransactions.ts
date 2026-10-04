import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { learn, autoFile } from "./merchantRules";
import { incomeMonthFor } from "./lib/incomeMonth";
import { MutationCtx } from "./_generated/server";

/**
 * Record money in for the month it funds. If that month already has an entry
 * for about the same amount (e.g. a salary typed in by hand), the bank alert
 * confirms it instead of adding it twice.
 */
export async function recordIncome(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  date: number,
  note: string
): Promise<Id<"monthlyIncome">> {
  const month = incomeMonthFor(date);
  const rows = await ctx.db
    .query("monthlyIncome")
    .withIndex("by_user_month", (q) => q.eq("userId", userId).eq("month", month))
    .collect();
  const same = rows.find((r) => Math.abs(r.amount - amount) < 1);
  const now = Date.now();
  if (same) {
    await ctx.db.patch(same._id, { isConfirmed: true, confirmedAt: now });
    return same._id;
  }
  return await ctx.db.insert("monthlyIncome", { userId, month, amount, note, isConfirmed: true, confirmedAt: now });
}

/**
 * Resolve which user imported transactions belong to.
 *
 * Single-user for now: prefer the email in the BUCKETS_IMPORT_EMAIL env var,
 * else fall back to the only/first user. When this app goes multi-tenant, the
 * forwarding endpoint will carry a per-user token instead.
 */
async function resolveImportUserId(ctx: {
  db: any;
}): Promise<string | null> {
  const email = process.env.BUCKETS_IMPORT_EMAIL;
  if (email) {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();
    if (byEmail) return byEmail._id;
  }
  const first = await ctx.db.query("users").first();
  return first?._id ?? null;
}

/**
 * Ingest a parsed bank alert into the review queue.
 *
 * Called only by the /import-email HTTP action. Idempotent on dedupeKey so a
 * re-forwarded email (or a retry) never creates a duplicate pending row.
 */
export const ingest = internalMutation({
  args: {
    bank: v.string(),
    amount: v.number(),
    currency: v.string(),
    merchant: v.optional(v.string()),
    date: v.number(),
    last4: v.optional(v.string()),
    dedupeKey: v.string(),
    rawSource: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("in"), v.literal("out"))),
  },
  handler: async (ctx, args) => {
    const userId = await resolveImportUserId(ctx);
    if (!userId) {
      // No user to attribute this to — surface loudly, don't silently drop.
      console.error("import-email: no user found to attribute transaction");
      return { status: "no_user" as const };
    }

    // De-dup: if we've already seen this dedupeKey, do nothing.
    const existing = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_dedupe", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();
    if (existing) {
      return { status: "duplicate" as const, id: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("pendingTransactions", {
      userId: userId as any,
      bank: args.bank,
      direction: args.direction ?? "out",
      amount: args.amount,
      currency: args.currency,
      merchant: args.merchant,
      date: args.date,
      last4: args.last4,
      status: "pending",
      dedupeKey: args.dedupeKey,
      rawSource: args.rawSource,
      createdAt: now,
      updatedAt: now,
    });
    // File it straight away if this merchant has been filed before.
    const row = await ctx.db.get(id);
    const filed = row ? await autoFile(ctx, row) : "asked";
    return { status: filed === "asked" ? ("created" as const) : (filed as "filed" | "ignored"), id };
  },
});

/**
 * Auto-capture a received transfer as income.
 *
 * Money-in alerts (PayNow received, refunds) aren't spends, so instead of the
 * review queue they go straight into `monthlyIncome` (confirmed), mirroring
 * what monthlyIncome.add does — including the recurring-sync reconcile. A
 * confirmed pendingTransactions row is also written for de-dup + audit.
 */
export const ingestIncome = internalMutation({
  args: {
    bank: v.string(),
    amount: v.number(),
    currency: v.string(),
    merchant: v.optional(v.string()),
    date: v.number(),
    dedupeKey: v.string(),
    rawSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await resolveImportUserId(ctx);
    if (!userId) {
      console.error("import-email: no user found to attribute income");
      return { status: "no_user" as const };
    }

    const existing = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_dedupe", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();
    if (existing) {
      return { status: "duplicate" as const, id: existing._id };
    }

    const month = incomeMonthFor(args.date);
    const note = args.merchant
      ? `Received from ${args.merchant}`
      : `Received via ${args.bank.toUpperCase()}`;

    const now = Date.now();
    const incomeId = await recordIncome(ctx, userId as any, args.amount, args.date, note);

    // Payday: nudge to the check-in (only for pay-sized deposits; the import
    // only sends those here). Opening the notification starts the check-in.
    const funds = incomeMonthFor(args.date);
    const fundsName = new Date(Date.UTC(Number(funds.slice(0, 4)), Number(funds.slice(5)) - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
    await ctx.scheduler.runAfter(0, internal.pushNotificationActions.sendToUser, {
      userId: userId as any,
      title: "Payday",
      body: `$${Math.round(args.amount).toLocaleString("en-US")} is in. Five minutes to set up ${fundsName}?`,
      url: "/?checkin=1",
      tag: "payday",
    });

    const id = await ctx.db.insert("pendingTransactions", {
      userId: userId as any,
      bank: args.bank,
      direction: "in",
      amount: args.amount,
      currency: args.currency,
      merchant: args.merchant,
      date: args.date,
      status: "confirmed",
      confirmedIncomeId: incomeId,
      dedupeKey: args.dedupeKey,
      rawSource: args.rawSource,
      createdAt: now,
      updatedAt: now,
    });

    // Income changed → reconcile recurring auto-pays for that month, exactly
    // as monthlyIncome.add does.
    await ctx.runMutation(api.recurringSync.syncRecurringExpensesForMonth, {
      userId: userId as any,
      month,
    });

    return { status: "income" as const, id, incomeId };
  },
});

// A row "needs attention" when the parser wasn't confident: unrecognised bank,
// non-positive amount, or no merchant/description to anchor on. These are the
// ones the user most likely has to fix, so they sort to the very top.
function needsAttention(row: {
  bank: string;
  amount: number;
  merchant?: string;
}): boolean {
  return row.bank === "unknown" || !(row.amount > 0) || !row.merchant;
}

/**
 * Pending items for the review queue.
 *
 * Ordering: parse-error / low-confidence rows first (so the user never has to
 * scroll to find what needs fixing), then newest transaction first within each
 * group. The `needsAttention` flag is returned so the UI can highlight them.
 */
export const listPending = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "pending")
      )
      .collect();
    return rows
      .map((r) => ({ ...r, needsAttention: needsAttention(r) }))
      .sort((a, b) => {
        if (a.needsAttention !== b.needsAttention) {
          return a.needsAttention ? -1 : 1; // attention rows first
        }
        return b.date - a.date; // then newest first
      });
  },
});

/** Count of pending items — for a badge on the nav. */
export const pendingCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "pending")
      )
      .collect();
    return rows.length;
  },
});

/**
 * Confirm a pending transaction into a real expense.
 *
 * The user can override the parsed amount/merchant/date and must pick a bucket.
 * Delegates to expenses.create so auto-tagging and necessary-note detection run
 * exactly as they do for manual entry.
 */
export const confirm = mutation({
  args: {
    pendingId: v.id("pendingTransactions"),
    bucketId: v.id("buckets"),
    amount: v.optional(v.number()), // override parsed amount
    note: v.optional(v.string()), // override merchant-derived note
    date: v.optional(v.number()), // override parsed date
    worthIt: v.optional(v.boolean()),
    isNecessary: v.optional(v.boolean()), // explicit "necessary" choice from review
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending transaction not found");
    if (pending.status !== "pending") {
      throw new Error(`Transaction already ${pending.status}`);
    }

    const amount = args.amount ?? pending.amount;
    const note =
      args.note ?? pending.merchant ?? `${pending.bank.toUpperCase()} transaction`;
    const date = args.date ?? pending.date;

    const expenseId: Id<"expenses"> = await ctx.runMutation(api.expenses.create, {
      userId: pending.userId,
      bucketId: args.bucketId,
      amount,
      date,
      note,
      worthIt: args.worthIt,
    });

    // expenses.create auto-detects "necessary" from remembered notes; honor an
    // explicit choice from the review UI when given.
    if (args.isNecessary !== undefined) {
      await ctx.runMutation(api.expenses.markNecessary, {
        expenseId,
        isNecessary: args.isNecessary,
      });
    }

    await ctx.db.patch(args.pendingId, {
      status: "confirmed",
      suggestedBucketId: args.bucketId,
      confirmedExpenseId: expenseId,
      updatedAt: Date.now(),
    });
    // One filing is enough: next time this merchant files itself.
    await learn(ctx, pending.userId, pending.merchant, { bucketId: args.bucketId });
    return expenseId;
  },
});

/** Dismiss a pending transaction without creating an expense. */
export const dismiss = mutation({
  args: { pendingId: v.id("pendingTransactions") },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending transaction not found");
    await ctx.db.patch(args.pendingId, {
      status: "dismissed",
      updatedAt: Date.now(),
    });
  },
});

/** "This is money in": a queued row that was really income (e.g. salary). */
export const markAsIncome = mutation({
  args: { pendingId: v.id("pendingTransactions") },
  handler: async (ctx, { pendingId }) => {
    const row = await ctx.db.get(pendingId);
    if (!row) throw new Error("Pending transaction not found");
    if (row.status !== "pending") throw new Error(`Transaction already ${row.status}`);
    const note = row.merchant ? `Received from ${row.merchant}` : `Received via ${row.bank.toUpperCase()}`;
    const incomeId = await recordIncome(ctx, row.userId, row.amount, row.date, note);
    await ctx.db.patch(pendingId, {
      direction: "in",
      status: "confirmed",
      confirmedIncomeId: incomeId,
      updatedAt: Date.now(),
    });
    return { month: incomeMonthFor(row.date) };
  },
});

/**
 * "Can't remember": file it so it still counts as spending, under a retired
 * "Not sure" cup that never shows on the shelves. Teaches nothing.
 */
export const fileUnsure = mutation({
  args: { pendingId: v.id("pendingTransactions"), amount: v.optional(v.number()), note: v.optional(v.string()) },
  handler: async (ctx, { pendingId, amount, note }) => {
    const row = await ctx.db.get(pendingId);
    if (!row) throw new Error("Pending transaction not found");
    if (row.status !== "pending") throw new Error(`Transaction already ${row.status}`);
    const buckets = await ctx.db.query("buckets").withIndex("by_user", (q) => q.eq("userId", row.userId)).collect();
    let bucketId = buckets.find((b) => b.name === "Not sure")?._id;
    if (!bucketId) {
      bucketId = await ctx.db.insert("buckets", {
        userId: row.userId, name: "Not sure", bucketMode: "spend", allocationType: "amount", plannedAmount: 0,
        alertThreshold: 20, color: "#A89E92", createdAt: Date.now(), isActive: false,
      });
    }
    const expenseId: Id<"expenses"> = await ctx.runMutation(api.expenses.create, {
      userId: row.userId,
      bucketId,
      amount: amount ?? row.amount,
      date: row.date,
      note: note ?? row.merchant ?? `${row.bank.toUpperCase()} transaction`,
    });
    await ctx.db.patch(pendingId, { status: "confirmed", confirmedExpenseId: expenseId, updatedAt: Date.now() });
    return expenseId;
  },
});

/** What else happened the same day (Singapore time), to jog memory. */
export const sameDay = query({
  args: { pendingId: v.id("pendingTransactions") },
  handler: async (ctx, { pendingId }) => {
    const row = await ctx.db.get(pendingId);
    if (!row) return [];
    const SG = 8 * 3600 * 1000;
    const dayStart = Math.floor((row.date + SG) / 86400000) * 86400000 - SG;
    const dayEnd = dayStart + 86400000 - 1;
    const exps = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_date", (q) => q.eq("userId", row.userId).gte("date", dayStart).lte("date", dayEnd))
      .collect();
    const others = await ctx.db
      .query("pendingTransactions")
      .withIndex("by_user_status", (q) => q.eq("userId", row.userId).eq("status", "pending"))
      .collect();
    const items = [
      ...exps.filter((e) => !e.superseded && !e.isAutoGenerated).map((e) => ({ what: e.note, amount: e.amount })),
      ...others
        .filter((p) => p._id !== row._id && p.date >= dayStart && p.date <= dayEnd)
        .map((p) => ({ what: p.merchant ?? "Unnamed", amount: p.amount })),
    ];
    return items.slice(0, 6);
  },
});

/** Spends a payback could belong to: the last 60 days before it, closest amount first. */
export const paybackCandidates = query({
  args: { pendingId: v.id("pendingTransactions") },
  handler: async (ctx, { pendingId }) => {
    const row = await ctx.db.get(pendingId);
    if (!row) return [];
    const from = row.date - 60 * 86400000;
    const exps = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_date", (q) => q.eq("userId", row.userId).gte("date", from).lte("date", row.date + 86400000))
      .collect();
    const buckets = await ctx.db.query("buckets").withIndex("by_user", (q) => q.eq("userId", row.userId)).collect();
    const name = new Map(buckets.map((b) => [b._id, b.name]));
    return exps
      .filter((e) => !e.superseded && !e.isAutoGenerated && e.amount > 0)
      .map((e) => ({ id: e._id, note: e.note, amount: e.amount, date: e.date, cup: name.get(e.bucketId) ?? "" }))
      .sort((a, b) => {
        // Prefer spends at least as big as the payback, nearest in amount, then most recent.
        const fa = a.amount >= row.amount - 0.005 ? 0 : 1;
        const fb = b.amount >= row.amount - 0.005 ? 0 : 1;
        if (fa !== fb) return fa - fb;
        const da = Math.abs(a.amount - row.amount), db = Math.abs(b.amount - row.amount);
        if (Math.abs(da - db) > 0.005) return da - db;
        return b.date - a.date;
      })
      .slice(0, 8);
  },
});

/**
 * "Paid back": money in that repays (part of) a spend. Takes it off that
 * spend; a full payback removes the spend. The money in is not income.
 */
export const applyPayback = mutation({
  args: { pendingId: v.id("pendingTransactions"), expenseId: v.id("expenses") },
  handler: async (ctx, { pendingId, expenseId }) => {
    const row = await ctx.db.get(pendingId);
    const exp = await ctx.db.get(expenseId);
    if (!row || !exp) throw new Error("Not found");
    if (row.status !== "pending") throw new Error(`Transaction already ${row.status}`);
    const left = Math.round((exp.amount - row.amount) * 100) / 100;
    if (left <= 0.004) {
      await ctx.db.delete(expenseId);
    } else {
      await ctx.db.patch(expenseId, { amount: left, note: `${exp.note} (${row.merchant ?? "someone"} paid back $${row.amount.toFixed(2)})`, updatedAt: Date.now() });
    }
    await ctx.db.patch(pendingId, { status: "dismissed", direction: "in", updatedAt: Date.now() });
    return { removed: left <= 0.004, left: Math.max(0, left) };
  },
});
