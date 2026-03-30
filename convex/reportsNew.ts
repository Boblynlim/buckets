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

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonthBucket {
  label: string; // e.g. "2026-01"
  start: number;
  end: number;
  expenses: any[];
  total: number;
  discretionary: any[];
  necessary: any[];
  discretionaryTotal: number;
  necessaryTotal: number;
  worthItCount: number;
  notWorthItCount: number;
  byCategory: Record<string, { amount: number; worthIt: number; notWorthIt: number; notes: string[] }>;
}

interface WorthItIntelligence {
  worthItPercent: number;
  notWorthItTotal: number;
  topNotWorthItCategories: string[];
  insight: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(timestamp: number): { start: number; end: number } {
  const d = new Date(timestamp);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

function buildMonthBuckets(expenses: any[]): MonthBucket[] {
  const byMonth: Record<string, any[]> = {};

  for (const e of expenses) {
    const label = getMonthLabel(e.date);
    if (!byMonth[label]) byMonth[label] = [];
    byMonth[label].push(e);
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, monthExpenses]) => {
      const necessary = monthExpenses.filter((e: any) => e.isNecessary === true);
      const discretionary = monthExpenses.filter((e: any) => e.isNecessary !== true);

      const byCategory: Record<string, { amount: number; worthIt: number; notWorthIt: number; notes: string[] }> = {};
      for (const e of monthExpenses) {
        const cat = e.category || 'Uncategorized';
        if (!byCategory[cat]) byCategory[cat] = { amount: 0, worthIt: 0, notWorthIt: 0, notes: [] };
        byCategory[cat].amount += e.amount;
        if (e.isNecessary !== true) {
          if (e.worthIt === true) byCategory[cat].worthIt++;
          if (e.worthIt === false) byCategory[cat].notWorthIt++;
        }
        if (e.note) byCategory[cat].notes.push(e.note);
      }

      const discretionaryWithRating = discretionary.filter((e: any) => e.worthIt === true || e.worthIt === false);
      const worthItCount = discretionary.filter((e: any) => e.worthIt === true).length;
      const notWorthItCount = discretionary.filter((e: any) => e.worthIt === false).length;

      const range = getMonthRange(monthExpenses[0].date);

      return {
        label,
        start: range.start,
        end: range.end,
        expenses: monthExpenses,
        total: monthExpenses.reduce((s: number, e: any) => s + e.amount, 0),
        discretionary,
        necessary,
        discretionaryTotal: discretionary.reduce((s: number, e: any) => s + e.amount, 0),
        necessaryTotal: necessary.reduce((s: number, e: any) => s + e.amount, 0),
        worthItCount,
        notWorthItCount,
        byCategory,
      };
    });
}

function calculateWorthItIntelligence(months: MonthBucket[]): Omit<WorthItIntelligence, 'insight'> {
  let totalDiscretionaryRated = 0;
  let totalWorthIt = 0;
  let notWorthItDollars = 0;
  const notWorthItByCategory: Record<string, number> = {};

  for (const month of months) {
    for (const e of month.discretionary) {
      if (e.worthIt === true) {
        totalWorthIt++;
        totalDiscretionaryRated++;
      } else if (e.worthIt === false) {
        totalDiscretionaryRated++;
        notWorthItDollars += e.amount;
        const cat = e.category || 'Uncategorized';
        notWorthItByCategory[cat] = (notWorthItByCategory[cat] || 0) + 1;
      }
    }
  }

  const worthItPercent = totalDiscretionaryRated > 0
    ? Math.round((totalWorthIt / totalDiscretionaryRated) * 100)
    : 0;

  const topNotWorthItCategories = Object.entries(notWorthItByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat]) => cat);

  return {
    worthItPercent,
    notWorthItTotal: Math.round(notWorthItDollars * 100) / 100,
    topNotWorthItCategories,
  };
}

function calculateCategoryTrends(months: MonthBucket[]): string {
  if (months.length < 2) return 'Not enough data for trends yet.';

  const allCategories = new Set<string>();
  for (const m of months) {
    for (const cat of Object.keys(m.byCategory)) allCategories.add(cat);
  }

  const lines: string[] = [];
  for (const cat of allCategories) {
    const amounts = months.map(m => m.byCategory[cat]?.amount || 0);
    if (amounts.length >= 3) {
      const last3 = amounts.slice(-3);
      const increasing = last3[0] < last3[1] && last3[1] < last3[2];
      const decreasing = last3[0] > last3[1] && last3[1] > last3[2];
      if (increasing || decreasing) {
        const direction = increasing ? 'increasing' : 'decreasing';
        lines.push(`${cat}: $${last3.map(a => a.toFixed(0)).join(' -> ')} (${direction} over 3 months)`);
      }
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No strong multi-month trends detected.';
}

// ─── Main Action ─────────────────────────────────────────────────────────────

export const generateMonthlyReport = action({
  args: {
    userId: v.id('users'),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodEnd = args.periodEnd || now;
    // Default: current month
    const periodEndDate = new Date(periodEnd);
    const currentMonthRange = getMonthRange(periodEnd);
    const periodStart = args.periodStart || currentMonthRange.start;

    // ── 1. Gather ALL data ──────────────────────────────────────────────────

    const allExpenses = await ctx.runQuery(api.expenses.getByUser, { userId: args.userId }) as any[];
    const buckets = await ctx.runQuery(api.buckets.getByUser, { userId: args.userId }) as any[];
    const memories = await ctx.runQuery(api.memories.getByUser, { userId: args.userId }) as any[];

    // ── 2. Build month buckets for cross-month analysis ─────────────────────

    const allMonths = buildMonthBuckets(allExpenses);
    const currentMonthLabel = getMonthLabel(periodEnd);
    const currentMonth = allMonths.find(m => m.label === currentMonthLabel);

    // Get at least the last 3 months for trend analysis
    const recentMonths = allMonths.slice(-Math.max(3, allMonths.length));

    // Expenses in the report period specifically
    const expensesInPeriod = allExpenses.filter((e: any) =>
      e.date >= periodStart && e.date <= periodEnd
    );

    // ── 3. Calculate structured metrics ─────────────────────────────────────

    const totalSpent = expensesInPeriod.reduce((s: number, e: any) => s + e.amount, 0);
    const necessaryInPeriod = expensesInPeriod.filter((e: any) => e.isNecessary === true);
    const discretionaryInPeriod = expensesInPeriod.filter((e: any) => e.isNecessary !== true);
    const necessaryTotal = necessaryInPeriod.reduce((s: number, e: any) => s + e.amount, 0);
    const discretionaryTotal = discretionaryInPeriod.reduce((s: number, e: any) => s + e.amount, 0);
    const necessaryPercent = totalSpent > 0 ? Math.round((necessaryTotal / totalSpent) * 100) : 0;

    // Worth-it intelligence across all available months
    const worthItStats = calculateWorthItIntelligence(recentMonths);

    // Category breakdown for current period
    const byCategory: Record<string, { amount: number; worthItCount: number; notWorthItCount: number; notes: string[] }> = {};
    for (const e of expensesInPeriod) {
      const cat = e.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { amount: 0, worthItCount: 0, notWorthItCount: 0, notes: [] };
      byCategory[cat].amount += e.amount;
      if (e.isNecessary !== true) {
        if (e.worthIt === true) byCategory[cat].worthItCount++;
        if (e.worthIt === false) byCategory[cat].notWorthItCount++;
      }
      if (e.note) byCategory[cat].notes.push(e.note);
    }

    const categoryBreakdown = Object.entries(byCategory)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([cat, data]) => {
        const totalRated = data.worthItCount + data.notWorthItCount;
        const worthPct = totalRated > 0 ? Math.round((data.worthItCount / totalRated) * 100) : null;
        return {
          category: cat,
          amount: data.amount,
          worthItPercent: worthPct,
          notWorthItCount: data.notWorthItCount,
          notes: data.notes.slice(0, 5),
        };
      });

    // Month-over-month totals
    const monthTotals = recentMonths.map(m => ({
      label: m.label,
      total: m.total,
      discretionary: m.discretionaryTotal,
      necessary: m.necessaryTotal,
    }));

    // Category trend strings
    const categoryTrends = calculateCategoryTrends(recentMonths);

    // Worth-it by category for current period (for worth-it intelligence per category)
    const worthItByCategory = Object.entries(byCategory)
      .filter(([, d]) => (d.worthItCount + d.notWorthItCount) > 0)
      .map(([cat, d]) => {
        const total = d.worthItCount + d.notWorthItCount;
        return {
          category: cat,
          worthItPercent: Math.round((d.worthItCount / total) * 100),
          notWorthItCount: d.notWorthItCount,
          amount: d.amount,
        };
      })
      .sort((a, b) => a.worthItPercent - b.worthItPercent);

    // ── 4. Bucket health ────────────────────────────────────────────────────

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
        .reduce((s: number, e: any) => s + e.amount, 0);
      const monthlyAlloc = bucket.allocationType === 'percentage'
        ? `${bucket.plannedPercent || 0}% of income`
        : bucket.plannedAmount || 0;
      const banked = bucket.currentBalance || 0;
      const remaining = banked - spent;
      const monthlyAmount = typeof monthlyAlloc === 'number' ? monthlyAlloc : 0;
      const runway = monthlyAmount > 0 ? `${Math.floor(remaining / monthlyAmount)} months buffer` : '-';
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
        .reduce((s: number, e: any) => s + e.amount, 0);
      return { category: bucket.name, thisWeek: spent, monthlyBudget: bucket.plannedAmount || 0 };
    });
    const fixedCostsTotal = fixedCosts.reduce((s: number, f: any) => s + f.thisWeek, 0);

    // ── 5. Build AI prompt ──────────────────────────────────────────────────

    const prompt = `You are a sharp, data-driven financial friend. Not a therapist. Think of yourself as the friend who's good with money and notices patterns others miss. You're helping analyze spending data.

Here's the raw data. Use actual numbers and percentages in your response.

REPORT PERIOD: ${new Date(periodStart).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}

CURRENT MONTH:
- Total spent: $${totalSpent.toFixed(2)}
- Necessary spending: $${necessaryTotal.toFixed(2)} (${necessaryPercent}%)
- Discretionary spending: $${discretionaryTotal.toFixed(2)} (${100 - necessaryPercent}%)
- ${expensesInPeriod.length} transactions

MONTH-OVER-MONTH TOTALS (recent months):
${monthTotals.map(m => `- ${m.label}: $${m.total.toFixed(2)} (necessary: $${m.necessary.toFixed(2)}, discretionary: $${m.discretionary.toFixed(2)})`).join('\n')}

CATEGORY BREAKDOWN (this month, sorted by spend):
${categoryBreakdown.map(c => `- ${c.category}: $${c.amount.toFixed(2)}${c.worthItPercent !== null ? ` | ${c.worthItPercent}% worth it (${c.notWorthItCount} marked not worth it)` : ''}\n  Notes: ${c.notes.join(', ') || 'none'}`).join('\n')}

CATEGORY TRENDS (multi-month):
${categoryTrends}

WORTH-IT INTELLIGENCE (across ${recentMonths.length} months):
- ${worthItStats.worthItPercent}% of rated discretionary spending marked "worth it"
- $${worthItStats.notWorthItTotal.toFixed(2)} total spent on things marked "not worth it"
- Top "not worth it" categories: ${worthItStats.topNotWorthItCategories.join(', ') || 'none yet'}

WORTH-IT BY CATEGORY (this month):
${worthItByCategory.map(c => `- ${c.category}: ${c.worthItPercent}% worth it ($${c.amount.toFixed(2)} total, ${c.notWorthItCount} not-worth-it)`).join('\n') || 'No rated expenses this month.'}

BUCKET HEALTH:
- Running low: ${fundsRunningLow.join(', ') || 'none'}
- Healthy: ${fundsHealthy.join(', ') || 'none'}

MEMORIES/CONTEXT:
${memories.slice(0, 10).map((m: any) => `- ${m.content}`).join('\n') || 'none'}

---

Generate exactly these sections. Be concise and data-driven. Use actual numbers from the data above.

## LIFESTYLE FINGERPRINT
[One paragraph: who is this person as a spender based on ${recentMonths.length} months of data? What categories dominate? What's the necessary vs discretionary split? What does the spending pattern say about their lifestyle? Be specific with numbers.]

## SHIFTS
[Bullet list: What's genuinely changing month over month? Only flag real trends backed by the data above, not noise. If nothing is trending, say so. Each bullet should include the actual numbers.]

## WORTH IT INSIGHT
[One paragraph: What does the worth-it data reveal? Where does regret concentrate? Any categories that are consistently worth it vs consistently not? Connect the dots between categories and satisfaction. Use the actual percentages.]

## NUDGES
[2-3 specific, actionable bullets based on the data. Not generic tips. Reference actual numbers and categories. E.g. "You rated X worth it Y% of the time vs Z% for W. Swapping N of W per month would save ~$X."]

## ONE THING
[A single sentence. The one insight that connects the most dots. The kind of thing a financially-savvy friend would say over coffee.]`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiResponse = completion.content[0].type === 'text' ? completion.content[0].text : '';

    // ── 6. Parse AI response ────────────────────────────────────────────────

    const parsed = parseReportResponse(aiResponse);

    // ── 7. Build worth-it intelligence object ───────────────────────────────

    const worthItIntelligence: WorthItIntelligence = {
      ...worthItStats,
      insight: parsed.worthItInsight,
    };

    // ── 8. Save report ──────────────────────────────────────────────────────

    const reportId: any = await ctx.runMutation(api.reportsNew.insertReport, {
      userId: args.userId,
      reportType: 'monthly',
      periodStart,
      periodEnd,
      // lifestyleFingerprint -> vibeCheck
      vibeCheck: parsed.lifestyleFingerprint,
      // worthItIntelligence -> goalPulse (v.any())
      goalPulse: worthItIntelligence,
      fundStatus,
      fundsRunningLow,
      fundsHealthy,
      // unused but required by schema
      valuesAlignment: {
        narrative: '',
        aligned: [],
        worthALook: [],
      },
      // shifts -> patternsAndFlags.trends
      patternsAndFlags: {
        trends: parsed.shifts,
        repeats: [],
        joyEfficiency: [],
      },
      sgNudges: {
        thisWeek: [],
        generalReminders: [],
      },
      // oneThing -> reflectionPrompts (single item array)
      reflectionPrompts: [parsed.oneThing],
      fixedCosts,
      fixedCostsTotal,
      // nudges -> wins
      wins: parsed.nudges,
      createdAt: now,
    });

    // ── 9. Save key insights as memories ────────────────────────────────────

    const insightMemories = [
      ...parsed.shifts.slice(0, 2),
      parsed.oneThing,
    ].filter(s => s && s.length > 10);

    for (const insight of insightMemories) {
      await ctx.runMutation(api.memories.create, {
        userId: args.userId,
        memoryType: 'context',
        content: insight,
        source: 'monthly-report',
        importance: 4,
      });
    }

    return reportId;
  },
});

// ─── Parse AI Response ───────────────────────────────────────────────────────

function parseReportResponse(response: string): {
  lifestyleFingerprint: string;
  shifts: string[];
  worthItInsight: string;
  nudges: string[];
  oneThing: string;
} {
  const result = {
    lifestyleFingerprint: '',
    shifts: [] as string[],
    worthItInsight: '',
    nudges: [] as string[],
    oneThing: '',
  };

  const lines = response.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('LIFESTYLE FINGERPRINT')) { currentSection = 'fingerprint'; continue; }
    if (trimmed.includes('SHIFTS')) { currentSection = 'shifts'; continue; }
    if (trimmed.includes('WORTH IT INSIGHT')) { currentSection = 'worthIt'; continue; }
    if (trimmed.includes('NUDGES')) { currentSection = 'nudges'; continue; }
    if (trimmed.includes('ONE THING')) { currentSection = 'oneThing'; continue; }

    if (!trimmed || trimmed.startsWith('#')) continue;

    switch (currentSection) {
      case 'fingerprint':
        result.lifestyleFingerprint += (result.lifestyleFingerprint ? ' ' : '') + trimmed;
        break;
      case 'shifts':
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^\d+\./)) {
          result.shifts.push(trimmed.replace(/^[-*\d.]\s*/, '').trim());
        }
        break;
      case 'worthIt':
        result.worthItInsight += (result.worthItInsight ? ' ' : '') + trimmed;
        break;
      case 'nudges':
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^\d+\./)) {
          result.nudges.push(trimmed.replace(/^[-*\d.]\s*/, '').trim());
        }
        break;
      case 'oneThing':
        if (!result.oneThing && trimmed.length > 5) {
          result.oneThing = trimmed;
        }
        break;
    }
  }

  // Fallbacks
  if (!result.lifestyleFingerprint) result.lifestyleFingerprint = 'Not enough data to generate a lifestyle fingerprint yet.';
  if (!result.worthItInsight) result.worthItInsight = 'Not enough worth-it ratings to generate insights yet.';
  if (!result.oneThing) result.oneThing = 'Keep tracking - patterns emerge with more data.';
  if (result.nudges.length === 0) result.nudges = ['Rate more expenses as "worth it" or "not worth it" to unlock personalized nudges.'];
  if (result.shifts.length === 0) result.shifts = ['Not enough months of data to detect shifts yet.'];

  return result;
}
