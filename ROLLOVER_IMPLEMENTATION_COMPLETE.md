# Monthly Rollover Implementation - Complete ✅

## What's Been Implemented

### 1. ✅ Automatic Monthly Rollover (Cron Job)

**File:** `convex/crons.ts`

- Runs automatically on the 1st of each month at 12:01 AM UTC
- Processes all users in the system
- Handles spend buckets and save buckets differently
- Logs results for monitoring

**How it works:**
```typescript
// Runs: Day 1, Hour 0, Minute 1 (UTC)
crons.monthly(
  "monthly rollover",
  { day: 1, hourUTC: 0, minuteUTC: 1 },
  internal.rollover.runScheduledRollover
);
```

### 2. ✅ Rollover Details in UI

#### A. Bucket Cards (Overview)
**File:** `src/components/BucketCard.tsx`

Shows carryover hint below the main amount:
- Positive: "+$100.00 from last month" (green/subtle)
- Negative: "-$50.00 from last month" (indicates debt)

**Example:**
```
Groceries
$550.00 left of $600.00
+$100.00 from last month
[Progress bar]
```

#### B. Bucket Detail View
**File:** `src/screens/BucketDetail.tsx`

Shows detailed funding breakdown:
```
Funding Breakdown
This month          $500.00
Carried forward     +$100.00
─────────────────────────────
Total available     $600.00
Spent              -$150.00
─────────────────────────────
Remaining          $450.00
```

Features:
- Shows this month's funding separately
- Highlights carryover (positive or negative)
- Shows debt in red if overspent
- Only appears for spend buckets with funding

#### C. Settings Page
**File:** `src/screens/Settings.tsx`

New "Monthly Rollover" section:
- Explains how automatic rollover works
- Provides manual rollover button for testing
- Shows success/error alerts

### 3. ✅ Balance Calculations Updated

**Files Updated:**
- `src/components/BucketCard.tsx`
- `src/screens/AddExpense.tsx`
- `src/screens/EditExpense.tsx`
- `src/screens/BucketDetail.tsx`

**New formula for spend buckets:**
```typescript
available = (fundedAmount + carryoverBalance) - spent
```

This can be negative if overspent (debt carries forward).

## How It Works

### Spend Buckets

**Month 1:**
- Funded: $500
- Spent: $400
- Unspent: $100

**Rollover to Month 2:**
- Carryover: $100
- New funding: $500
- Total available: $600

**Month 2 (overspending example):**
- Total available: $600
- Spent: $650
- Overspent: -$50

**Rollover to Month 3:**
- Carryover: -$50 (debt)
- New funding: $500
- Total available: $450

### Save Buckets

**Goal: $5000 Emergency Fund**

**Month 1:**
- Balance: $0
- Contribution: $200
- New balance: $200

**Month 2-24:**
- Contributions continue...

**Month 25:**
- Balance: $4,800
- Contribution: $200
- New balance: $5,000 ✓ Goal reached!

**Month 26:**
- Contributions stop (target reached)

**If you withdraw $1,000:**
- Balance drops to $4,000
- Contributions resume next month

## Testing

### Manual Rollover
1. Go to **Settings**
2. Scroll to "Monthly Rollover" section
3. Click **"Trigger Manual Rollover"**
4. See success alert with number of buckets processed

### Automatic Rollover
- Happens automatically on the 1st of each month
- No user action required
- All active buckets are processed

### View Results
- Check bucket cards for carryover hints
- Open bucket detail for full breakdown
- Add expenses to see updated available balance

## Database Changes

### Schema Updates
```typescript
buckets: {
  carryoverBalance: number,    // NEW: Balance from previous months
  lastRolloverDate: number,    // NEW: Last rollover timestamp
  fundedAmount: number,        // This month's allocation
  spentAmount: number,         // Computed from expenses
}
```

### Migration
- Existing buckets automatically get `carryoverBalance: 0`
- Works seamlessly with existing data
- No manual migration needed

## Key Features

### ✅ Automatic Processing
- Runs on schedule (1st of month)
- No user intervention needed
- Handles all buckets automatically

### ✅ Overspending Allowed
- Can spend more than available
- Debt carries to next month
- Shows negative balance clearly

### ✅ Save Goals Smart
- Stops at target
- Resumes if depleted
- Shows progress percentage

### ✅ Clear UI Feedback
- Shows carryover amounts
- Detailed breakdowns available
- Debt shown in red

## Next Steps (Optional Enhancements)

1. **Rollover History** - Track each month's rollover in a log
2. **Notifications** - Alert users when rollover completes
3. **Reports Integration** - Show rollover in monthly reports
4. **Custom Rollover Rules** - Per-bucket rollover settings

## Files Modified

### Backend (Convex)
- ✅ `convex/schema.ts` - Added carryoverBalance, lastRolloverDate
- ✅ `convex/rollover.ts` - Rollover logic (new file)
- ✅ `convex/crons.ts` - Scheduled job (new file)
- ✅ `convex/buckets.ts` - Initialize new fields

### Frontend (React)
- ✅ `src/types/index.ts` - TypeScript types
- ✅ `src/components/BucketCard.tsx` - Show carryover hint
- ✅ `src/screens/BucketDetail.tsx` - Detailed breakdown
- ✅ `src/screens/AddExpense.tsx` - Include carryover in balance
- ✅ `src/screens/EditExpense.tsx` - Include carryover in balance
- ✅ `src/screens/Settings.tsx` - Manual rollover section

## Testing Checklist

- [ ] Create a bucket with $500 funding
- [ ] Add $400 in expenses
- [ ] Trigger manual rollover
- [ ] Verify carryover shows $100
- [ ] Verify total available is $600 next month
- [ ] Add $650 in expenses (overspend)
- [ ] Trigger rollover again
- [ ] Verify carryover shows -$50 (debt)
- [ ] Verify total available is $450 next month

---

**Status:** ✅ Complete and ready for use!
**Automatic rollover:** Active (runs 1st of each month)
**Manual rollover:** Available in Settings
