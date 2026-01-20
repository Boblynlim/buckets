# Monthly Rollover System

## Overview
The rollover system automatically carries forward unspent money (or debt) from one month to the next, starting on the 1st of each month.

## How It Works

### Spend Buckets
Each month:
1. **Calculate unspent amount**: `(fundedAmount + carryoverBalance) - totalSpent`
2. **Move to carryover**: Unspent amount becomes next month's carryover
3. **Add new funding**: Bucket gets its monthly allocation based on income
4. **Total available**: `carryoverBalance + fundedAmount - spent`

**Example:**
- **Month 1**: Funded $500, Spent $400 → Unspent $100
- **Month 2 starts**: Carryover $100 + Funded $500 = $600 available
- **Month 2**: Spent $650 → Overspent by $50
- **Month 3 starts**: Carryover -$50 + Funded $500 = $450 available (carrying debt)

### Save Buckets
Each month:
1. **Check if below target**: If `currentBalance < targetAmount`
2. **Add contribution**: Based on contribution settings (fixed amount or percentage)
3. **Stop at target**: Once target is reached, contributions stop
4. **Resume if depleted**: If you withdraw and go below target, contributions resume

**Example:**
- **Goal**: Save $5000 for emergency fund
- **Contribution**: $200/month
- **Month 1**: $0 → $200
- **Month 2**: $200 → $400
- ...
- **Month 25**: $4800 → $5000 (target reached, contributions stop)
- **Month 26**: Withdraw $1000 → $4000 (below target, contributions resume)
- **Month 27**: $4000 → $4200

## Implementation Details

### Database Fields Added
```typescript
buckets: {
  carryoverBalance: number,      // Balance carried from previous months
  lastRolloverDate: number,      // Timestamp of last rollover
  ...
}
```

### Available Balance Calculation

**Spend Buckets:**
```typescript
available = (fundedAmount + carryoverBalance) - spentAmount
```

**Save Buckets:**
```typescript
available = currentBalance
```

### Automatic Rollover
- Runs on the 1st of each month (can be implemented as a scheduled function)
- Checks if already rolled over this month (prevents double rollover)
- Processes all active buckets for the user

### Manual Rollover
Available via Settings or can be triggered programmatically:
```typescript
await ctx.runMutation(api.rollover.manualRollover, {
  userId: currentUser._id,
});
```

## UI Changes

### Bucket Card Display
**Before:**
- "Groceries: $100 left of $500"

**After (with rollover):**
- "Groceries: $150 left of $600"
  - ($100 carryover + $500 this month = $600 total, spent $450)

### Expense Warnings
Now correctly shows available balance including carryover:
- "💡 This bucket has $150 available (includes $100 from last month)"

## Testing the System

### Manual Test
1. Go to Settings
2. Look for "Trigger Monthly Rollover" option (to be added)
3. Click to manually run rollover

### What to Expect
- Unspent money carries forward
- Overspending creates negative carryover
- Save buckets accumulate toward goal
- Contributions stop when save targets are reached

## Future Enhancements

### Scheduled Rollover
Create a Convex scheduled function:
```typescript
// convex/crons.ts
export default {
  monthlyRollover: {
    cron: "0 0 1 * *", // Run at midnight on the 1st of each month
    handler: async (ctx) => {
      // Get all users and trigger rollover
      const users = await ctx.db.query("users").collect();
      for (const user of users) {
        await ctx.runAction(api.rollover.checkAndPerformRollover, {
          userId: user._id,
        });
      }
    },
  },
};
```

### Rollover History
Track each rollover in a new table:
```typescript
rolloverHistory: defineTable({
  userId: v.id("users"),
  rolloverDate: v.number(),
  bucketsProcessed: v.number(),
  results: v.array(v.object({
    bucketId: v.id("buckets"),
    bucketName: v.string(),
    unspent: v.number(),
    newFunding: v.number(),
  })),
})
```

### User Notifications
- Notify when rollover completes
- Show summary of carryovers
- Alert on large debts

## Notes

### Overspending Behavior
- Allowed: You can spend more than available
- Debt carries forward as negative carryover
- Next month: New funding - debt = available

### First Rollover
- New buckets start with `carryoverBalance: 0`
- First rollover happens on the next 1st of the month
- Until then, buckets work as before

### Migration
Existing buckets will:
- Get `carryoverBalance: 0` on first rollover
- Get `lastRolloverDate: now` when created/updated
- Work normally until first rollover runs
