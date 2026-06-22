import {
  computeRecurringAmount,
  totalPlannedFor,
  fundingRatioFor,
  type RecurringBucketLike,
} from './recurring';

// These tests pin the invariant the rollover fix relies on: the funded amount
// a recurring bucket receives during rollover must equal the auto-pay expense
// the sync creates for it. The rollover computes funding as
// `base * fundingRatioFor(income, totalPlannedFor(...))`; the sync computes the
// auto-pay via `computeRecurringAmount`. If those ever diverge, an on-plan
// recurring bucket would generate a phantom carryover (or debt) every month —
// which is exactly the class of bug that made overspend math look "off".

describe('recurring funding consistency', () => {
  // Mirror the rollover's funding calc for a single recurring bucket.
  const rolloverFundedAmount = (
    bucket: RecurringBucketLike,
    all: RecurringBucketLike[],
    income: number,
  ): number => {
    let base = 0;
    if (bucket.allocationType === 'percentage' && bucket.plannedPercent !== undefined) {
      base = (income * bucket.plannedPercent) / 100;
    } else if (bucket.allocationType === 'amount' && bucket.plannedAmount !== undefined) {
      base = bucket.plannedAmount;
    }
    return base * fundingRatioFor(income, totalPlannedFor(all, income));
  };

  it('funded amount matches the auto-pay amount when within budget', () => {
    const insurance: RecurringBucketLike = {
      _id: 'a',
      bucketMode: 'recurring',
      allocationType: 'amount',
      plannedAmount: 300,
      isActive: true,
    };
    const groceries: RecurringBucketLike = {
      _id: 'b',
      bucketMode: 'spend',
      allocationType: 'amount',
      plannedAmount: 500,
      isActive: true,
    };
    const all = [insurance, groceries];
    const income = 2000;

    expect(rolloverFundedAmount(insurance, all, income)).toBeCloseTo(
      computeRecurringAmount(insurance, all, income).amount,
    );
  });

  it('stays consistent when plans overrun income (funding ratio < 1)', () => {
    const insurance: RecurringBucketLike = {
      _id: 'a',
      bucketMode: 'recurring',
      allocationType: 'amount',
      plannedAmount: 800,
      isActive: true,
    };
    const rent: RecurringBucketLike = {
      _id: 'b',
      bucketMode: 'recurring',
      allocationType: 'amount',
      plannedAmount: 1500,
      isActive: true,
    };
    const all = [insurance, rent];
    const income = 1000; // overplanned: ratio = 1000 / 2300

    const funded = rolloverFundedAmount(insurance, all, income);
    const autoPay = computeRecurringAmount(insurance, all, income).amount;

    expect(funded).toBeCloseTo(autoPay);
    expect(funded).toBeLessThan(800); // ratio applied
  });

  it('percentage and amount recurring buckets share the same denominator', () => {
    const pct: RecurringBucketLike = {
      _id: 'a',
      bucketMode: 'recurring',
      allocationType: 'percentage',
      plannedPercent: 10,
      isActive: true,
    };
    const amt: RecurringBucketLike = {
      _id: 'b',
      bucketMode: 'recurring',
      allocationType: 'amount',
      plannedAmount: 400,
      isActive: true,
    };
    const all = [pct, amt];
    const income = 3000;

    expect(rolloverFundedAmount(pct, all, income)).toBeCloseTo(
      computeRecurringAmount(pct, all, income).amount,
    );
    expect(rolloverFundedAmount(amt, all, income)).toBeCloseTo(
      computeRecurringAmount(amt, all, income).amount,
    );
  });
});
