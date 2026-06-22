import { v } from 'convex/values';
import { mutation, action, internalMutation } from './_generated/server';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { monthKey, totalPlannedFor, fundingRatioFor } from './lib/recurring';

/**
 * Perform monthly rollover for all active buckets
 * This runs automatically on the 1st of each month
 *
 * For spend buckets:
 * - Calculates unspent amount: (fundedAmount + carryoverBalance) - spent
 * - Moves unspent to carryoverBalance for next month
 * - Re-funds the bucket with new monthly allocation
 *
 * For recurring buckets (investments, insurance):
 * - Calculates monthly allocation amount
 * - Auto-creates an expense for the recurring payment
 * - Marks expense as auto-generated
 *
 * For save buckets:
 * - Keeps accumulating until target is reached
 * - If below target, adds monthly contribution
 * - If at or above target, stops contributing (based on capBehavior)
 */
export const performMonthlyRollover = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    rolloverDate: number;
    bucketsProcessed: number;
    results: any[];
    recurring: { month: string; diff: any[] };
  }> => {
    const now = Date.now();

    // Get all active buckets for this user
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isActive'), true))
      .collect();

    // Get total income from per-month entries for the current month
    const nowDate = new Date();
    const currentMonth = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;

    const monthlyEntries = await ctx.db
      .query('monthlyIncome')
      .withIndex('by_user_month', q =>
        q.eq('userId', args.userId).eq('month', currentMonth)
      )
      .collect();

    const totalIncome = monthlyEntries.reduce((sum, entry) => sum + entry.amount, 0);

    const rolloverResults = [];

    for (const bucket of buckets) {
      if (bucket.bucketMode === 'spend' || bucket.bucketMode === 'recurring') {
        // SPEND & RECURRING BUCKET ROLLOVER
        //
        // Both modes carry forward over/underspend. Recurring buckets get an
        // auto-pay expense each month (created by the sync at the end of this
        // function); if the real bill differs from plan — or the user logs an
        // extra expense against the bucket — that difference must roll forward
        // as carryover/debt, exactly like a spend bucket. The old code skipped
        // this for recurring buckets and only bumped lastRolloverDate, which
        // silently dropped recurring overspend (e.g. an insurance overpayment
        // never carried into the next month, so the bucket looked like it had
        // excess instead of a debt).

        // Only count expenses from the cycle being rolled over.
        // Using all-time expenses would double-count historical spending across rollover cycles.
        const prevMonthEnd = now;
        const prevMonthStart = new Date(now);
        prevMonthStart.setDate(1);       // 1st of this month
        prevMonthStart.setHours(0, 0, 0, 0);

        // Last rollover date tells us when the previous cycle started
        const cycleStart = bucket.lastRolloverDate
          ? bucket.lastRolloverDate
          : prevMonthStart.getTime() - (31 * 24 * 60 * 60 * 1000); // fallback: ~31 days ago

        const allExpenses = await ctx.db
          .query('expenses')
          .withIndex('by_bucket', q => q.eq('bucketId', bucket._id))
          .collect();

        // Only count expenses that occurred during the just-ended cycle
        const periodExpenses = allExpenses.filter(
          e => e.date >= cycleStart && e.date <= prevMonthEnd
        );

        const totalSpent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Calculate available balance before rollover
        const previousCarryover = bucket.carryoverBalance || 0;
        const thisMonthFunding = bucket.fundedAmount || 0;
        const totalAvailable = previousCarryover + thisMonthFunding;
        const unspent = totalAvailable - totalSpent;

        // Calculate new monthly funding. Use the SAME planned base and funding
        // ratio that the recurring sync (computeRecurringAmount) uses, so a
        // recurring bucket's fundedAmount and its auto-pay expense match. If
        // they used different ratios, even a perfectly-on-plan recurring bucket
        // would generate a phantom carryover every month. The shared helpers
        // count both spend and recurring buckets in the denominator (matching
        // distribution.ts), so spend buckets fund consistently here too.
        let base = 0;
        if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
          base = (totalIncome * bucket.plannedPercent) / 100;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
          base = bucket.plannedAmount;
        }
        const totalPlanned = totalPlannedFor(buckets as any, totalIncome);
        const fundingRatio = fundingRatioFor(totalIncome, totalPlanned);
        const newMonthlyFunding = base * fundingRatio;

        // Update bucket with rollover
        await ctx.db.patch(bucket._id, {
          carryoverBalance: unspent, // Move unspent (or debt) to carryover
          fundedAmount: newMonthlyFunding, // Set new month's funding
          lastRolloverDate: now,
        });

        rolloverResults.push({
          bucketId: bucket._id,
          bucketName: bucket.name,
          bucketMode: bucket.bucketMode,
          previousCarryover,
          thisMonthFunding,
          totalSpent,
          unspent,
          newMonthlyFunding,
          newTotalAvailable: unspent + newMonthlyFunding,
        });

      } else {
        // SAVE BUCKET ROLLOVER

        const currentBalance = bucket.currentBalance || 0;
        const targetAmount = bucket.targetAmount || 0;
        const capBehavior = bucket.capBehavior || 'stop';

        // Check if we should contribute this month
        let monthlyContribution = 0;

        if (currentBalance < targetAmount || capBehavior !== 'stop') {
          // Calculate contribution amount
          if (bucket.contributionType === 'percentage' && bucket.contributionPercent !== undefined) {
            monthlyContribution = (totalIncome * bucket.contributionPercent) / 100;
          } else if (bucket.contributionType === 'amount' && bucket.contributionAmount !== undefined) {
            monthlyContribution = bucket.contributionAmount;
          }

          // If we're close to target, only contribute what's needed
          if (capBehavior === 'stop' && currentBalance + monthlyContribution > targetAmount) {
            monthlyContribution = Math.max(0, targetAmount - currentBalance);
          }

          // Add contribution to current balance
          const newBalance = currentBalance + monthlyContribution;

          await ctx.db.patch(bucket._id, {
            currentBalance: newBalance,
            lastRolloverDate: now,
          });

          rolloverResults.push({
            bucketId: bucket._id,
            bucketName: bucket.name,
            bucketMode: 'save',
            previousBalance: currentBalance,
            monthlyContribution,
            newBalance,
            targetAmount,
            percentOfGoal: targetAmount > 0 ? (newBalance / targetAmount) * 100 : 0,
          });
        } else {
          // Target reached, no contribution
          await ctx.db.patch(bucket._id, {
            lastRolloverDate: now,
          });

          rolloverResults.push({
            bucketId: bucket._id,
            bucketName: bucket.name,
            bucketMode: 'save',
            previousBalance: currentBalance,
            monthlyContribution: 0,
            newBalance: currentBalance,
            targetAmount,
            percentOfGoal: 100,
            message: 'Target reached - no contribution this month',
          });
        }
      }
    }

    // Reconcile recurring auto-pays for this month after spend/save buckets
    // have settled. Idempotent — picks up any buckets that flipped to
    // recurring since the last call.
    const recurringDiff = await ctx.runMutation(
      api.recurringSync.syncRecurringExpensesForMonth,
      { userId: args.userId, month: monthKey(now) },
    );

    return {
      success: true,
      rolloverDate: now,
      bucketsProcessed: buckets.length,
      results: rolloverResults,
      recurring: recurringDiff,
    };
  },
});

/**
 * Check if rollover is needed and perform it
 * This can be called manually or by a scheduled function
 */
export const checkAndPerformRollover = action({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args): Promise<{
    performed: boolean;
    message?: string;
    currentDate?: string;
    lastRolloverDate?: string;
    bucketsRolledOver?: number;
    totalCarryover?: number;
  }> => {
    // Check if we're on the 1st of the month
    const now = new Date();
    const isFirstOfMonth = now.getDate() === 1;

    if (!isFirstOfMonth) {
      return {
        performed: false,
        message: 'Not the 1st of the month yet',
        currentDate: now.toISOString(),
      };
    }

    // Check if we've already rolled over this month
    const buckets = await ctx.runQuery(api.buckets.getByUser, {
      userId: args.userId,
    });

    if (buckets.length === 0) {
      return {
        performed: false,
        message: 'No buckets to roll over',
      };
    }

    // Check the most recent rollover date
    const mostRecentRollover = Math.max(
      ...buckets.map((b: any) => b.lastRolloverDate || 0)
    );

    const lastRolloverDate = mostRecentRollover > 0 ? new Date(mostRecentRollover) : null;

    // If we've already rolled over this month, skip
    if (lastRolloverDate) {
      const lastRolloverMonth = lastRolloverDate.getMonth();
      const lastRolloverYear = lastRolloverDate.getFullYear();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      if (lastRolloverMonth === currentMonth && lastRolloverYear === currentYear) {
        return {
          performed: false,
          message: 'Rollover already performed this month',
          lastRolloverDate: lastRolloverDate.toISOString(),
        };
      }
    }

    // Perform the rollover
    const result: any = await ctx.runMutation(api.rollover.performMonthlyRollover, {
      userId: args.userId,
    });

    return {
      performed: true,
      ...result,
    };
  },
});

/**
 * Manual rollover trigger (for testing or user-initiated rollover)
 */
export const manualRollover = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args): Promise<any> => {
    // Just call the rollover function directly
    return await ctx.runMutation(api.rollover.performMonthlyRollover, {
      userId: args.userId,
    });
  },
});

/**
 * Scheduled rollover - runs automatically on the 1st of each month
 * This is called by the cron job and processes all users
 */
export const runScheduledRollover = internalMutation({
  args: {},
  handler: async (ctx): Promise<{
    processedAt: number;
    totalUsers: number;
    results: any[];
  }> => {
    // Get all users
    const users = await ctx.db.query('users').collect();

    const results: any[] = [];

    for (const user of users) {
      try {
        const result: any = await ctx.runMutation(api.rollover.performMonthlyRollover, {
          userId: user._id,
        });

        results.push({
          userId: user._id,
          userName: user.name,
          success: true,
          ...result,
        });
      } catch (error: any) {
        console.error(`Failed to rollover for user ${user._id}:`, error);
        results.push({
          userId: user._id,
          userName: user.name,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      processedAt: Date.now(),
      totalUsers: users.length,
      results,
    };
  },
});
