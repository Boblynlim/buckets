import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
} from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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
      direction: "out",
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
    return { status: "created" as const, id };
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

    // Month bucket from the transfer date (stored at UTC noon by the parser).
    const d = new Date(args.date);
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const note = args.merchant
      ? `Received from ${args.merchant}`
      : `Received via ${args.bank.toUpperCase()}`;

    const now = Date.now();
    const incomeId = await ctx.db.insert("monthlyIncome", {
      userId: userId as any,
      month,
      amount: args.amount,
      note,
      isConfirmed: true, // it's already in the account
      confirmedAt: now,
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
