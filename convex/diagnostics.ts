/**
 * Read-only diagnostics for the email-import → review-queue pipeline.
 *
 * Use when the review queue is empty but bank-alert emails are arriving. An
 * empty queue is NOT a parse failure — even an unrecognised email is ingested
 * as an amount-0 "needs attention" row. So an empty queue means rows aren't
 * being created for the user you're viewing. The usual causes this surfaces:
 *
 *  - rowsTotal === 0: the forwarder never reached /import-email (bad/missing
 *    X-Import-Secret → 401, or BUCKETS_IMPORT_SECRET unset → 500), so nothing
 *    was ingested. Check `secretConfigured` and the Apps Script target URL.
 *  - rows exist but under a different userId than the one you log in as:
 *    `resolveImportUserId` attributes to the BUCKETS_IMPORT_EMAIL user, or
 *    falls back to the FIRST user when that env var is unset. If you have more
 *    than one user row, imports can land on the wrong account.
 *  - rows exist but all direction "in" / status "confirmed": alerts are being
 *    classified as money-received and routed to monthlyIncome, bypassing the
 *    pending queue.
 *
 * Run (single-user app):
 *   npx convex run diagnostics:importPipeline '{}'
 */

import { internalQuery } from './_generated/server';

export const importPipeline = internalQuery({
  args: {},
  handler: async ctx => {
    const users = await ctx.db.query('users').collect();

    const importEmail = process.env.BUCKETS_IMPORT_EMAIL || null;
    const secretConfigured = !!process.env.BUCKETS_IMPORT_SECRET;

    // Mirror resolveImportUserId so we can show who imports attribute to.
    let resolvedImportUser: { id: string; email?: string; name?: string } | null =
      null;
    if (importEmail) {
      const byEmail = users.find(u => u.email === importEmail);
      if (byEmail) {
        resolvedImportUser = {
          id: byEmail._id,
          email: byEmail.email,
          name: byEmail.name,
        };
      }
    }
    if (!resolvedImportUser && users[0]) {
      resolvedImportUser = {
        id: users[0]._id,
        email: users[0].email,
        name: users[0].name,
      };
    }

    const rows = await ctx.db.query('pendingTransactions').collect();

    const byStatus: Record<string, number> = {};
    const byDirection: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    for (const r of rows) {
      const status = String(r.status ?? 'unknown');
      const direction = String(r.direction ?? 'unknown');
      const uid = String(r.userId);
      byStatus[status] = (byStatus[status] || 0) + 1;
      byDirection[direction] = (byDirection[direction] || 0) + 1;
      byUser[uid] = (byUser[uid] || 0) + 1;
    }

    // Newest few rows for eyeballing, with the raw source trimmed out.
    const sample = [...rows]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map(r => ({
        userId: r.userId,
        bank: r.bank,
        direction: r.direction,
        amount: r.amount,
        merchant: r.merchant ?? null,
        status: r.status,
        date: new Date(r.date).toISOString(),
        createdAt: new Date(r.createdAt).toISOString(),
      }));

    return {
      config: {
        importEmail,
        secretConfigured,
        resolvedImportUser,
      },
      users: users.map(u => ({ id: u._id, email: u.email, name: u.name })),
      pendingTransactions: {
        total: rows.length,
        byStatus,
        byDirection,
        byUser,
        sample,
      },
    };
  },
});
