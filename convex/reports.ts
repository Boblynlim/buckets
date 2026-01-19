import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { api } from './_generated/api';

/**
 * Report Generation System
 * Generates weekly reflective and monthly strategic reports
 */

// Generate weekly reflective report
export const generateWeeklyReport = mutation({
  args: {
    userId: v.id('users'),
    periodStart: v.optional(v.number()), // If not provided, use last 7 days
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodEnd = args.periodEnd || now;
    const periodStart = args.periodStart || (periodEnd - (7 * 24 * 60 * 60 * 1000));

    // Get expenses for the period
    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) =>
        q.and(
          q.gte(q.field('date'), periodStart),
          q.lte(q.field('date'), periodEnd)
        )
      )
      .collect();

    // Get previous period for comparison
    const prevPeriodStart = periodStart - (7 * 24 * 60 * 60 * 1000);
    const prevExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) =>
        q.and(
          q.gte(q.field('date'), prevPeriodStart),
          q.lt(q.field('date'), periodStart)
        )
      )
      .collect();

    // Calculate spending analysis
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const prevTotalSpent = prevExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Group by category
    const categoryTotals: Record<string, number> = {};
    for (const expense of expenses) {
      const category = expense.category || 'Uncategorized';
      categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;
    }

    const topCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentOfTotal: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Calculate happiness analysis
    const happinessByCategory: Record<string, { total: number; count: number; spent: number }> = {};
    for (const expense of expenses) {
      const category = expense.category || 'Uncategorized';
      if (!happinessByCategory[category]) {
        happinessByCategory[category] = { total: 0, count: 0, spent: 0 };
      }
      happinessByCategory[category].total += expense.happinessRating;
      happinessByCategory[category].count += 1;
      happinessByCategory[category].spent += expense.amount;
    }

    const categoryHappiness = Object.entries(happinessByCategory).map(([category, data]) => ({
      category,
      avgHappiness: data.total / data.count,
      roi: (data.total / data.count) / (data.spent / data.count),
      spent: data.spent,
    }));

    const topHappyCategories = categoryHappiness
      .sort((a, b) => b.avgHappiness - a.avgHappiness)
      .slice(0, 3);

    const concerningCategories = categoryHappiness
      .filter(c => c.avgHappiness < 3)
      .map(c => ({
        category: c.category,
        avgHappiness: c.avgHappiness,
        reason: c.avgHappiness < 2 ? 'Very low happiness' : 'Below average happiness',
      }))
      .slice(0, 3);

    const avgHappiness = expenses.length > 0
      ? expenses.reduce((sum, e) => sum + e.happinessRating, 0) / expenses.length
      : 0;

    // Get buckets and calculate performance
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();

    const bucketPerformance = await Promise.all(
      buckets.map(async (bucket) => {
        if (bucket.bucketMode !== 'spend') {
          return null;
        }

        const bucketExpenses = expenses.filter(e => e.bucketId === bucket._id);
        const spent = bucketExpenses.reduce((sum, e) => sum + e.amount, 0);
        const planned = bucket.plannedAmount || 0;
        const funded = bucket.fundedAmount || 0;

        let status = 'on-track';
        if (spent > funded * 0.9) {
          status = 'over-budget';
        } else if (spent < funded * 0.5) {
          status = 'under-utilized';
        }

        return {
          bucketName: bucket.name,
          planned,
          funded,
          spent,
          status,
        };
      })
    );

    const filteredBucketPerformance = bucketPerformance.filter(b => b !== null) as any[];

    // Generate insights
    const insights: string[] = [];
    const wins: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Spending insights
    if (prevTotalSpent > 0) {
      const changePercent = ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100;
      if (Math.abs(changePercent) > 10) {
        insights.push(
          `Spending ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(1)}% compared to last week`
        );
      }
    }

    // Category insights
    if (topCategories.length > 0) {
      insights.push(
        `Top spending category: ${topCategories[0].category} ($${topCategories[0].amount.toFixed(2)}, ${topCategories[0].percentOfTotal.toFixed(0)}% of total)`
      );
    }

    // Happiness insights
    if (avgHappiness >= 4) {
      wins.push(`High average happiness rating (${avgHappiness.toFixed(1)}/5) - your spending is bringing you joy!`);
    } else if (avgHappiness < 3) {
      concerns.push(`Low average happiness rating (${avgHappiness.toFixed(1)}/5) - consider reviewing your spending priorities`);
      recommendations.push('Review expenses with low happiness ratings and consider reducing spending in those areas');
    }

    // Bucket performance insights
    const overBudgetBuckets = filteredBucketPerformance.filter(b => b.status === 'over-budget');
    const underUtilizedBuckets = filteredBucketPerformance.filter(b => b.status === 'under-utilized');

    if (overBudgetBuckets.length > 0) {
      concerns.push(`${overBudgetBuckets.length} bucket(s) over budget: ${overBudgetBuckets.map(b => b.bucketName).join(', ')}`);
      recommendations.push('Consider increasing planned amounts for frequently over-budget buckets');
    }

    if (underUtilizedBuckets.length > 0 && underUtilizedBuckets.length <= 2) {
      insights.push(`${underUtilizedBuckets.length} bucket(s) under-utilized: ${underUtilizedBuckets.map(b => b.bucketName).join(', ')}`);
      recommendations.push('Consider reducing planned amounts for consistently under-utilized buckets');
    }

    // Happiness ROI insights
    if (topHappyCategories.length > 0) {
      wins.push(`Highest joy: ${topHappyCategories[0].category} (${topHappyCategories[0].avgHappiness.toFixed(1)}/5 happiness)`);
    }

    if (concerningCategories.length > 0) {
      concerns.push(`Low satisfaction in: ${concerningCategories.map(c => c.category).join(', ')}`);
    }

    // Generate summary
    const summary = `Week of ${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}: ` +
      `Spent $${totalSpent.toFixed(2)} across ${expenses.length} transactions. ` +
      `Average happiness: ${avgHappiness.toFixed(1)}/5. ` +
      (prevTotalSpent > 0
        ? `${((totalSpent - prevTotalSpent) / prevTotalSpent * 100) > 0 ? 'Up' : 'Down'} ${Math.abs(((totalSpent - prevTotalSpent) / prevTotalSpent * 100)).toFixed(1)}% from last week.`
        : '');

    // Create report
    const reportId = await ctx.db.insert('reports', {
      userId: args.userId,
      reportType: 'weekly',
      periodStart,
      periodEnd,
      summary,
      spendingAnalysis: {
        totalSpent,
        topCategories,
        comparisonToPrevious: prevTotalSpent > 0 ? {
          change: totalSpent - prevTotalSpent,
          percentChange: ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100,
        } : undefined,
      },
      happinessAnalysis: {
        averageHappiness: avgHappiness,
        topHappyCategories,
        concerningCategories,
      },
      bucketPerformance: filteredBucketPerformance,
      insights,
      recommendations,
      wins,
      concerns,
      createdAt: now,
    });

    // Auto-create memories from insights
    for (const insight of insights) {
      if (insight.includes('increased') || insight.includes('decreased')) {
        await ctx.runMutation(api.memories.createFromInsight, {
          userId: args.userId,
          insight,
          source: 'weekly-report',
          importance: 3,
        });
      }
    }

    return reportId;
  },
});

// Generate monthly strategic report
export const generateMonthlyReport = mutation({
  args: {
    userId: v.id('users'),
    periodStart: v.optional(v.number()), // If not provided, use last 30 days
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodEnd = args.periodEnd || now;
    const periodStart = args.periodStart || (periodEnd - (30 * 24 * 60 * 60 * 1000));

    // Get expenses for the period
    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) =>
        q.and(
          q.gte(q.field('date'), periodStart),
          q.lte(q.field('date'), periodEnd)
        )
      )
      .collect();

    // Get previous period for comparison
    const prevPeriodStart = periodStart - (30 * 24 * 60 * 60 * 1000);
    const prevExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) =>
        q.and(
          q.gte(q.field('date'), prevPeriodStart),
          q.lt(q.field('date'), periodStart)
        )
      )
      .collect();

    // Calculate spending analysis
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const prevTotalSpent = prevExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Group by category
    const categoryTotals: Record<string, number> = {};
    for (const expense of expenses) {
      const category = expense.category || 'Uncategorized';
      categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;
    }

    const topCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentOfTotal: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate happiness analysis
    const happinessByCategory: Record<string, { total: number; count: number; spent: number }> = {};
    for (const expense of expenses) {
      const category = expense.category || 'Uncategorized';
      if (!happinessByCategory[category]) {
        happinessByCategory[category] = { total: 0, count: 0, spent: 0 };
      }
      happinessByCategory[category].total += expense.happinessRating;
      happinessByCategory[category].count += 1;
      happinessByCategory[category].spent += expense.amount;
    }

    const categoryHappiness = Object.entries(happinessByCategory).map(([category, data]) => ({
      category,
      avgHappiness: data.total / data.count,
      roi: (data.total / data.count) / (data.spent / data.count),
      spent: data.spent,
    }));

    const topHappyCategories = categoryHappiness
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);

    const concerningCategories = categoryHappiness
      .filter(c => c.avgHappiness < 3 && c.spent > totalSpent * 0.05) // Only flag if >5% of spending
      .map(c => ({
        category: c.category,
        avgHappiness: c.avgHappiness,
        reason: `Significant spending ($${c.spent.toFixed(2)}) with low happiness (${c.avgHappiness.toFixed(1)}/5)`,
      }));

    const avgHappiness = expenses.length > 0
      ? expenses.reduce((sum, e) => sum + e.happinessRating, 0) / expenses.length
      : 0;

    // Get buckets and calculate performance
    const buckets = await ctx.db
      .query('buckets')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();

    const bucketPerformance = await Promise.all(
      buckets.map(async (bucket) => {
        if (bucket.bucketMode !== 'spend') {
          return null;
        }

        const bucketExpenses = expenses.filter(e => e.bucketId === bucket._id);
        const spent = bucketExpenses.reduce((sum, e) => sum + e.amount, 0);
        const planned = bucket.plannedAmount || 0;
        const funded = bucket.fundedAmount || 0;

        let status = 'on-track';
        if (spent > funded * 0.95) {
          status = 'over-budget';
        } else if (spent < funded * 0.5) {
          status = 'under-utilized';
        }

        return {
          bucketName: bucket.name,
          planned,
          funded,
          spent,
          status,
        };
      })
    );

    const filteredBucketPerformance = bucketPerformance.filter(b => b !== null) as any[];

    // Generate strategic insights
    const insights: string[] = [];
    const wins: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Month-over-month comparison
    if (prevTotalSpent > 0) {
      const changePercent = ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100;
      insights.push(
        `Monthly spending ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(1)}% (${changePercent > 0 ? '+' : ''}$${(totalSpent - prevTotalSpent).toFixed(2)})`
      );

      if (Math.abs(changePercent) > 20) {
        concerns.push(`Significant ${changePercent > 0 ? 'increase' : 'decrease'} in spending - review what changed`);
      }
    }

    // Category trends
    insights.push(`Top 3 categories: ${topCategories.slice(0, 3).map(c => `${c.category} ($${c.amount.toFixed(2)})`).join(', ')}`);

    // Needs vs wants analysis
    const needsTotal = expenses.filter(e => e.needsVsWants === 'need').reduce((sum, e) => sum + e.amount, 0);
    const wantsTotal = expenses.filter(e => e.needsVsWants === 'want').reduce((sum, e) => sum + e.amount, 0);
    const needsPercent = totalSpent > 0 ? (needsTotal / totalSpent) * 100 : 0;

    if (needsTotal > 0 || wantsTotal > 0) {
      insights.push(`Spending breakdown: ${needsPercent.toFixed(0)}% needs, ${(100 - needsPercent).toFixed(0)}% wants`);

      if (needsPercent > 70) {
        wins.push('Prioritizing essential expenses - strong financial discipline');
      } else if (needsPercent < 40) {
        recommendations.push('Consider reducing discretionary spending to build more financial cushion');
      }
    }

    // Happiness ROI insights
    if (topHappyCategories.length > 0) {
      wins.push(`Best happiness ROI: ${topHappyCategories[0].category} (${topHappyCategories[0].roi.toFixed(3)} joy/$)`);
      recommendations.push(`Consider allocating more to high-ROI categories like ${topHappyCategories[0].category}`);
    }

    if (concerningCategories.length > 0) {
      concerns.push(`Low satisfaction spending: ${concerningCategories.map(c => c.category).join(', ')}`);
      recommendations.push('Review low-satisfaction categories and consider cutting back or finding alternatives');
    }

    // Bucket utilization patterns
    const consistentlyOverBudget = filteredBucketPerformance.filter(b =>
      b.status === 'over-budget' && b.spent / b.funded > 1.1
    );

    const consistentlyUnderUtilized = filteredBucketPerformance.filter(b =>
      b.status === 'under-utilized' && b.spent / b.funded < 0.4
    );

    if (consistentlyOverBudget.length > 0) {
      concerns.push(`Consistently over budget: ${consistentlyOverBudget.map(b => b.bucketName).join(', ')}`);
      recommendations.push('Increase planned amounts for consistently over-budget buckets');
    }

    if (consistentlyUnderUtilized.length > 0) {
      insights.push(`Under-utilized buckets: ${consistentlyUnderUtilized.map(b => b.bucketName).join(', ')}`);
      recommendations.push('Consider reallocating funds from under-utilized buckets');
    }

    // Overall happiness trend
    if (avgHappiness >= 4) {
      wins.push(`Strong month! Average happiness: ${avgHappiness.toFixed(1)}/5`);
    } else if (avgHappiness < 3) {
      concerns.push(`Below-average happiness: ${avgHappiness.toFixed(1)}/5`);
      recommendations.push('Focus spending on categories with proven high happiness ROI');
    }

    // Generate summary
    const summary = `${new Date(periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ` +
      `Spent $${totalSpent.toFixed(2)} across ${expenses.length} transactions. ` +
      `Average happiness: ${avgHappiness.toFixed(1)}/5. ` +
      (prevTotalSpent > 0
        ? `${((totalSpent - prevTotalSpent) / prevTotalSpent * 100) > 0 ? 'Up' : 'Down'} ${Math.abs(((totalSpent - prevTotalSpent) / prevTotalSpent * 100)).toFixed(1)}% from previous month.`
        : 'First full month of tracking.');

    // Create report
    const reportId = await ctx.db.insert('reports', {
      userId: args.userId,
      reportType: 'monthly',
      periodStart,
      periodEnd,
      summary,
      spendingAnalysis: {
        totalSpent,
        topCategories: topCategories.slice(0, 10),
        comparisonToPrevious: prevTotalSpent > 0 ? {
          change: totalSpent - prevTotalSpent,
          percentChange: ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100,
        } : undefined,
      },
      happinessAnalysis: {
        averageHappiness: avgHappiness,
        topHappyCategories,
        concerningCategories,
      },
      bucketPerformance: filteredBucketPerformance,
      insights,
      recommendations,
      wins,
      concerns,
      createdAt: now,
    });

    // Auto-create high-importance memories from key insights
    for (const insight of insights) {
      if (insight.includes('increased by') || insight.includes('decreased by')) {
        await ctx.runMutation(api.memories.createFromInsight, {
          userId: args.userId,
          insight,
          source: 'monthly-report',
          importance: 4,
        });
      }
    }

    // Store concerning patterns as memories
    for (const concern of concerns) {
      if (concern.includes('Consistently over budget')) {
        await ctx.runMutation(api.memories.createFromInsight, {
          userId: args.userId,
          insight: concern,
          source: 'monthly-report',
          importance: 4,
        });
      }
    }

    return reportId;
  },
});

// Get reports by user
export const getByUser = query({
  args: {
    userId: v.id('users'),
    reportType: v.optional(v.union(v.literal('weekly'), v.literal('monthly'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('reports')
      .withIndex('by_user', (q) => q.eq('userId', args.userId));

    if (args.reportType) {
      query = ctx.db
        .query('reports')
        .withIndex('by_user_and_type', (q) =>
          q.eq('userId', args.userId).eq('reportType', args.reportType as 'weekly' | 'monthly')
        );
    }

    const reports = await query
      .order('desc')
      .take(args.limit || 10);

    return reports;
  },
});

// Get latest report
export const getLatest = query({
  args: {
    userId: v.id('users'),
    reportType: v.union(v.literal('weekly'), v.literal('monthly')),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query('reports')
      .withIndex('by_user_and_type', (q) =>
        q.eq('userId', args.userId).eq('reportType', args.reportType)
      )
      .order('desc')
      .first();

    return report;
  },
});

// Get report by ID
export const getById = query({
  args: {
    reportId: v.id('reports'),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    return report;
  },
});

// Delete a report
export const remove = mutation({
  args: {
    reportId: v.id('reports'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reportId);
  },
});
