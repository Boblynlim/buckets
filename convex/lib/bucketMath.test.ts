import {
  plannedClaim,
  totalPlanned,
  fundingRatio,
  fundedTarget,
  planningStatus,
  getAvailable,
  getAllocated,
  type BucketLike,
} from './bucketMath';

const spend = (over: Partial<BucketLike> = {}): BucketLike => ({
  bucketMode: 'spend',
  allocationType: 'amount',
  plannedAmount: 100,
  isActive: true,
  ...over,
});

describe('plannedClaim — savings competes', () => {
  it('spend amount / percentage / legacy', () => {
    expect(plannedClaim(spend({ plannedAmount: 250 }), 6400).claim).toBe(250);
    expect(plannedClaim(spend({ allocationType: 'percentage', plannedPercent: 10, plannedAmount: undefined }), 6400).claim).toBe(640);
    expect(plannedClaim({ bucketMode: 'spend', allocationValue: 80, isActive: true }, 6400).claim).toBe(80);
  });

  it('save contributions ALSO claim income (the decided model)', () => {
    const save: BucketLike = { bucketMode: 'save', contributionType: 'percentage', contributionPercent: 10, isActive: true };
    expect(plannedClaim(save, 6400).claim).toBe(640);
    const fixed: BucketLike = { bucketMode: 'save', contributionType: 'amount', contributionAmount: 200, isActive: true };
    expect(plannedClaim(fixed, 6400).claim).toBe(200);
  });

  it('inactive or no-contribution save claims nothing', () => {
    expect(plannedClaim(spend({ isActive: false }), 6400).claim).toBe(0);
    expect(plannedClaim({ bucketMode: 'save', contributionType: 'none', isActive: true }, 6400).claim).toBe(0);
  });
});

describe('funding ratio & over-plan', () => {
  const buckets: BucketLike[] = [
    spend({ plannedAmount: 6290.51 }), // bills + spend
    { bucketMode: 'save', contributionType: 'amount', contributionAmount: 640, isActive: true }, // savings
  ];

  it('total planned includes savings', () => {
    expect(totalPlanned(buckets, 6400)).toBeCloseTo(6930.51, 2);
  });

  it('reports over-planned by the savings overage', () => {
    const s = planningStatus(buckets, 6400);
    expect(s.isOverPlanned).toBe(true);
    expect(s.overPlannedBy).toBeCloseTo(530.51, 2);
  });

  it('one ratio scales everyone — no 1.0-vs-0.923 split', () => {
    const ratio = fundingRatio(6400, totalPlanned(buckets, 6400));
    expect(ratio).toBeCloseTo(0.9235, 3);
    // both the spend cup AND the save cup scale by the same ratio
    expect(fundedTarget(buckets[0], buckets, 6400)).toBeCloseTo(6290.51 * ratio, 2);
    expect(fundedTarget(buckets[1], buckets, 6400)).toBeCloseTo(640 * ratio, 2);
  });

  it('not over-planned → ratio 1, full funding', () => {
    const under = [spend({ plannedAmount: 1000 })];
    expect(fundingRatio(6400, totalPlanned(under, 6400))).toBe(1);
  });
});

describe('available / allocated', () => {
  it('spend: funded + carryover − spent (carryover NOT ignored)', () => {
    const b = spend({ fundedAmount: 600, carryoverBalance: 2440, spentAmount: 0 });
    expect(getAvailable(b)).toBe(3040); // the Fitness case — not the legacy $600
    expect(getAllocated(b)).toBe(3040);
  });

  it('save: balance and target', () => {
    const b: BucketLike = { bucketMode: 'save', currentBalance: 4200, targetAmount: 5000 };
    expect(getAvailable(b)).toBe(4200);
    expect(getAllocated(b)).toBe(5000);
  });
});
