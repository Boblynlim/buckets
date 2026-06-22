// Read-only inspector for the LIVE polite-gull backend.
//
// Calls only already-deployed public queries — deploys nothing, writes nothing.
// Purpose: explain an empty review queue without shipping new functions.
//
//   node scripts/inspectLive.mjs <userId>
//
// Find <userId> in the Convex dashboard (Data → users table) for
// polite-gull-255, or from the app's network calls (any query carries it).

import { ConvexHttpClient } from 'convex/browser';

const URL = 'https://polite-gull-255.convex.cloud';
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/inspectLive.mjs <userId>');
  process.exit(1);
}

const client = new ConvexHttpClient(URL);

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const main = async () => {
  const user = await client.query('users:get', { userId });
  console.log('USER:', user ? { id: user._id, email: user.email, name: user.name } : null);

  const count = await client.query('pendingTransactions:pendingCount', { userId });
  console.log('\nPENDING COUNT (for this user):', count);

  const pending = await client.query('pendingTransactions:listPending', { userId });
  console.log('PENDING ROWS:', pending.length);
  for (const r of pending.slice(0, 10)) {
    console.log('  ', {
      bank: r.bank,
      amount: r.amount,
      merchant: r.merchant ?? null,
      direction: r.direction,
      needsAttention: r.needsAttention,
      date: new Date(r.date).toISOString().slice(0, 10),
    });
  }

  const buckets = await client.query('buckets:getByUser', { userId });
  console.log('\nBUCKETS:', buckets.length);
  for (const b of buckets) {
    console.log('  ', {
      name: b.name,
      mode: b.bucketMode,
      funded: b.fundedAmount,
      carryover: b.carryoverBalance,
      spent: b.spentAmount,
    });
  }

  // Income misclassification check: if spend alerts are being read as
  // "money in", they land in monthlyIncome instead of the queue. Surprise
  // income rows in recent months are the tell.
  console.log('\nRECENT INCOME (watch for misclassified spends):');
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = monthKey(d);
    const entries = await client.query('monthlyIncome:getByMonth', { userId, month: m });
    const total = entries.reduce((s, e) => s + e.amount, 0);
    console.log(`  ${m}: ${entries.length} entries, total ${total}`);
    for (const e of entries) {
      console.log(`      ${e.amount}  "${e.note ?? ''}"  confirmed=${e.isConfirmed}`);
    }
  }
};

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
