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

  it('recurring → sinking fund: shows BANKED, never "remaining"', () => {
    const bucket = {
      bucketMode: 'recurring',
      plannedAmount: 250,
      fundedAmount: 250,
      carryoverBalance: 800, // accumulated from prior months
    } as unknown as Bucket;
    const d = getBucketDisplay(bucket, ctx([])); // no payment this month
    expect(d.label).toBe('BANKED');
    expect(d.amount).toBe(1050); // 250 funded + 800 carryover − 0 spent
    expect(d.subtext).toBe('$0.00 spent this month');
    expect(d.allocationText).toBe('Setting aside $250.00/mo');
    expect(d.subtext).not.toMatch(/remaining/);
  });

  it('recurring → banked can go negative right after a big bill', () => {
    const bucket = {
      bucketMode: 'recurring',
      plannedAmount: 250,
      fundedAmount: 250,
      carryoverBalance: 800,
    } as unknown as Bucket;
    const d = getBucketDisplay(bucket, ctx([{ amount: 1200, date: inMonth }]));
    expect(d.amount).toBe(-150); // 250 + 800 − 1200
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
