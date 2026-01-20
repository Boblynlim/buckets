# Bucket System Issues & Solutions

## Issue 1: Insufficient Balance Error (Despite Showing Money)

### Current Problem
- The **Buckets Overview** shows planned amounts (e.g., "$100.00 left of $100.00")
- But when adding an expense, it says "insufficient balance"
- This happens because the bucket has a **planned** amount but no **funded** amount

### Root Cause
The system has TWO balance concepts:
1. **Planned Amount** - How much you WANT to allocate (shown in overview)
2. **Funded Amount** - How much money is ACTUALLY available to spend

**For spend buckets, the available balance is: `fundedAmount - spentAmount`**

However, the AddExpense screen incorrectly shows `currentBalance` instead of calculating the real available balance.

### Why Buckets Aren't Funded
The distribution system (in `convex/distribution.ts`) only distributes **RECURRING income**:
```typescript
// Line 20: Only recurring income is used
.filter(q => q.eq(q.field('isRecurring'), true))
```

So if you:
- Added income with `isRecurring: false` → Buckets won't be funded
- Haven't added any income yet → Buckets won't be funded
- Created buckets before adding income → Need to add recurring income

### Solutions

#### Option A: Fix the UI to show correct balance
Update `AddExpense.tsx` to calculate available balance properly:
```typescript
// For spend buckets:
const available = (bucket.fundedAmount || 0) - (bucket.spentAmount || 0);

// For save buckets:
const available = bucket.currentBalance || 0;
```

#### Option B: Support one-time income distribution
Modify `convex/distribution.ts` to allow distributing one-time income:
- Remove the `isRecurring` filter
- Track which income has been distributed
- Don't distribute the same income twice

#### Option C: Manual funding
Add a "Fund Bucket" button that lets users manually add money to buckets without income distribution.

---

## Issue 2: Double Distribution When Creating New Buckets

### Current Behavior
**Good news: No double distribution occurs!**

Looking at `convex/distribution.ts` line 70:
```typescript
await ctx.db.patch(plan.id, {
  fundedAmount: funded,  // This REPLACES, not ADDS
});
```

The system uses `patch` to SET the funded amount, not increment it.

### What Happens
1. Add income ($1000) → Distribute → Groceries gets $400
2. Create new bucket "Emergency"
3. Redistribute → The system recalculates from scratch:
   - Groceries still gets $400 (not $800)
   - Emergency gets its share from the same $1000 total

### How It Works
Each time distribution runs:
1. Calculates total recurring income
2. Recalculates how much each bucket should get
3. **Replaces** the funded amount (doesn't add)

So re-distributing is **safe** and won't create duplicate money.

---

## Issue 3: Monthly Rollovers & Accumulation

### Current Problem
**Rollovers are NOT implemented yet.**

The current system:
- Has a single `fundedAmount` field per bucket
- No concept of "monthly periods" or "cycles"
- No rollover of unused funds to next month
- No tracking of "this month's allocation" vs "accumulated savings"

### What's Missing
To properly track accumulated money across months, you need:

1. **Period-based funding**: Track funding per month/cycle
2. **Rollover mechanism**: Carry forward unspent amounts
3. **Historical tracking**: See how much came from this month vs previous months

### Recommended Architecture

#### Database Schema Changes
```typescript
// Add to buckets table:
{
  // Current month funding
  currentPeriodFunding: number,

  // Accumulated from previous periods
  carryoverBalance: number,

  // Last rollover date
  lastRolloverDate: number,
}

// New table: funding_periods
{
  bucketId: Id<'buckets'>,
  periodStart: number,
  periodEnd: number,
  fundedAmount: number,
  spentAmount: number,
  rolledOver: number,
}
```

#### Rollover Logic
```typescript
// At the start of each month:
1. Calculate unused funds: fundedAmount - spentAmount
2. Roll forward to next month: carryoverBalance += unused
3. Reset currentPeriodFunding to new month's allocation
4. Total available = currentPeriodFunding + carryoverBalance
```

### Implementation Options

#### Option A: Simple Monthly Rollover (Recommended for MVP)
```typescript
// Available balance = this month's funding + previous months' savings
available = fundedAmount + carryoverBalance - spentThisMonth
```

Pros:
- Simple to implement
- Easy to understand
- Works for most use cases

Cons:
- No detailed period history
- Can't see "what I got in March vs April"

#### Option B: Period-based Tracking (Full Feature)
Track each month as a separate record, showing:
- January: Funded $100, Spent $80, Rolled over $20
- February: Funded $100 + $20 rollover = $120, Spent $90, Rolled over $30
- March: Funded $100 + $30 rollover = $130...

Pros:
- Complete history
- Can generate detailed reports
- Can see trends over time

Cons:
- More complex
- Requires migration of existing data
- Need to decide when to "finalize" a period

---

## Recommended Immediate Actions

### 1. Fix the Insufficient Balance Error (Quick Win)
Update `src/screens/AddExpense.tsx` around line 250:

```typescript
// OLD:
<Text style={styles.bucketBalanceHint}>
  ${(selectedBucket.currentBalance || 0).toFixed(2)} available
</Text>

// NEW:
<Text style={styles.bucketBalanceHint}>
  ${(() => {
    if (selectedBucket.bucketMode === 'spend') {
      const funded = selectedBucket.fundedAmount || 0;
      const spent = selectedBucket.spentAmount || 0;
      return (funded - spent).toFixed(2);
    }
    return (selectedBucket.currentBalance || 0).toFixed(2);
  })()} available
</Text>
```

### 2. Make Income Distribution Clear
Show in the UI:
- Total recurring income
- How it's distributed across buckets
- Warning if buckets aren't funded yet

### 3. Plan Rollover Implementation
Decide:
- When should rollovers happen? (Auto monthly? Manual?)
- Should all unspent money roll over? (Or just savings buckets?)
- How to handle negative balances? (Debt carried forward?)

---

## Questions to Answer

1. **Income model**: Should one-time income also fund buckets? Or only recurring?
2. **Rollover timing**: Manual or automatic monthly rollover?
3. **Bucket types**: Should spend buckets roll over differently than save buckets?
4. **Overspending**: What happens if you spend more than funded? Debt to next month?

Let me know which approach you prefer, and I can implement it!
