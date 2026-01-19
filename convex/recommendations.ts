import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Analyze historical spending and recommend bucket amounts
 * Based on last 2-3 months of data with buffer
 */
export const getSpendingBucketRecommendations = query({
  args: {
    userId: v.id('users'),
    bucketId: v.optional(v.id('buckets')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threeMonthsAgo = now - (90 * 24 * 60 * 60 * 1000);

    // Get expenses from last 3 months
    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.gte(q.field('date'), threeMonthsAgo))
      .collect();

    if (args.bucketId) {
      // Recommendation for specific bucket
      const bucketExpenses = expenses.filter(e => e.bucketId === args.bucketId);

      if (bucketExpenses.length === 0) {
        return {
          hasData: false,
          message: 'Not enough data to recommend. Add some expenses first!',
        };
      }

      // Group by month
      const monthlyTotals: number[] = [];
      const monthBuckets: Record<string, number> = {};

      for (const expense of bucketExpenses) {
        const date = new Date(expense.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

        if (!monthBuckets[monthKey]) {
          monthBuckets[monthKey] = 0;
        }
        monthBuckets[monthKey] += expense.amount;
      }

      // Convert to array
      for (const month in monthBuckets) {
        monthlyTotals.push(monthBuckets[month]);
      }

      if (monthlyTotals.length === 0) {
        return {
          hasData: false,
          message: 'Not enough data to recommend.',
        };
      }

      // Calculate median
      monthlyTotals.sort((a, b) => a - b);
      const median = monthlyTotals[Math.floor(monthlyTotals.length / 2)];

      // Recommendations with different buffers
      const conservative = Math.ceil(median * 1.2); // 20% buffer
      const standard = Math.ceil(median * 1.15); // 15% buffer
      const aggressive = Math.ceil(median * 1.1); // 10% buffer

      return {
        hasData: true,
        monthsAnalyzed: monthlyTotals.length,
        medianSpend: median,
        recommendations: {
          conservative: {
            amount: conservative,
            description: `20% buffer above median ($${median.toFixed(2)})`,
          },
          standard: {
            amount: standard,
            description: `15% buffer above median ($${median.toFixed(2)})`,
          },
          aggressive: {
            amount: aggressive,
            description: `10% buffer above median ($${median.toFixed(2)})`,
          },
        },
      };
    } else {
      // Recommendations for all buckets
      const bucketRecommendations: Record<string, any> = {};

      // Get all active buckets
      const buckets = await ctx.db
        .query('buckets')
        .withIndex('by_user', (q) => q.eq('userId', args.userId))
        .filter((q) => q.eq(q.field('isActive'), true))
        .collect();

      for (const bucket of buckets) {
        const bucketExpenses = expenses.filter(e => e.bucketId === bucket._id);

        if (bucketExpenses.length > 0) {
          // Group by month
          const monthBuckets: Record<string, number> = {};

          for (const expense of bucketExpenses) {
            const date = new Date(expense.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

            if (!monthBuckets[monthKey]) {
              monthBuckets[monthKey] = 0;
            }
            monthBuckets[monthKey] += expense.amount;
          }

          const monthlyTotals = Object.values(monthBuckets);
          monthlyTotals.sort((a, b) => a - b);
          const median = monthlyTotals[Math.floor(monthlyTotals.length / 2)];

          bucketRecommendations[bucket._id] = {
            bucketName: bucket.name,
            currentPlanned: bucket.plannedAmount || bucket.plannedPercent || 0,
            medianSpend: median,
            recommended: Math.ceil(median * 1.15),
          };
        }
      }

      return {
        hasData: true,
        buckets: bucketRecommendations,
      };
    }
  },
});

/**
 * Calculate emergency fund recommendations
 */
export const getEmergencyFundRecommendation = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Get user's essential monthly expenses (needs)
    const now = Date.now();
    const threeMonthsAgo = now - (90 * 24 * 60 * 60 * 1000);

    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.gte(q.field('date'), threeMonthsAgo))
      .collect();

    // Calculate monthly essential expenses
    const monthBuckets: Record<string, { needs: number; total: number }> = {};

    for (const expense of expenses) {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

      if (!monthBuckets[monthKey]) {
        monthBuckets[monthKey] = { needs: 0, total: 0 };
      }

      monthBuckets[monthKey].total += expense.amount;

      if (expense.needsVsWants === 'need') {
        monthBuckets[monthKey].needs += expense.amount;
      }
    }

    const monthlyNeeds = Object.values(monthBuckets).map(m => m.needs);
    const monthlyTotals = Object.values(monthBuckets).map(m => m.total);

    if (monthlyNeeds.length === 0) {
      return {
        hasData: false,
        message: 'Add some expenses to get emergency fund recommendations.',
        starter: {
          amount: 1000,
          description: 'Starter emergency fund (recommended minimum)',
        },
      };
    }

    // Calculate average monthly needs
    const avgMonthlyNeeds = monthlyNeeds.reduce((a, b) => a + b, 0) / monthlyNeeds.length;
    const avgMonthlyTotal = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;

    return {
      hasData: true,
      monthsAnalyzed: monthlyNeeds.length,
      avgMonthlyNeeds,
      avgMonthlyTotal,
      recommendations: {
        starter: {
          amount: 1000,
          description: 'Starter emergency fund',
        },
        threeMonths: {
          amount: Math.ceil(avgMonthlyNeeds * 3),
          description: `3 months of essential expenses ($${avgMonthlyNeeds.toFixed(2)}/mo)`,
        },
        sixMonths: {
          amount: Math.ceil(avgMonthlyNeeds * 6),
          description: `6 months of essential expenses ($${avgMonthlyNeeds.toFixed(2)}/mo)`,
        },
        fullSixMonths: {
          amount: Math.ceil(avgMonthlyTotal * 6),
          description: `6 months of total expenses ($${avgMonthlyTotal.toFixed(2)}/mo)`,
        },
      },
    };
  },
});

/**
 * Get happiness ROI analysis
 * Shows which categories/buckets give best happiness per dollar
 */
export const getHappinessROI = query({
  args: {
    userId: v.id('users'),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId));

    if (args.startDate) {
      query = query.filter((q) => q.gte(q.field('date'), args.startDate!));
    }
    if (args.endDate) {
      query = query.filter((q) => q.lte(q.field('date'), args.endDate!));
    }

    const expenses = await query.collect();

    // Group by category
    const categoryData: Record<string, { totalSpent: number; totalHappiness: number; count: number }> = {};

    for (const expense of expenses) {
      const category = expense.category || 'Uncategorized';

      if (!categoryData[category]) {
        categoryData[category] = { totalSpent: 0, totalHappiness: 0, count: 0 };
      }

      categoryData[category].totalSpent += expense.amount;
      categoryData[category].totalHappiness += expense.happinessRating;
      categoryData[category].count += 1;
    }

    // Calculate ROI (happiness per dollar)
    const results = Object.entries(categoryData).map(([category, data]) => {
      const avgHappiness = data.totalHappiness / data.count;
      const happinessPerDollar = avgHappiness / (data.totalSpent / data.count);

      return {
        category,
        totalSpent: data.totalSpent,
        avgHappiness,
        happinessPerDollar,
        count: data.count,
      };
    });

    // Sort by happiness per dollar (descending)
    results.sort((a, b) => b.happinessPerDollar - a.happinessPerDollar);

    return results;
  },
});
