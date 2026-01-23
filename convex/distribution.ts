import { v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import { Id, Doc } from './_generated/dataModel';

/**
 * Calculate and distribute income to all active buckets
 * This runs whenever:
 * - Income is added/changed
 * - Buckets are created/edited/deleted
 */
export const calculateDistribution = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Get total monthly income
    const incomeRecords = await ctx.db
      .query('income')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isRecurring'), true))
      .collect();

    const totalIncome = incomeRecords.reduce((sum, income) => sum + income.amount, 0);

    // Get all active buckets
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isActive'), true))
      .collect();

    // Calculate planned amounts for all spend and recurring buckets
    let totalPlanned = 0;
    const bucketPlans: { id: Id<'buckets'>; planned: number; mode: string }[] = [];

    for (const bucket of buckets) {
      if (bucket.bucketMode === 'spend' || bucket.bucketMode === 'recurring') {
        let planned = 0;

        // Check new fields first
        if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
          planned = (totalIncome * bucket.plannedPercent) / 100;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
          planned = bucket.plannedAmount;
        }
        // Fall back to legacy allocationValue if new fields not set
        else if (bucket.allocationValue !== undefined) {
          // Legacy buckets stored the actual value, need to check if it was percentage or amount
          // Assume it's a fixed amount for legacy buckets
          planned = bucket.allocationValue;
        }

        bucketPlans.push({
          id: bucket._id,
          planned,
          mode: bucket.bucketMode,
        });
        totalPlanned += planned;
      } else {
        // Save buckets don't consume income planning (they use separate contributions)
        bucketPlans.push({
          id: bucket._id,
          planned: 0,
          mode: 'save',
        });
      }
    }

    // Calculate funding distribution
    const isOverPlanned = totalPlanned > totalIncome;
    const fundingRatio = isOverPlanned ? totalIncome / totalPlanned : 1;

    // Update each bucket with funding
    for (const plan of bucketPlans) {
      if (plan.mode === 'spend' || plan.mode === 'recurring') {
        const funded = plan.planned * fundingRatio;
        await ctx.db.patch(plan.id, {
          fundedAmount: funded,
        });
      }
    }

    // Process save bucket contributions (only if not done this month)
    const now = Date.now();
    const currentMonth = new Date(now).getMonth();
    const currentYear = new Date(now).getFullYear();

    for (const bucket of buckets) {
      if (bucket.bucketMode === 'save' && bucket.contributionType !== 'none') {
        // Check if contribution already applied this month
        const lastContribution = bucket.lastContributionDate || 0;
        const lastMonth = new Date(lastContribution).getMonth();
        const lastYear = new Date(lastContribution).getFullYear();

        const alreadyContributedThisMonth =
          lastYear === currentYear && lastMonth === currentMonth;

        if (!alreadyContributedThisMonth) {
          let contribution = 0;

          if (bucket.contributionType === 'amount' && bucket.contributionAmount !== undefined) {
            contribution = bucket.contributionAmount;
          } else if (bucket.contributionType === 'percentage' && bucket.contributionPercent !== undefined) {
            contribution = (totalIncome * bucket.contributionPercent) / 100;
          }

          // Add contribution to current balance
          const newBalance = (bucket.currentBalance || 0) + contribution;
          await ctx.db.patch(bucket._id, {
            currentBalance: newBalance,
            lastContributionDate: now,
          });
        }
      }
    }

    console.log('Distribution completed:', {
      totalIncome,
      totalPlanned,
      bucketsUpdated: bucketPlans.length,
      isOverPlanned,
      fundingRatio,
    });

    return {
      totalIncome,
      totalPlanned,
      isOverPlanned,
      overPlannedBy: isOverPlanned ? totalPlanned - totalIncome : 0,
      fundingRatio,
    };
  },
});

/**
 * Get distribution status for a user
 */
export const getDistributionStatus = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    // Get total monthly income
    const incomeRecords = await ctx.db
      .query('income')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isRecurring'), true))
      .collect();

    const totalIncome = incomeRecords.reduce((sum, income) => sum + income.amount, 0);

    // Get all active spend buckets
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .filter(q => q.eq(q.field('isActive'), true))
      .collect();

    let totalPlanned = 0;
    let totalFunded = 0;

    for (const bucket of buckets) {
      if (bucket.bucketMode === 'spend') {
        let planned = 0;

        // Check new fields first
        if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
          planned = (totalIncome * bucket.plannedPercent) / 100;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
          planned = bucket.plannedAmount;
        }
        // Fall back to legacy allocationValue
        else if (bucket.allocationValue !== undefined) {
          planned = bucket.allocationValue;
        }

        totalPlanned += planned;
        totalFunded += bucket.fundedAmount || 0;
      }
    }

    const isOverPlanned = totalPlanned > totalIncome;
    const unallocated = totalIncome - totalFunded;

    return {
      totalIncome,
      totalPlanned,
      totalFunded,
      unallocated,
      isOverPlanned,
      overPlannedBy: isOverPlanned ? totalPlanned - totalIncome : 0,
    };
  },
});

/**
 * Get spent amount for a bucket (computed from expenses)
 */
export const getBucketSpent = query({
  args: { bucketId: v.id('buckets') },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_bucket', q => q.eq('bucketId', args.bucketId))
      .collect();

    const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    return totalSpent;
  },
});
