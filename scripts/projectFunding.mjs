// Read-only: project how each bucket's funding changes under "savings competes".
// Calls only deployed public queries — writes nothing, deploys nothing.
//   node scripts/projectFunding.mjs <userId>

import { ConvexHttpClient } from 'convex/browser';

const URL = 'https://polite-gull-255.convex.cloud';
const userId = process.argv[2];
if (!userId) { console.error('Usage: node scripts/projectFunding.mjs <userId>'); process.exit(1); }
const client = new ConvexHttpClient(URL);
const m = (n) => `$${(n ?? 0).toFixed(2)}`;

const now = new Date();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const claimOf = (b, income) => {
  if (b.bucketMode === 'spend' || b.bucketMode === 'recurring') {
    if (b.allocationType === 'percentage' && b.plannedPercent !== undefined) return (income * b.plannedPercent) / 100;
    if (b.allocationType === 'amount' && b.plannedAmount !== undefined) return b.plannedAmount;
    if (b.allocationValue !== undefined) return b.allocationValue;
    return 0;
  }
  if (b.bucketMode === 'save' && b.contributionType && b.contributionType !== 'none') {
    if (b.contributionType === 'percentage' && b.contributionPercent !== undefined) return (income * b.contributionPercent) / 100;
    if (b.contributionType === 'amount' && b.contributionAmount !== undefined) return b.contributionAmount;
  }
  return 0;
};
const isSpend = (b) => b.bucketMode === 'spend' || b.bucketMode === 'recurring';

const main = async () => {
  const [buckets, income] = await Promise.all([
    client.query('buckets:getByUser', { userId }),
    client.query('monthlyIncome:getByMonth', { userId, month: monthKey }),
  ]);
  const totalIncome = income.reduce((s, e) => s + e.amount, 0);

  const plannedSpend = buckets.filter(isSpend).reduce((s, b) => s + claimOf(b, totalIncome), 0);
  const plannedAll = buckets.reduce((s, b) => s + claimOf(b, totalIncome), 0);

  // TODAY: ratio computed off spend+recurring only (savings ignored), so usually 1.0.
  const oldRatio = plannedSpend > totalIncome && plannedSpend > 0 ? totalIncome / plannedSpend : 1;
  // AFTER: one ratio off everything (savings competes).
  const newRatio = plannedAll > totalIncome && plannedAll > 0 ? totalIncome / plannedAll : 1;

  console.log(`\n=== ${monthKey} · income ${m(totalIncome)} ===`);
  console.log(`planned (spend+bills) ${m(plannedSpend)}   planned (+savings) ${m(plannedAll)}`);
  console.log(`ratio today ${oldRatio.toFixed(4)}  →  ratio after ${newRatio.toFixed(4)}\n`);
  console.log('bucket'.padEnd(22), 'claim'.padStart(10), 'today'.padStart(10), 'after'.padStart(10), 'Δ'.padStart(9));

  let todaySum = 0, afterSum = 0;
  for (const b of [...buckets].sort((a, c) => claimOf(c, totalIncome) - claimOf(a, totalIncome))) {
    const claim = claimOf(b, totalIncome);
    if (claim <= 0) continue;
    const today = claim * (isSpend(b) ? oldRatio : 1); // savings funded fully today
    const after = claim * newRatio;
    todaySum += today; afterSum += after;
    console.log(
      `${b.name}`.slice(0, 22).padEnd(22),
      m(claim).padStart(10), m(today).padStart(10), m(after).padStart(10),
      `${after - today >= 0 ? '+' : ''}${(after - today).toFixed(2)}`.padStart(9),
    );
  }
  console.log('—'.repeat(64));
  console.log('TOTAL ALLOCATED'.padEnd(22), ''.padStart(10), m(todaySum).padStart(10), m(afterSum).padStart(10));
  console.log(`\ntoday allocates ${m(todaySum)} vs income ${m(totalIncome)}  →  ${todaySum > totalIncome ? `OVERDRAWN by ${m(todaySum - totalIncome)}` : 'within income'}`);
  console.log(`after  allocates ${m(afterSum)} vs income ${m(totalIncome)}  →  fits exactly\n(read-only — nothing changed)\n`);
};
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
