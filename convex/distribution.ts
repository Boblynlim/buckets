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

    // Calculate planned amounts for all spend buckets
    let totalPlanned = 0;
    const bucketPlans: { id: Id<'buckets'>; planned: number; mode: string }[] = [];

    for (const bucket of buckets) {
      if (bucket.bucketMode === 'spend') {
        let planned = 0;

        if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
          planned = (totalIncome * bucket.plannedPercent) / 100;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
          planned = bucket.plannedAmount;
        }

        bucketPlans.push({
          id: bucket._id,
          planned,
          mode: 'spend',
        });
        totalPlanned += planned;
      } else {
        // Save buckets don't consume income planning
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
      if (plan.mode === 'spend') {
        const funded = plan.planned * fundingRatio;
        await ctx.db.patch(plan.id, {
          fundedAmount: funded,
        });
      }
    }

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

        if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
          planned = (totalIncome * bucket.plannedPercent) / 100;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
          planned = bucket.plannedAmount;
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
