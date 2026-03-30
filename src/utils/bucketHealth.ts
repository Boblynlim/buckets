import type { Bucket, Expense } from '../types';

export type HealthStatus = 'healthy' | 'attention' | 'warning' | 'dormant';

export interface BucketHealth {
  status: HealthStatus;
  reason: string;
  detail: string;
  suggestion?: string;
  suggestedAmount?: number; // For one-tap adjust
  // For spend/recurring buckets
  avgMonthlySpend?: number;
  allocation?: number;
  spendRatio?: number;
  // For save buckets
  progressPercent?: number;
  monthsToGoal?: number;
  onTrack?: boolean;
}

// Dot colors
export const healthColors: Record<HealthStatus, string> = {
  healthy: '#7A9A6D',   // sage green
  attention: '#B8986A', // amber
  warning: '#B85C4A',   // terracotta red
  dormant: '#A89E92',   // muted gray
};

export function computeBucketHealth(
  bucket: Bucket,
  allExpenses: Expense[],
): BucketHealth {
  const now = Date.now();
  const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
  const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000;

  // Get expenses for this bucket
  const bucketExpenses = allExpenses.filter(e => e.bucketId === bucket._id);
  const recentExpenses = bucketExpenses.filter(e => e.date >= threeMonthsAgo);

  // ── Save buckets ──────────────────────────────────────────────────────
  if (bucket.bucketMode === 'save') {
    const target = bucket.targetAmount || 0;
    const current = bucket.currentBalance || 0;
    const hasContribution = (bucket.contributionAmount && bucket.contributionAmount > 0) ||
      (bucket.contributionPercent && bucket.contributionPercent > 0);
    const contributionAmount = bucket.contributionAmount || 0;

    if (target <= 0) {
      return { status: 'healthy', reason: 'No target set', detail: 'Savings bucket without a specific goal.' };
    }

    const progressPercent = Math.round((current / target) * 100);

    if (progressPercent >= 100) {
      return {
        status: 'healthy',
        reason: 'Goal reached',
        detail: `You've hit your $${target.toLocaleString()} goal!`,
        progressPercent,
      };
    }

    if (!hasContribution) {
      return {
        status: 'attention',
        reason: 'No contributions set',
        detail: `${progressPercent}% toward $${target.toLocaleString()} goal but no monthly contribution configured.`,
        suggestion: 'Set a monthly contribution to stay on track.',
        progressPercent,
      };
    }

    // If contribution is percentage-based, we can't calculate months-to-goal without income
    if (!contributionAmount) {
      return {
        status: 'healthy',
        reason: 'On track',
        detail: `${progressPercent}% toward $${target.toLocaleString()} goal with ${bucket.contributionPercent}% of income contributing.`,
        progressPercent,
        onTrack: true,
      };
    }

    const remaining = target - current;
    const monthsToGoal = Math.ceil(remaining / contributionAmount);

    if (monthsToGoal > 24) {
      const suggestedAmount = Math.ceil(remaining / 12);
      return {
        status: 'attention',
        reason: 'Slow progress',
        detail: `At $${contributionAmount}/mo, you'll reach your goal in ~${monthsToGoal} months.`,
        suggestion: `Increase to $${suggestedAmount}/mo to hit it in a year.`,
        suggestedAmount,
        progressPercent,
        monthsToGoal,
        onTrack: false,
      };
    }

    return {
      status: 'healthy',
      reason: 'On track',
      detail: `${progressPercent}% there. ~${monthsToGoal} months to go at $${contributionAmount}/mo.`,
      progressPercent,
      monthsToGoal,
      onTrack: true,
    };
  }

  // ── Spend / Recurring buckets ─────────────────────────────────────────
  const allocation = bucket.plannedAmount || bucket.allocationValue || 0;

  // Check for dormant bucket (no expenses in 2+ months)
  const hasRecentExpense = bucketExpenses.some(e => e.date >= twoMonthsAgo);
  if (!hasRecentExpense && bucketExpenses.length > 0 && allocation > 0) {
    return {
      status: 'dormant',
      reason: 'No recent activity',
      detail: `No expenses in 2+ months but $${allocation}/mo allocated.`,
      suggestion: `Free up $${allocation}/mo by reducing allocation.`,
      suggestedAmount: 0,
      allocation,
    };
  }

  // Not enough data yet
  if (recentExpenses.length < 2) {
    return {
      status: 'healthy',
      reason: 'New bucket',
      detail: 'Not enough data to assess yet.',
      allocation,
    };
  }

  // C: If >80% of expenses are necessary, skip overspend/underspend checks
  const necessaryCount = recentExpenses.filter(e => (e as any).isNecessary).length;
  const isMostlyNecessary = recentExpenses.length > 0 && (necessaryCount / recentExpenses.length) > 0.8;

  // Calculate per-month spend totals
  const monthBuckets: Record<string, number> = {};
  for (const e of recentExpenses) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthBuckets[key] = (monthBuckets[key] || 0) + e.amount;
  }
  const monthlyAmounts = Object.values(monthBuckets);
  const avgMonthlySpend = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length;
  const spendRatio = allocation > 0 ? avgMonthlySpend / allocation : 0;

  // For mostly-necessary buckets: only check if allocation matches the actual cost
  if (isMostlyNecessary) {
    // If allocation is way off from actual cost, suggest adjusting
    if (allocation > 0 && Math.abs(spendRatio - 1) > 0.3 && monthlyAmounts.length >= 2) {
      const suggestedAmount = Math.round(avgMonthlySpend);
      return {
        status: 'attention',
        reason: 'Allocation mismatch',
        detail: `Fixed cost is ~$${Math.round(avgMonthlySpend)}/mo but allocated $${allocation}/mo.`,
        suggestion: `Adjust allocation to $${suggestedAmount}/mo.`,
        suggestedAmount,
        avgMonthlySpend,
        allocation,
        spendRatio,
      };
    }
    return {
      status: 'healthy',
      reason: 'On track',
      detail: `Fixed cost ~$${Math.round(avgMonthlySpend)}/mo, allocated $${allocation}/mo.`,
      avgMonthlySpend,
      allocation,
      spendRatio,
    };
  }

  // E: For discretionary buckets, require 2+ months of data for overspend/underspend
  if (monthlyAmounts.length < 2) {
    return {
      status: 'healthy',
      reason: 'Building history',
      detail: `Spending ~$${Math.round(avgMonthlySpend)}/mo of $${allocation}/mo allocated.`,
      avgMonthlySpend,
      allocation,
      spendRatio,
    };
  }

  // E: Check if overspending is consistent (all tracked months above threshold)
  const overspendMonths = monthlyAmounts.filter(amt => allocation > 0 && amt / allocation > 1.3).length;
  if (overspendMonths >= 2 && allocation > 0) {
    const suggestedAmount = Math.round(avgMonthlySpend * 1.1);
    return {
      status: 'warning',
      reason: 'Consistently over budget',
      detail: `Spending ~$${Math.round(avgMonthlySpend)}/mo vs $${allocation}/mo allocated for ${overspendMonths} months.`,
      suggestion: `Raise to $${suggestedAmount}/mo to match reality.`,
      suggestedAmount,
      avgMonthlySpend,
      allocation,
      spendRatio,
    };
  }

  // E: Check if underspending is consistent
  const underspendMonths = monthlyAmounts.filter(amt => allocation > 0 && amt / allocation < 0.5).length;
  if (underspendMonths >= 2 && allocation > 50) {
    const suggestedAmount = Math.round(avgMonthlySpend * 1.15);
    const freed = Math.round(allocation - suggestedAmount);
    return {
      status: 'attention',
      reason: 'Consistently under budget',
      detail: `Spending ~$${Math.round(avgMonthlySpend)}/mo of $${allocation}/mo for ${underspendMonths} months.`,
      suggestion: `Reduce to $${suggestedAmount}/mo and free up $${freed}.`,
      suggestedAmount,
      avgMonthlySpend,
      allocation,
      spendRatio,
    };
  }

  // Default healthy
  return {
    status: 'healthy',
    reason: 'On track',
    detail: `Spending ~$${Math.round(avgMonthlySpend)}/mo of $${allocation}/mo allocated.`,
    avgMonthlySpend,
    allocation,
    spendRatio,
  };
}

// ── Dismiss helpers ─────────────────────────────────────────────────────
const DISMISS_KEY = 'buckets_dismissed_insights';

export function getInsightKey(bucketId: string, health: BucketHealth): string {
  return `${bucketId}:${health.status}:${health.reason}`;
}

function getDismissedInsights(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function dismissInsight(bucketId: string, health: BucketHealth): void {
  const dismissed = getDismissedInsights();
  dismissed.add(getInsightKey(bucketId, health));
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
}

export function isInsightDismissed(bucketId: string, health: BucketHealth): boolean {
  return getDismissedInsights().has(getInsightKey(bucketId, health));
}

// Get all buckets that need attention
export function getBucketsNeedingAttention(
  buckets: Bucket[],
  expenses: Expense[],
): Array<{ bucket: Bucket; health: BucketHealth }> {
  return buckets
    .map(bucket => ({
      bucket,
      health: computeBucketHealth(bucket, expenses),
    }))
    .filter(({ health }) => health.status !== 'healthy')
    .sort((a, b) => {
      const priority: Record<HealthStatus, number> = { warning: 0, attention: 1, dormant: 2, healthy: 3 };
      return priority[a.health.status] - priority[b.health.status];
    });
}
