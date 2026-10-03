import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { parseBankEmail } from "./lib/emailParsers";

// One-off: re-read already-imported bank alerts with the fixed parser.
// - Transfers out that were misread as income go back to the queue as money
//   out, and the bogus monthlyIncome rows they created are removed.
// - "Upcoming recurring transfer" reminders are dismissed.
// - Pending rows get their payee name filled in where it was missing.
// Confirmed rows (already expenses) are never touched. dryRun first.

// Paying the card bill moves money between my own accounts; the card
// purchases themselves are already counted one by one. Never spending.
const CARD_BILL = /^(jaz hsbc|hsbc credit card)$/i;

const FROM: Record<string, string> = {
  ocbc: "Notifications@ocbc.com",
  hsbc: "alerts@notification.hsbc.com.hk",
  dbs: "ibanking.alert@dbs.com",
  amex: "alerts@americanexpress.com",
};

export const run = internalMutation({
  args: { userId: v.id("users"), dryRun: v.boolean() },
  handler: async (ctx, { userId, dryRun }) => {
    const log: string[] = [];
    const rows = await ctx.db
      .query("pendingTransactions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    for (const r of rows) {
      if (!r.rawSource || r.status === "confirmed" && !r.confirmedIncomeId) continue;
      const p = parseBankEmail({
        from: FROM[r.bank] ?? "",
        subject: "",
        body: r.rawSource,
      });
      const day = new Date(r.date).toISOString().slice(0, 10);
      const label = `${day} $${r.amount}`;

      if (p.skip) {
        if (r.confirmedIncomeId) {
          const inc = await ctx.db.get(r.confirmedIncomeId);
          if (inc) {
            log.push(`${label}: remove income row made from a reminder`);
            if (!dryRun) await ctx.db.delete(inc._id);
          }
        }
        if (r.status !== "dismissed") {
          log.push(`${label}: dismiss reminder (${p.merchant ?? "?"})`);
          if (!dryRun) await ctx.db.patch(r._id, { status: "dismissed", confirmedIncomeId: undefined, updatedAt: Date.now() });
        }
        continue;
      }

      if ((r.direction ?? "out") === "in" && p.direction === "out") {
        if (r.confirmedIncomeId) {
          const inc = await ctx.db.get(r.confirmedIncomeId);
          if (inc) {
            log.push(`${label}: remove misread income row (${inc.month}, "${inc.note ?? ""}")`);
            if (!dryRun) await ctx.db.delete(inc._id);
          }
        }
        if (p.merchant && CARD_BILL.test(p.merchant)) {
          log.push(`${label}: dismiss card bill payment to "${p.merchant}" (not spending)`);
          if (!dryRun) {
            await ctx.db.patch(r._id, { direction: "out", merchant: p.merchant, status: "dismissed", confirmedIncomeId: undefined, updatedAt: Date.now() });
          }
          continue;
        }
        log.push(`${label}: back to the queue as money out to "${p.merchant ?? "?"}"`);
        if (!dryRun) {
          await ctx.db.patch(r._id, {
            direction: "out",
            merchant: p.merchant,
            status: "pending",
            confirmedIncomeId: undefined,
            updatedAt: Date.now(),
          });
        }
        continue;
      }

      if (r.status === "pending" && p.merchant && p.merchant !== r.merchant) {
        log.push(`${label}: name "${r.merchant ?? ""}" -> "${p.merchant}"`);
        if (!dryRun) await ctx.db.patch(r._id, { merchant: p.merchant, updatedAt: Date.now() });
      }
    }
    return { dryRun, count: log.length, changes: log };
  },
});
