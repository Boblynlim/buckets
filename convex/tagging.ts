import { v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';

/**
 * Auto-generate transaction metadata from note and amount
 * This is a simple rule-based system that can be enhanced with AI later
 */
export const generateMetadata = mutation({
  args: {
    expenseId: v.id('expenses'),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    const note = expense.note.toLowerCase();
    const amount = expense.amount;

    // Simple keyword-based categorization
    const metadata: {
      merchant?: string;
      category?: string;
      subCategory?: string;
      item?: string;
      needsVsWants?: 'need' | 'want';
      sentiment?: string;
    } = {};

    // Detect merchant
    const merchantKeywords = [
      { pattern: /uber|lyft/i, name: 'Uber/Lyft' },
      { pattern: /amazon/i, name: 'Amazon' },
      { pattern: /starbucks/i, name: 'Starbucks' },
      { pattern: /target|walmart/i, name: 'Target/Walmart' },
      { pattern: /whole foods|trader joe/i, name: 'Grocery Store' },
    ];

    for (const { pattern, name } of merchantKeywords) {
      if (pattern.test(note)) {
        metadata.merchant = name;
        break;
      }
    }

    // Detect category and subcategory
    if (/food|dinner|lunch|breakfast|restaurant|cafe|coffee/.test(note)) {
      metadata.category = 'Food & Dining';
      if (/restaurant|dinner/.test(note)) {
        metadata.subCategory = 'Restaurants';
      } else if (/coffee|cafe|starbucks/.test(note)) {
        metadata.subCategory = 'Coffee Shops';
      } else if (/grocery|groceries/.test(note)) {
        metadata.subCategory = 'Groceries';
      }
    } else if (/uber|lyft|taxi|bus|train|gas|parking/.test(note)) {
      metadata.category = 'Transportation';
      if (/uber|lyft|taxi/.test(note)) {
        metadata.subCategory = 'Rideshare';
      } else if (/gas/.test(note)) {
        metadata.subCategory = 'Gas';
      }
    } else if (/shop|shopping|clothes|shoes/.test(note)) {
      metadata.category = 'Shopping';
      metadata.subCategory = 'Clothing';
    } else if (/movie|concert|entertainment|game/.test(note)) {
      metadata.category = 'Entertainment';
    } else if (/rent|utilities|electric|water/.test(note)) {
      metadata.category = 'Bills & Utilities';
      metadata.needsVsWants = 'need';
    }

    // Detect needs vs wants
    if (!metadata.needsVsWants) {
      const needsKeywords = /rent|utilities|grocery|groceries|medicine|doctor|gas|insurance/;
      const wantsKeywords = /restaurant|coffee|movie|concert|entertainment|shopping|clothes/;

      if (needsKeywords.test(note)) {
        metadata.needsVsWants = 'need';
      } else if (wantsKeywords.test(note)) {
        metadata.needsVsWants = 'want';
      }
    }

    // Extract item description
    metadata.item = expense.note;

    // Generate sentiment based on happiness rating
    if (expense.happinessRating <= 2) {
      metadata.sentiment = 'regretful';
    } else if (expense.happinessRating === 3) {
      metadata.sentiment = 'neutral';
    } else if (expense.happinessRating >= 4) {
      metadata.sentiment = 'happy';
    }

    // Update expense with metadata
    await ctx.db.patch(args.expenseId, metadata);

    return metadata;
  },
});

/**
 * Get spending insights by category
 */
export const getSpendingByCategory = query({
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
    const categoryTotals: Record<string, { total: number; count: number; avgHappiness: number }> = {};

    for (const expense of expenses) {
      const category = expense.category || 'Uncategorized';

      if (!categoryTotals[category]) {
        categoryTotals[category] = { total: 0, count: 0, avgHappiness: 0 };
      }

      categoryTotals[category].total += expense.amount;
      categoryTotals[category].count += 1;
      categoryTotals[category].avgHappiness += expense.happinessRating;
    }

    // Calculate averages
    for (const category in categoryTotals) {
      categoryTotals[category].avgHappiness /= categoryTotals[category].count;
    }

    return categoryTotals;
  },
});

/**
 * Get needs vs wants breakdown
 */
export const getNeedsVsWants = query({
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

    let needs = 0;
    let wants = 0;
    let unclassified = 0;

    for (const expense of expenses) {
      if (expense.needsVsWants === 'need') {
        needs += expense.amount;
      } else if (expense.needsVsWants === 'want') {
        wants += expense.amount;
      } else {
        unclassified += expense.amount;
      }
    }

    return {
      needs,
      wants,
      unclassified,
      total: needs + wants + unclassified,
      needsPercent: (needs / (needs + wants + unclassified)) * 100,
      wantsPercent: (wants / (needs + wants + unclassified)) * 100,
    };
  },
});
