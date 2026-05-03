import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { api } from './_generated/api';

// Get all income entries for a specific month
export const getByMonth = query({
  args: {
    userId: v.id('users'),
    month: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('monthlyIncome')
      .withIndex('by_user_month', q =>
        q.eq('userId', args.userId).eq('month', args.month)
      )
      .collect();
  },
});

// Seed a month from the previous month's entries (unconfirmed).
// Returns the entries for the month (existing or newly seeded).
export const seedMonth = mutation({
  args: {
    userId: v.id('users'),
    month: v.string(), // "2026-04"
  },
  handler: async (ctx, args) => {
    // Check if this month already has entries
    const existing = await ctx.db
      .query('monthlyIncome')
      .withIndex('by_user_month', q =>
        q.eq('userId', args.userId).eq('month', args.month)
      )
      .collect();

    if (existing.length > 0) return existing;

    // Find the most recent month that has entries (walk backwards up to 12 months)
    const [yearStr, monthStr] = args.month.split('-');
    let year = parseInt(yearStr);
    let month = parseInt(monthStr);

    for (let i = 0; i < 12; i++) {
      month--;
      if (month < 1) {
        month = 12;
        year--;
      }
      const prevMonth = `${year}-${String(month).padStart(2, '0')}`;
      const prevEntries = await ctx.db
        .query('monthlyIncome')
        .withIndex('by_user_month', q =>
          q.eq('userId', args.userId).eq('month', prevMonth)
        )
        .collect();

      if (prevEntries.length > 0) {
        // Copy entries as unconfirmed
        const newEntries = [];
        for (const entry of prevEntries) {
          const id = await ctx.db.insert('monthlyIncome', {
            userId: args.userId,
            month: args.month,
            amount: entry.amount,
            note: entry.note,
            isConfirmed: false,
          });
          const doc = await ctx.db.get(id);
          if (doc) newEntries.push(doc);
        }
        // Income for this month just materialized — recurring auto-pays may
        // need to appear too.
        await ctx.runMutation(api.recurringSync.syncRecurringExpensesForMonth, {
          userId: args.userId,
          month: args.month,
        });
        return newEntries;
      }
    }

    // No previous month found — return empty
    return [];
  },
});

// Add a new income entry for a month
export const add = mutation({
  args: {
    userId: v.id('users'),
    month: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('monthlyIncome', {
      userId: args.userId,
      month: args.month,
      amount: args.amount,
      note: args.note,
      isConfirmed: false,
    });
    // Income changed → funding ratio + amount-based / pct-based plans for that
    // month change too. Reconcile the recurring auto-pays for this month.
    await ctx.runMutation(api.recurringSync.syncRecurringExpensesForMonth, {
      userId: args.userId,
      month: args.month,
    });
    return id;
  },
});

// Update an income entry (amount, note)
export const update = mutation({
  args: {
    entryId: v.id('monthlyIncome'),
    amount: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error('Entry not found');
    const patch: Record<string, any> = {};
    if (args.amount !== undefined) patch.amount = args.amount;
    if (args.note !== undefined) patch.note = args.note;
    await ctx.db.patch(args.entryId, patch);
    if (args.amount !== undefined && args.amount !== entry.amount) {
      await ctx.runMutation(api.recurringSync.syncRecurringExpensesForMonth, {
        userId: entry.userId,
        month: entry.month,
      });
    }
    return { success: true };
  },
});

// Delete an income entry (only affects this month)
export const remove = mutation({
  args: { entryId: v.id('monthlyIncome') },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error('Entry not found');
    await ctx.db.delete(args.entryId);
    await ctx.runMutation(api.recurringSync.syncRecurringExpensesForMonth, {
      userId: entry.userId,
      month: entry.month,
    });
    return { success: true };
  },
});

// Confirm/unconfirm an income entry
export const toggleConfirm = mutation({
  args: { entryId: v.id('monthlyIncome') },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error('Entry not found');
    await ctx.db.patch(args.entryId, {
      isConfirmed: !entry.isConfirmed,
      confirmedAt: !entry.isConfirmed ? Date.now() : undefined,
    });
    return { success: true, isConfirmed: !entry.isConfirmed };
  },
});

// Migrate legacy global income entries into monthlyIncome for the current month.
// Idempotent — skips entries that already exist (matched by amount + note).
export const migrateFromLegacy = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get legacy recurring income
    const legacyEntries = await ctx.db
      .query('income')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isRecurring'), true))
      .collect();

    if (legacyEntries.length === 0) return { migrated: 0 };

    // Get existing monthly entries for current month
    const existing = await ctx.db
      .query('monthlyIncome')
      .withIndex('by_user_month', q =>
        q.eq('userId', args.userId).eq('month', currentMonth)
      )
      .collect();

    // Build a set of existing entries to avoid duplicates
    const existingKeys = new Set(
      existing.map(e => `${e.amount}|${e.note || ''}`)
    );

    let migrated = 0;
    for (const legacy of legacyEntries) {
      const key = `${legacy.amount}|${legacy.note || ''}`;
      if (!existingKeys.has(key)) {
        await ctx.db.insert('monthlyIncome', {
          userId: args.userId,
          month: currentMonth,
          amount: legacy.amount,
          note: legacy.note,
          isConfirmed: false,
        });
        migrated++;
      }
    }

    // Clean up legacy entries after migration
    for (const legacy of legacyEntries) {
      await ctx.db.delete(legacy._id);
    }

    return { migrated };
  },
});

// Get total income for the current month (used by distribution)
export const getCurrentMonthTotal = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const entries = await ctx.db
      .query('monthlyIncome')
      .withIndex('by_user_month', q =>
        q.eq('userId', args.userId).eq('month', currentMonth)
      )
      .collect();

    return entries.reduce((sum, e) => sum + e.amount, 0);
  },
});
