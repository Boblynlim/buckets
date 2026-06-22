import { getBucketDisplay, BucketDisplayContext } from '../src/utils/bucketPresentation';
import type { Bucket } from '../src/types';

// A fixed month window for deterministic "this month" sums.
const MONTH_START = new Date(2026, 5, 1).getTime(); // Jun 2026
const MONTH_END = new Date(2026, 5, 30, 23, 59, 59, 999).getTime();
const inMonth = new Date(2026, 5, 15).getTime();
const lastMonth = new Date(2026, 4, 15).getTime();

const ctx = (expenses: { amount: number; date: number }[]): BucketDisplayContext => ({
  expenses,
  monthStart: MONTH_START,
  monthEnd: MONTH_END,
});

describe('getBucketDisplay', () => {
  it('save → balance framing, not spending', () => {
    const bucket = {
      bucketMode: 'save',
      currentBalance: 4200,
      targetAmount: 5000,
      contributionType: 'amount',
      contributionAmount: 200,
    } as unknown as Bucket;
    const d = getBucketDisplay(bucket, ctx([]));
    expect(d.label).toBe('CURRENT SAVINGS');
    expect(d.amount).toBe(4200);
    expect(d.subtext).toBe('$4200.00 saved of $5000.00');
    expect(d.allocationText).toBe('Monthly contribution: $200.00');
  });

  it('recurring → accumulated total, never "remaining"', () => {
    const bucket = {
      bucketMode: 'recurring',
      plannedAmount: 250,
      fundedAmount: 250,
    } as unknown as Bucket;
    const d = getBucketDisplay(
      bucket,
      ctx([
        { amount: 250, date: inMonth },
        { amount: 250, date: lastMonth },
        { amount: 250, date: new Date(2026, 3, 15).getTime() },
      ]),
    );
    expect(d.label).toBe('TOTAL CONTRIBUTED');
    expect(d.amount).toBe(750); // all-time, not this month
    expect(d.subtext).toBe('$250.00 this month');
    expect(d.allocationText).toBe('Monthly: $250.00');
    expect(d.subtext).not.toMatch(/remaining/);
  });

  it('spend → this-month spent vs available (incl. carryover)', () => {
    const bucket = {
      bucketMode: 'spend',
      fundedAmount: 500,
      carryoverBalance: 100,
    } as unknown as Bucket;
    const d = getBucketDisplay(
      bucket,
      ctx([
        { amount: 120, date: inMonth },
        { amount: 80, date: inMonth },
        { amount: 999, date: lastMonth }, // ignored — different month
      ]),
    );
    expect(d.label).toBe('TOTAL SPENT');
    expect(d.amount).toBe(200);
    expect(d.subtext).toBe('$400.00 remaining of $600.00');
  });

  it('missing/unknown mode → falls back to spend, never blank', () => {
    const bucket = { fundedAmount: 300 } as unknown as Bucket;
    const d = getBucketDisplay(bucket, ctx([{ amount: 50, date: inMonth }]));
    expect(d.label).toBe('TOTAL SPENT');
    expect(d.amount).toBe(50);
  });
});
