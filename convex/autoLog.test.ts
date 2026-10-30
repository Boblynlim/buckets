import { sgMonth, sgDay, dayStamp } from './autoLog';

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

describe('autoLog dates', () => {
  it('reads the month and day in Singapore time, not UTC', () => {
    // 31 Oct 2026 18:00 UTC is already 1 Nov in Singapore (UTC+8).
    const t = Date.UTC(2026, 9, 31, 18, 0, 0);
    expect(sgMonth(t)).toBe('2026-11');
    expect(sgDay(t)).toBe(1);
  });

  it('keeps the same day either side of midnight UTC', () => {
    expect(sgDay(Date.UTC(2026, 10, 6, 1, 0, 0))).toBe(6);
    expect(sgDay(Date.UTC(2026, 10, 6, 15, 0, 0))).toBe(6); // 23:00 SGT
  });

  it('stamps the chosen day at noon', () => {
    expect(iso(dayStamp('2026-11', 6))).toBe('2026-11-06');
    expect(iso(dayStamp('2027-01', 6))).toBe('2027-01-06');
  });

  it('clamps a day the month does not have', () => {
    expect(iso(dayStamp('2026-02', 31))).toBe('2026-02-28');
    expect(iso(dayStamp('2028-02', 31))).toBe('2028-02-29'); // leap year
    expect(iso(dayStamp('2026-11', 31))).toBe('2026-11-30');
    expect(iso(dayStamp('2026-11', 0))).toBe('2026-11-01');
  });
});
