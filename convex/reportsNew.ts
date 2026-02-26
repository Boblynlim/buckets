import { v } from 'convex/values';
import { action, mutation } from './_generated/server';
import { api } from './_generated/api';
import Anthropic from '@anthropic-ai/sdk';

// Helper mutation to insert report (actions can't access db directly)
export const insertReport = mutation({
  args: {
    userId: v.id('users'),
    reportType: v.union(v.literal('weekly'), v.literal('monthly')),
    periodStart: v.number(),
    periodEnd: v.number(),
    vibeCheck: v.string(),
    goalPulse: v.optional(v.any()),
    fundStatus: v.array(v.any()),
    fundsRunningLow: v.array(v.string()),
    fundsHealthy: v.array(v.string()),
    valuesAlignment: v.any(),
    patternsAndFlags: v.any(),
    sgNudges: v.any(),
    reflectionPrompts: v.array(v.string()),
    fixedCosts: v.array(v.any()),
    fixedCostsTotal: v.number(),
    wins: v.array(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('reports', args);
  },
});

/**
 * New Report Generation System - Narrative Style
 * Generates warm, personalized weekly reports
 */

export const generateWeeklyReportNew = action({
  args: {
    userId: v.id('users'),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodEnd = args.periodEnd || now;
    const periodStart = args.periodStart || (periodEnd - (7 * 24 * 60 * 60 * 1000));

    // 1. Gather all data using queries (actions can't access db directly)
    const expenses = await ctx.runQuery(api.expenses.getByUser, { userId: args.userId }) as any[];
    const expensesInPeriod = expenses.filter((e: any) =>
      e.date >= periodStart && e.date <= periodEnd
    );

    const buckets = await ctx.runQuery(api.buckets.getByUser, { userId: args.userId }) as any[];

    const memories = await ctx.runQuery(api.memories.getByUser, { userId: args.userId }) as any[];

    // Get previous period for comparison
    const prevPeriodStart = periodStart - (7 * 24 * 60 * 60 * 1000);
    const prevExpenses = expenses.filter((e: any) =>
      e.date >= prevPeriodStart && e.date < periodStart
    );

    // 2. Calculate metrics
    const totalSpent = expensesInPeriod.reduce((sum: number, e: any) => sum + e.amount, 0);
    const prevTotalSpent = prevExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const avgHappiness = expensesInPeriod.length > 0
      ? expensesInPeriod.reduce((sum: number, e: any) => sum + (e.happinessRating || 3), 0) / expensesInPeriod.length
      : 0;

    // Calculate by category
    const byCategory: Record<string, { amount: number; happiness: number[]; notes: string[] }> = {};
    for (const expense of expensesInPeriod) {
      const cat = expense.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { amount: 0, happiness: [], notes: [] };
      byCategory[cat].amount += expense.amount;
      if (expense.happinessRating) byCategory[cat].happiness.push(expense.happinessRating);
      if (expense.note) byCategory[cat].notes.push(expense.note);
    }

    // Calculate fund status from buckets
    const signalBuckets = buckets.filter((b: any) =>
      !['Asian tax (parents)', 'Transport', 'Insurance', 'Maintenance (health)',
        'Taxes', 'Shared account', 'Endowus', 'IBKR'].includes(b.name)
    );

    const noiseBuckets = buckets.filter((b: any) =>
      ['Asian tax (parents)', 'Transport', 'Insurance', 'Maintenance (health)',
        'Taxes', 'Shared account', 'Endowus', 'IBKR'].includes(b.name)
    );

    const fundStatus = signalBuckets.map((bucket: any) => {
      const spent = expensesInPeriod
        .filter((e: any) => e.bucketId === bucket._id)
        .reduce((sum: number, e: any) => sum + e.amount, 0);

      const monthlyAlloc = bucket.allocationType === 'percentage'
        ? `${bucket.plannedPercent || 0}% of income`
        : bucket.plannedAmount || 0;

      const banked = bucket.currentBalance || 0;
      const remaining = banked - spent;
      const monthlyAmount = typeof monthlyAlloc === 'number' ? monthlyAlloc : 0;
      const runway = monthlyAmount > 0 ? `${Math.floor(remaining / monthlyAmount)} months buffer` : '—';

      return {
        bucketName: bucket.name,
        monthlyAllocation: monthlyAlloc,
        bankedSoFar: banked,
        spentThisWeek: spent,
        remaining,
        runway,
      };
    });

    const fundsRunningLow = fundStatus
      .filter((f: any) => typeof f.monthlyAllocation === 'number' && f.remaining < f.monthlyAllocation)
      .map((f: any) => f.bucketName);

    const fundsHealthy = fundStatus
      .filter((f: any) => {
        if (typeof f.monthlyAllocation !== 'number') return false;
        return f.remaining >= (f.monthlyAllocation * 3);
      })
      .map((f: any) => f.bucketName);

    // Fixed costs
    const fixedCosts = noiseBuckets.map((bucket: any) => {
      const spent = expensesInPeriod
        .filter((e: any) => e.bucketId === bucket._id)
        .reduce((sum: number, e: any) => sum + e.amount, 0);

      return {
        category: bucket.name,
        thisWeek: spent,
        monthlyBudget: bucket.plannedAmount || 0,
      };
    });

    const fixedCostsTotal = fixedCosts.reduce((sum: number, f: any) => sum + f.thisWeek, 0);

    // 3. Prepare context for AI
    const contextForAI = {
      periodStart: new Date(periodStart).toLocaleDateString(),
      periodEnd: new Date(periodEnd).toLocaleDateString(),
      totalSpent,
      prevTotalSpent,
      changePercent: prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : 0,
      avgHappiness,
      expenseCount: expensesInPeriod.length,
      byCategory: Object.entries(byCategory).map(([cat, data]) => ({
        category: cat,
        amount: data.amount,
        avgHappiness: data.happiness.length > 0
          ? data.happiness.reduce((a: number, b: number) => a + b, 0) / data.happiness.length
          : 0,
        notes: data.notes.slice(0, 5), // Sample of notes
      })),
      fundStatus,
      fundsRunningLow,
      fundsHealthy,
      userValues: [
        'Quality time with Xinghan',
        'Experiences over things',
        'Investing in yourself (learning, fitness, self-care)',
        'Building toward financial independence & renovation',
      ],
      memories: memories.slice(0, 10).map((m: any) => m.content),
    };

    // 4. Generate narrative sections with AI
    const prompt = `You are a warm, insightful financial friend helping Jaz (27, married, living in Singapore) understand her weekly spending.

Context about Jaz:
- Values: ${contextForAI.userValues.join(', ')}
- Current goals: $50k renovation fund, $30k emergency fund
- Living with in-laws (no rent), expecting $2k/month rental income soon
- Previous insights from memory: ${contextForAI.memories.join('; ')}

This week's data (${contextForAI.periodStart} - ${contextForAI.periodEnd}):
- Total spent: $${contextForAI.totalSpent.toFixed(2)} (${contextForAI.changePercent > 0 ? '+' : ''}${contextForAI.changePercent.toFixed(1)}% from last week)
- ${contextForAI.expenseCount} transactions
- Average happiness: ${contextForAI.avgHappiness.toFixed(1)}/5

Spending by category:
${contextForAI.byCategory.map((c: any) => `- ${c.category}: $${c.amount.toFixed(2)} (happiness: ${c.avgHappiness.toFixed(1)}/5)\n  Notes: ${c.notes.join(', ')}`).join('\n')}

Generate a weekly report in this exact structure:

## 1. VIBE CHECK (2-3 sentences)
[Warm narrative summary - not just numbers. What does this week mean? Connect spending to life context.]

## 2. VALUES ALIGNMENT NARRATIVE
[Detailed analysis: did spending match her stated values? Be specific with examples from the notes.]

## 3. VALUES - ALIGNED (bullet list)
[Specific examples of spending that matched values]

## 4. VALUES - WORTH A LOOK (bullet list)
[Spending that might not align - no judgment, just flagging]

## 5. PATTERNS - TRENDS (bullet list)
[Trends over time, comparisons to previous weeks]

## 6. PATTERNS - REPEATS (bullet list)
[Repeated behaviors or purchases worth noting]

## 7. PATTERNS - JOY EFFICIENCY (bullet list)
[Categories with high/low joy per dollar spent]

## 8. SG NUDGES - THIS WEEK (bullet list)
[1-2 practical Singapore-specific suggestions based on spending]

## 9. SG NUDGES - GENERAL (bullet list)
[1-2 general reminders relevant to Jaz's context]

## 10. REFLECTION PROMPTS (2 questions)
[Contextual questions based on this week's spending to help her reflect]

## 11. WINS (2-3 bullet points)
[Celebrate what went well - be genuine and specific]

Keep the tone: friend + therapist. Warm, curious, non-judgmental. Ask questions rather than make accusations.`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const aiResponse = completion.content[0].type === 'text' ? completion.content[0].text : '';

    // 5. Parse AI response into structured sections
    const sections = parseAIResponse(aiResponse);

    // 6. Calculate goal pulse (these are fixed for now, could be made dynamic)
    const goalPulse = {
      renovationFund: {
        target: 50000,
        currentProgress: 0, // TODO: Get from savings bucket
        rentalIncome: 24000, // $2000 * 12 months
        gap: 50000, // TODO: Calculate
        onTrack: 'Getting there',
      },
      emergencyFund: {
        target: 30000,
        currentProgress: 0, // TODO: Get from savings bucket
        percentComplete: 0,
      },
      quickTake: sections.quickTake || 'Keep building toward your goals with the rental income coming in.',
    };

    // 7. Create report
    const reportId: any = await ctx.runMutation(api.reportsNew.insertReport, {
      userId: args.userId,
      reportType: 'weekly',
      periodStart,
      periodEnd,
      vibeCheck: sections.vibeCheck,
      goalPulse,
      fundStatus,
      fundsRunningLow,
      fundsHealthy,
      valuesAlignment: {
        narrative: sections.valuesNarrative,
        aligned: sections.valuesAligned,
        worthALook: sections.valuesWorthALook,
      },
      patternsAndFlags: {
        trends: sections.patternsTrends,
        repeats: sections.patternsRepeats,
        joyEfficiency: sections.patternsJoy,
      },
      sgNudges: {
        thisWeek: sections.sgNudgesThisWeek,
        generalReminders: sections.sgNudgesGeneral,
      },
      reflectionPrompts: sections.reflectionPrompts,
      fixedCosts,
      fixedCostsTotal,
      wins: sections.wins,
      createdAt: now,
    });

    // 8. Create memories from insights
    const insightMemories = [
      ...sections.patternsTrends.slice(0, 2),
      ...sections.valuesWorthALook.slice(0, 1),
    ];

    for (const insight of insightMemories) {
      if (insight && insight.length > 10) {
        await ctx.runMutation(api.memories.create, {
          userId: args.userId,
          memoryType: 'context',
          content: insight,
          source: 'weekly-report',
          importance: 3,
        });
      }
    }

    return reportId;
  },
});

/**
 * New Report Generation System - Narrative Style (Monthly)
 * Generates warm, personalized monthly reports using the same AI approach as weekly.
 */
export const generateMonthlyReportNew = action({
  args: {
    userId: v.id('users'),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodEnd = args.periodEnd || now;
    const periodStart = args.periodStart || (periodEnd - (30 * 24 * 60 * 60 * 1000));

    // 1. Gather all data
    const expenses = await ctx.runQuery(api.expenses.getByUser, { userId: args.userId }) as any[];
    const expensesInPeriod = expenses.filter((e: any) =>
      e.date >= periodStart && e.date <= periodEnd
    );

    const buckets = await ctx.runQuery(api.buckets.getByUser, { userId: args.userId }) as any[];
    const memories = await ctx.runQuery(api.memories.getByUser, { userId: args.userId }) as any[];

    // Previous 30-day period for comparison
    const prevPeriodStart = periodStart - (30 * 24 * 60 * 60 * 1000);
    const prevExpenses = expenses.filter((e: any) =>
      e.date >= prevPeriodStart && e.date < periodStart
    );

    // 2. Calculate metrics
    const totalSpent = expensesInPeriod.reduce((sum: number, e: any) => sum + e.amount, 0);
    const prevTotalSpent = prevExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const changePercent = prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : 0;

    const avgWorthRating = expensesInPeriod.length > 0
      ? expensesInPeriod.reduce((sum: number, e: any) => sum + (e.worthRating || e.happinessRating || 3), 0) / expensesInPeriod.length
      : 0;
    const avgAlignmentRating = expensesInPeriod.length > 0
      ? expensesInPeriod.reduce((sum: number, e: any) => sum + (e.alignmentRating || e.happinessRating || 3), 0) / expensesInPeriod.length
      : 0;

    // Needs vs wants breakdown
    const needsExpenses = expensesInPeriod.filter((e: any) => e.needsVsWants === 'need');
    const wantsExpenses = expensesInPeriod.filter((e: any) => e.needsVsWants === 'want');
    const needsTotal = needsExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const wantsTotal = wantsExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const needsPercent = totalSpent > 0 ? (needsTotal / totalSpent) * 100 : 0;

    // By category with worth + alignment ratings
    const byCategory: Record<string, { amount: number; worth: number[]; alignment: number[]; notes: string[]; prevAmount: number }> = {};
    for (const expense of expensesInPeriod) {
      const cat = expense.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { amount: 0, worth: [], alignment: [], notes: [], prevAmount: 0 };
      byCategory[cat].amount += expense.amount;
      if (expense.worthRating || expense.happinessRating) byCategory[cat].worth.push(expense.worthRating || expense.happinessRating);
      if (expense.alignmentRating || expense.happinessRating) byCategory[cat].alignment.push(expense.alignmentRating || expense.happinessRating);
      if (expense.note) byCategory[cat].notes.push(expense.note);
    }

    // Previous month amounts per category for trend comparison
    for (const expense of prevExpenses) {
      const cat = expense.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { amount: 0, worth: [], alignment: [], notes: [], prevAmount: 0 };
      byCategory[cat].prevAmount += expense.amount;
    }

    // Bucket fund status
    const signalBuckets = buckets.filter((b: any) =>
      !['Asian tax (parents)', 'Transport', 'Insurance', 'Maintenance (health)',
        'Taxes', 'Shared account', 'Endowus', 'IBKR'].includes(b.name)
    );
    const noiseBuckets = buckets.filter((b: any) =>
      ['Asian tax (parents)', 'Transport', 'Insurance', 'Maintenance (health)',
        'Taxes', 'Shared account', 'Endowus', 'IBKR'].includes(b.name)
    );

    const fundStatus = signalBuckets.map((bucket: any) => {
      const spent = expensesInPeriod
        .filter((e: any) => e.bucketId === bucket._id)
        .reduce((sum: number, e: any) => sum + e.amount, 0);
      const monthlyAlloc = bucket.allocationType === 'percentage'
        ? `${bucket.plannedPercent || 0}% of income`
        : bucket.plannedAmount || 0;
      const banked = bucket.currentBalance || 0;
      const remaining = banked - spent;
      const monthlyAmount = typeof monthlyAlloc === 'number' ? monthlyAlloc : 0;
      const runway = monthlyAmount > 0 ? `${Math.floor(remaining / monthlyAmount)} months buffer` : '—';
      return { bucketName: bucket.name, monthlyAllocation: monthlyAlloc, bankedSoFar: banked, spentThisWeek: spent, remaining, runway };
    });

    const fundsRunningLow = fundStatus
      .filter((f: any) => typeof f.monthlyAllocation === 'number' && f.remaining < f.monthlyAllocation)
      .map((f: any) => f.bucketName);
    const fundsHealthy = fundStatus
      .filter((f: any) => typeof f.monthlyAllocation === 'number' && f.remaining >= (f.monthlyAllocation * 3))
      .map((f: any) => f.bucketName);

    const fixedCosts = noiseBuckets.map((bucket: any) => {
      const spent = expensesInPeriod
        .filter((e: any) => e.bucketId === bucket._id)
        .reduce((sum: number, e: any) => sum + e.amount, 0);
      return { category: bucket.name, thisWeek: spent, monthlyBudget: bucket.plannedAmount || 0 };
    });
    const fixedCostsTotal = fixedCosts.reduce((sum: number, f: any) => sum + f.thisWeek, 0);

    // 3. Prepare AI context
    const byCategoryArray = Object.entries(byCategory)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([cat, data]) => ({
        category: cat,
        amount: data.amount,
        prevAmount: data.prevAmount,
        monthOverMonthChange: data.prevAmount > 0
          ? (((data.amount - data.prevAmount) / data.prevAmount) * 100).toFixed(1)
          : 'new',
        avgWorth: data.worth.length > 0
          ? (data.worth.reduce((a: number, b: number) => a + b, 0) / data.worth.length).toFixed(1)
          : 'n/a',
        avgAlignment: data.alignment.length > 0
          ? (data.alignment.reduce((a: number, b: number) => a + b, 0) / data.alignment.length).toFixed(1)
          : 'n/a',
        notes: data.notes.slice(0, 6),
      }));

    const contextForAI = {
      periodStart: new Date(periodStart).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }),
      periodEnd: new Date(periodEnd).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }),
      totalSpent,
      prevTotalSpent,
      changePercent,
      expenseCount: expensesInPeriod.length,
      avgWorthRating,
      avgAlignmentRating,
      needsPercent: needsPercent.toFixed(1),
      needsTotal,
      wantsTotal,
      byCategory: byCategoryArray,
      fundStatus,
      fundsRunningLow,
      fundsHealthy,
      userValues: [
        'Quality time with Xinghan',
        'Experiences over things',
        'Investing in yourself (learning, fitness, self-care)',
        'Building toward financial independence & renovation',
      ],
      memories: memories.slice(0, 10).map((m: any) => m.content),
    };

    // 4. AI prompt — monthly lens
    const prompt = `You are a warm, insightful financial friend helping Jaz (27, married, living in Singapore) understand her monthly spending.

Context about Jaz:
- Values: ${contextForAI.userValues.join(', ')}
- Current goals: $50k renovation fund, $30k emergency fund
- Living with in-laws (no rent), expecting $2k/month rental income soon
- Previous insights from memory: ${contextForAI.memories.join('; ')}

This month's data (${contextForAI.periodStart}):
- Total spent: $${contextForAI.totalSpent.toFixed(2)} (${contextForAI.changePercent > 0 ? '+' : ''}${contextForAI.changePercent.toFixed(1)}% vs last month)
- ${contextForAI.expenseCount} transactions
- Average worth rating: ${contextForAI.avgWorthRating.toFixed(1)}/5 | Average alignment rating: ${contextForAI.avgAlignmentRating.toFixed(1)}/5
- Needs: $${contextForAI.needsTotal.toFixed(2)} (${contextForAI.needsPercent}%) | Wants: $${contextForAI.wantsTotal.toFixed(2)}

Spending by category (with month-over-month change):
${contextForAI.byCategory.map((c: any) =>
  `- ${c.category}: $${c.amount.toFixed(2)} (${c.monthOverMonthChange}% vs last month) | worth: ${c.avgWorth}/5, alignment: ${c.avgAlignment}/5\n  Notes: ${c.notes.join(', ')}`
).join('\n')}

Generate a monthly report in this exact structure:

## 1. VIBE CHECK (2-3 sentences)
[Monthly narrative summary — what kind of month was it financially? Connect spending to life context and bigger picture.]

## 2. VALUES ALIGNMENT NARRATIVE
[Detailed monthly analysis: did spending match her values over the full month? Look at patterns, not just individual purchases.]

## 3. VALUES - ALIGNED (bullet list)
[Categories or habits this month that matched her values well]

## 4. VALUES - WORTH A LOOK (bullet list)
[Patterns or categories this month that may not align — no judgment, just awareness]

## 5. PATTERNS - TRENDS (bullet list)
[Month-over-month trends — what grew, what shrank, and what that might mean]

## 6. PATTERNS - REPEATS (bullet list)
[Recurring spending patterns or habits that showed up consistently this month]

## 7. PATTERNS - JOY EFFICIENCY (bullet list)
[Which categories gave the best and worst value for money based on worth/alignment ratings]

## 8. SG NUDGES - THIS MONTH (bullet list)
[1-2 practical Singapore-specific actions or optimisations based on this month's spending]

## 9. SG NUDGES - GENERAL (bullet list)
[1-2 broader reminders relevant to Jaz's financial context and goals]

## 10. REFLECTION PROMPTS (2 questions)
[Big-picture monthly questions to help her reflect on the month as a whole — more strategic than weekly prompts]

## 11. WINS (2-3 bullet points)
[Celebrate what went well this month — be genuine and specific, look at the full month's arc]

Keep the tone: friend + therapist. Warm, curious, non-judgmental. Monthly reports should feel like a proper monthly review — bigger picture than weekly, more strategic, celebrating progress toward long-term goals.`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiResponse = completion.content[0].type === 'text' ? completion.content[0].text : '';

    // 5. Parse AI response
    const sections = parseAIResponse(aiResponse);

    const goalPulse = {
      renovationFund: {
        target: 50000,
        currentProgress: 0,
        rentalIncome: 24000,
        gap: 50000,
        onTrack: 'Getting there',
      },
      emergencyFund: {
        target: 30000,
        currentProgress: 0,
        percentComplete: 0,
      },
      quickTake: sections.quickTake || 'Keep building toward your goals.',
    };

    // 6. Store report
    const reportId: any = await ctx.runMutation(api.reportsNew.insertReport, {
      userId: args.userId,
      reportType: 'monthly',
      periodStart,
      periodEnd,
      vibeCheck: sections.vibeCheck,
      goalPulse,
      fundStatus,
      fundsRunningLow,
      fundsHealthy,
      valuesAlignment: {
        narrative: sections.valuesNarrative,
        aligned: sections.valuesAligned,
        worthALook: sections.valuesWorthALook,
      },
      patternsAndFlags: {
        trends: sections.patternsTrends,
        repeats: sections.patternsRepeats,
        joyEfficiency: sections.patternsJoy,
      },
      sgNudges: {
        thisWeek: sections.sgNudgesThisWeek,
        generalReminders: sections.sgNudgesGeneral,
      },
      reflectionPrompts: sections.reflectionPrompts,
      fixedCosts,
      fixedCostsTotal,
      wins: sections.wins,
      createdAt: now,
    });

    // 7. Save key insights as memories
    const insightMemories = [
      ...sections.patternsTrends.slice(0, 2),
      ...sections.valuesWorthALook.slice(0, 1),
    ];
    for (const insight of insightMemories) {
      if (insight && insight.length > 10) {
        await ctx.runMutation(api.memories.create, {
          userId: args.userId,
          memoryType: 'context',
          content: insight,
          source: 'monthly-report',
          importance: 4,
        });
      }
    }

    return reportId;
  },
});

// Helper to parse AI response into structured sections
function parseAIResponse(response: string) {
  const sections: Record<string, any> = {
    vibeCheck: '',
    valuesNarrative: '',
    valuesAligned: [],
    valuesWorthALook: [],
    patternsTrends: [],
    patternsRepeats: [],
    patternsJoy: [],
    sgNudgesThisWeek: [],
    sgNudgesGeneral: [],
    reflectionPrompts: [],
    wins: [],
  };

  const lines = response.split('\n');
  let currentSection = '';

  for (const line of lines) {
    if (line.includes('VIBE CHECK')) currentSection = 'vibeCheck';
    else if (line.includes('VALUES ALIGNMENT NARRATIVE')) currentSection = 'valuesNarrative';
    else if (line.includes('VALUES - ALIGNED')) currentSection = 'valuesAligned';
    else if (line.includes('VALUES - WORTH A LOOK')) currentSection = 'valuesWorthALook';
    else if (line.includes('PATTERNS - TRENDS')) currentSection = 'patternsTrends';
    else if (line.includes('PATTERNS - REPEATS')) currentSection = 'patternsRepeats';
    else if (line.includes('PATTERNS - JOY')) currentSection = 'patternsJoy';
    else if (line.includes('SG NUDGES - THIS WEEK')) currentSection = 'sgNudgesThisWeek';
    else if (line.includes('SG NUDGES - GENERAL')) currentSection = 'sgNudgesGeneral';
    else if (line.includes('REFLECTION PROMPTS')) currentSection = 'reflectionPrompts';
    else if (line.includes('WINS')) currentSection = 'wins';
    else if (line.trim() && !line.startsWith('#')) {
      if (currentSection === 'vibeCheck' || currentSection === 'valuesNarrative') {
        sections[currentSection] += line.trim() + ' ';
      } else if (currentSection === 'reflectionPrompts') {
        // Reflection prompts might be written as questions without bullets
        // Try to split by question marks to separate multiple questions
        const text = line.trim();
        if (text) {
          if (text.startsWith('-') || text.startsWith('•') || text.startsWith('*')) {
            sections[currentSection].push(text.replace(/^[-•*]\s*/, '').trim());
          } else {
            // Split by question marks and add each as separate prompt
            const questions = text.split('?').filter(q => q.trim().length > 10);
            questions.forEach(q => {
              const question = q.trim() + '?';
              if (question.length > 15) {
                sections[currentSection].push(question);
              }
            });
          }
        }
      } else if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*') || line.trim().match(/^\d+\./)) {
        const text = line.replace(/^[-•*\d.]\s*/, '').trim();
        if (text) sections[currentSection].push(text);
      }
    }
  }

  // Clean up string sections
  sections.vibeCheck = sections.vibeCheck.trim();
  sections.valuesNarrative = sections.valuesNarrative.trim();

  return sections;
}
