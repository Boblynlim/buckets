// Read-only math audit for the LIVE polite-gull backend.
//
// Calls only already-deployed public queries — deploys nothing, writes nothing.
// Shows where the app's duplicated formulas DISAGREE on your real data, so we
// can pick the one correct formula per concept before consolidating (Phase 1).
//
//   node scripts/auditMath.mjs <userId>
//
// Find <userId> in the Convex dashboard (Data → users) for polite-gull-255.

import { ConvexHttpClient } from 'convex/browser';

const URL = 'https://polite-gull-255.convex.cloud';
const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/auditMath.mjs <userId>');
  process.exit(1);
}
const client = new ConvexHttpClient(URL);
const money = (n) => `$${(n ?? 0).toFixed(2)}`;

const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// --- the competing formulas, named ---------------------------------------
const availWeb = (b) =>
  b.bucketMode === 'save'
    ? (b.currentBalance || 0)
    : (b.fundedAmount || 0) + (b.carryoverBalance || 0) - (b.spentAmount || 0);

// native overview legacy path: allocationValue - currentBalance (getByUser now
// sets allocationValue = plannedAmount||plannedPercent for spend/recurring).
const availNativeLegacy = (b) => (b.allocationValue || 0) - (b.currentBalance || 0);

const plannedClaim = (b, income) => {
  if (b.bucketMode === 'spend' || b.bucketMode === 'recurring') {
    if (b.allocationType === 'percentage' && b.plannedPercent !== undefined)
      return (income * b.plannedPercent) / 100;
    if (b.allocationType === 'amount' && b.plannedAmount !== undefined) return b.plannedAmount;
    if (b.allocationValue !== undefined) return b.allocationValue;
  }
  return 0;
};
const saveContribution = (b, income) => {
  if (b.bucketMode === 'save' && b.contributionType && b.contributionType !== 'none') {
    if (b.contributionType === 'percentage' && b.contributionPercent !== undefined)
      return (income * b.contributionPercent) / 100;
    if (b.contributionType === 'amount' && b.contributionAmount !== undefined)
      return b.contributionAmount;
  }
  return 0;
};

const main = async () => {
  const [bucketsMonth, bucketsAllTime, income, status] = await Promise.all([
    client.query('buckets:getByUser', { userId, monthStart, monthEnd }),
    client.query('buckets:getByUser', { userId }), // no bounds → all-time spent
    client.query('monthlyIncome:getByMonth', { userId, month: monthKey }),
    client.query('distribution:getDistributionStatus', { userId }),
  ]);
  const totalIncome = income.reduce((s, e) => s + e.amount, 0);
  const allTimeSpent = new Map(bucketsAllTime.map((b) => [b._id, b.spentAmount]));

  console.log(`\n=== MONTH ${monthKey} · income ${money(totalIncome)} ===\n`);

  // --- per-bucket "available / left" divergences ---
  console.log('PER-BUCKET "left" (where formulas disagree):');
  for (const b of bucketsMonth) {
    const web = availWeb(b);
    const legacy = availNativeLegacy(b);
    const monthSpent = b.spentAmount;
    const lifeSpent = allTimeSpent.get(b._id);
    const flags = [];
    if (b.bucketMode !== 'save' && Math.abs(web - legacy) > 0.01)
      flags.push(`web=${money(web)} vs native-legacy=${money(legacy)}`);
    if (lifeSpent !== undefined && monthSpent !== undefined && Math.abs(lifeSpent - monthSpent) > 0.01)
      flags.push(`spent month=${money(monthSpent)} vs all-time=${money(lifeSpent)} (overview uses all-time when no month bounds!)`);
    if (flags.length) {
      console.log(`  • ${b.name} [${b.bucketMode}]`);
      flags.forEach((f) => console.log(`      ${f}`));
    }
  }

  // --- planned totals: funding basis vs banner basis ---
  let fundingBasis = 0; // spend+recurring only (distribution + rollover)
  let bannerBasis = 0; // + save contributions (getDistributionStatus)
  let fundedSum = 0;
  for (const b of bucketsMonth) {
    fundingBasis += plannedClaim(b, totalIncome);
    bannerBasis += plannedClaim(b, totalIncome) + saveContribution(b, totalIncome);
    fundedSum += b.fundedAmount || 0;
  }
  const ratio = (p) => (p > totalIncome && p > 0 ? totalIncome / p : 1);

  console.log('\nPLANNED TOTALS (the over-plan / funding mismatch):');
  console.log(`  funding basis (spend+recurring)      = ${money(fundingBasis)}  → ratio ${ratio(fundingBasis).toFixed(4)}`);
  console.log(`  banner basis (+ save contributions)  = ${money(bannerBasis)}  → ratio ${ratio(bannerBasis).toFixed(4)}`);
  console.log(`  getDistributionStatus.totalPlanned   = ${money(status.totalPlanned)}  (isOverPlanned=${status.isOverPlanned}, overBy=${money(status.overPlannedBy)})`);
  console.log(`  Σ fundedAmount actually on buckets    = ${money(fundedSum)}`);
  if (Math.abs(fundingBasis - bannerBasis) > 0.01)
    console.log(`  ⚠ funding ratio and over-plan banner use DIFFERENT totals → cups funded on ${ratio(fundingBasis).toFixed(3)} but banner reports overage on ${ratio(bannerBasis).toFixed(3)}`);
  if (Math.abs(status.totalPlanned - bannerBasis) > 0.01)
    console.log(`  ⚠ recomputed banner basis (${money(bannerBasis)}) ≠ live status (${money(status.totalPlanned)})`);

  console.log('\n(read-only — nothing was changed)\n');
};

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
