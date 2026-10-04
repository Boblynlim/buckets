// Which month a pay-in funds. Pay that lands in the last week of a month
// (Singapore time) funds the next month: the 28 Sep salary is October's money.
export function incomeMonthFor(date: number): string {
  const sg = new Date(date + 8 * 3600 * 1000);
  let y = sg.getUTCFullYear();
  let m = sg.getUTCMonth() + 1;
  if (sg.getUTCDate() >= 24) {
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}
