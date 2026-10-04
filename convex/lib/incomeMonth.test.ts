import { incomeMonthFor } from './incomeMonth';

describe('incomeMonthFor', () => {
  it('counts late-month pay toward the next month', () => {
    expect(incomeMonthFor(Date.UTC(2026, 8, 28, 3, 10))).toBe('2026-10'); // 28 Sep 11:10 SGT
    expect(incomeMonthFor(Date.UTC(2026, 11, 30, 4))).toBe('2027-01');
  });
  it('keeps early and mid-month money in its own month', () => {
    expect(incomeMonthFor(Date.UTC(2026, 9, 3, 4))).toBe('2026-10');
    expect(incomeMonthFor(Date.UTC(2026, 9, 15, 4))).toBe('2026-10');
  });
});
