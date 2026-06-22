/**
 * Canonical bucket money math — the single source of truth shared by the Convex
 * backend (distribution / rollover / status) and the React frontend (overview /
 * detail / add-expense). Pure functions, no IO, no Convex APIs.
 *
 * Every derived number the app shows — available, allocated, each bucket's
 * claim on income, the funding ratio, whether you're over-planned — comes from
 * here. Before this, those formulas were re-implemented ~15 times and drifted,
 * which is what made the displayed numbers contradict each other.
 *
 * MODEL (decided): savings competes with spending for income. A save bucket's
 * monthly contribution counts toward "planned" exactly like a spend/recurring
 * plan, so if bills + spending + savings exceed income you are over-planned and
 * the one funding ratio scales everyone down together. There is no separate
 * "savings is best-effort" path.
 */

export type BucketLike = {
  _id?: string;
  name?: string;
  bucketMode?: 'spend' | 'save' | 'recurring';
  isActive?: boolean;

  // spend / recurring intent
  allocationType?: 'amount' | 'percentage';
  plannedAmount?: number;
  plannedPercent?: number;
  allocationValue?: number; // legacy fallback

  // derived/stored money
  fundedAmount?: number;
  carryoverBalance?: number;
  spentAmount?: number;

  // save intent
  targetAmount?: number;
  currentBalance?: number;
  contributionType?: 'amount' | 'percentage' | 'none';
  contributionAmount?: number;
  contributionPercent?: number;
};

export type ClaimKind = 'amount' | 'percentage' | 'legacy' | 'none';

/**
 * What a single bucket claims from this month's income — its planned draw.
 * Covers spend & recurring plans AND save contributions, because savings
 * competes. `detail` describes the rule for UI ("$200.00/mo", "10% of income").
 */
export function plannedClaim(
  bucket: BucketLike,
  totalIncome: number,
): { claim: number; kind: ClaimKind; detail: string } {
  if (bucket.isActive === false) return { claim: 0, kind: 'none', detail: '' };

  if (bucket.bucketMode === 'spend' || bucket.bucketMode === 'recurring') {
    if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
      return {
        claim: (totalIncome * bucket.plannedPercent) / 100,
        kind: 'percentage',
        detail: `${bucket.plannedPercent}% of income`,
      };
    }
    if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
      return { claim: bucket.plannedAmount, kind: 'amount', detail: `$${bucket.plannedAmount.toFixed(2)}/mo` };
    }
    if (bucket.allocationValue !== undefined) {
      return { claim: bucket.allocationValue, kind: 'legacy', detail: `$${bucket.allocationValue.toFixed(2)}/mo` };
    }
    return { claim: 0, kind: 'none', detail: '' };
  }

  if (bucket.bucketMode === 'save' && bucket.contributionType && bucket.contributionType !== 'none') {
    if (bucket.contributionType === 'percentage' && bucket.contributionPercent !== undefined) {
      return {
        claim: (totalIncome * bucket.contributionPercent) / 100,
        kind: 'percentage',
        detail: `${bucket.contributionPercent}% saved`,
      };
    }
    if (bucket.contributionType === 'amount' && bucket.contributionAmount !== undefined) {
      return { claim: bucket.contributionAmount, kind: 'amount', detail: `$${bucket.contributionAmount.toFixed(2)}/mo saved` };
    }
  }

  return { claim: 0, kind: 'none', detail: '' };
}

/** Sum of every active bucket's claim — the denominator of the funding ratio. */
export function totalPlanned(buckets: BucketLike[], totalIncome: number): number {
  return buckets.reduce((sum, b) => sum + plannedClaim(b, totalIncome).claim, 0);
}

/**
 * Fraction of each plan that income can actually fund. 1 when income covers the
 * plans; below 1 (and equal for everyone) when over-planned. Never above 1.
 */
export function fundingRatio(totalIncome: number, planned: number): number {
  if (planned <= 0) return 1;
  if (planned <= totalIncome) return 1;
  return totalIncome / planned;
}

/** The amount a bucket should actually be funded this month, after scaling. */
export function fundedTarget(bucket: BucketLike, buckets: BucketLike[], totalIncome: number): number {
  const planned = totalPlanned(buckets, totalIncome);
  return plannedClaim(bucket, totalIncome).claim * fundingRatio(totalIncome, planned);
}

/** Over-planned status for the whole set, used by the banner. */
export function planningStatus(buckets: BucketLike[], totalIncome: number) {
  const planned = totalPlanned(buckets, totalIncome);
  const funded = Math.min(planned, totalIncome);
  return {
    totalIncome,
    totalPlanned: planned,
    totalFunded: funded,
    unallocated: totalIncome - funded,
    isOverPlanned: planned > totalIncome,
    overPlannedBy: planned > totalIncome ? planned - totalIncome : 0,
  };
}

/**
 * Money currently available in a bucket.
 *  - save: the accumulated balance
 *  - spend/recurring: this month's funding + carryover − spent
 * Replaces the legacy `allocationValue − currentBalance` path, which ignored
 * carryover and disagreed with every other screen.
 */
export function getAvailable(bucket: BucketLike): number {
  if (bucket.bucketMode === 'save') return bucket.currentBalance || 0;
  return (bucket.fundedAmount || 0) + (bucket.carryoverBalance || 0) - (bucket.spentAmount || 0);
}

/** Total the bucket has to work with this month (before spending). */
export function getAllocated(bucket: BucketLike): number {
  if (bucket.bucketMode === 'save') return bucket.targetAmount || 0;
  return (bucket.fundedAmount || 0) + (bucket.carryoverBalance || 0);
}
