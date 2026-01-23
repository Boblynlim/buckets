import { v } from 'convex/values';
import { mutation, action, internalMutation } from './_generated/server';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';

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
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all active buckets for this user
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isActive'), true))
      .collect();

    // Get total recurring income for funding calculations
    const incomeRecords = await ctx.db
      .query('income')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isRecurring'), true))
      .collect();

    const totalIncome = incomeRecords.reduce((sum, income) => sum + income.amount, 0);

    const rolloverResults = [];

    for (const bucket of buckets) {
      if (bucket.bucketMode === 'spend') {
        // SPEND BUCKET ROLLOVER

        // Get all expenses for this bucket
        const expenses = await ctx.db
          .query('expenses')
          .withIndex('by_bucket', q => q.eq('bucketId', bucket._id))
          .collect();

        const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Calculate available balance before rollover
        const previousCarryover = bucket.carryoverBalance || 0;
        const thisMonthFunding = bucket.fundedAmount || 0;
        const totalAvailable = previousCarryover + thisMonthFunding;
        const unspent = totalAvailable - totalSpent;

        // Calculate new monthly funding
        let newMonthlyFunding = 0;
        if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
          newMonthlyFunding = (totalIncome * bucket.plannedPercent) / 100;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
          newMonthlyFunding = bucket.plannedAmount;
        }

        // Apply funding ratio if over-planned
        const allSpendBuckets = buckets.filter(b => b.bucketMode === 'spend');
        let totalPlanned = 0;
        for (const b of allSpendBuckets) {
          if (b.allocationType === 'percentage' && b.plannedPercent !== undefined) {
            totalPlanned += (totalIncome * b.plannedPercent) / 100;
          } else if (b.allocationType === 'amount' && b.plannedAmount !== undefined) {
            totalPlanned += b.plannedAmount;
          }
        }
        const fundingRatio = totalPlanned > totalIncome ? totalIncome / totalPlanned : 1;
        newMonthlyFunding = newMonthlyFunding * fundingRatio;

        // Update bucket with rollover
        await ctx.db.patch(bucket._id, {
          carryoverBalance: unspent, // Move unspent (or debt) to carryover
          fundedAmount: newMonthlyFunding, // Set new month's funding
          lastRolloverDate: now,
        });

        rolloverResults.push({
          bucketId: bucket._id,
          bucketName: bucket.name,
          bucketMode: 'spend',
          previousCarryover,
          thisMonthFunding,
          totalSpent,
          unspent,
          newMonthlyFunding,
          newTotalAvailable: unspent + newMonthlyFunding,
        });

      } else if (bucket.bucketMode === 'recurring') {
        // RECURRING BUCKET ROLLOVER
        // Auto-create expense for the recurring payment

        // Calculate monthly allocation
        let recurringAmount = 0;
        if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
          recurringAmount = (totalIncome * bucket.plannedPercent) / 100;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
          recurringAmount = bucket.plannedAmount;
        }

        // Apply funding ratio if over-planned (same as spend buckets)
        const allRecurringBuckets = buckets.filter(b => b.bucketMode === 'recurring' || b.bucketMode === 'spend');
        let totalPlanned = 0;
        for (const b of allRecurringBuckets) {
          if (b.allocationType === 'percentage' && b.plannedPercent !== undefined) {
            totalPlanned += (totalIncome * b.plannedPercent) / 100;
          } else if (b.allocationType === 'amount' && b.plannedAmount !== undefined) {
            totalPlanned += b.plannedAmount;
          }
        }
        const fundingRatio = totalPlanned > totalIncome ? totalIncome / totalPlanned : 1;
        recurringAmount = recurringAmount * fundingRatio;

        // Auto-create expense for this recurring payment
        if (recurringAmount > 0) {
          await ctx.db.insert('expenses', {
            userId: args.userId,
            bucketId: bucket._id,
            amount: recurringAmount,
            date: now,
            note: `Automatic recurring payment - ${bucket.name}`,
            happinessRating: 3, // Neutral rating for auto-generated expenses
            createdAt: now,
            updatedAt: now,
            isAutoGenerated: true,
          });
        }

        // Update lastRolloverDate
        await ctx.db.patch(bucket._id, {
          lastRolloverDate: now,
        });

        rolloverResults.push({
          bucketId: bucket._id,
          bucketName: bucket.name,
          bucketMode: 'recurring',
          recurringAmount,
          message: `Auto-paid $${recurringAmount.toFixed(2)}`,
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

    return {
      success: true,
      rolloverDate: now,
      bucketsProcessed: buckets.length,
      results: rolloverResults,
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
