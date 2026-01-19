# Budget Buckets v2 - Migration Guide

## What's New in V2

### Core Model Changes
- **Bucket Modes**: Buckets now have two modes:
  - `spend`: Traditional envelope budgeting with tracking of planned vs funded vs spent
  - `save`: Savings goals with progress tracking

### Better Money Tracking
- **Planned**: How much you want to allocate to each bucket
- **Funded**: How much income has actually been distributed
- **Spent**: Computed from your actual expenses
- **Available**: Funded - Spent (what you can still spend)

### Automatic Distribution
- Income is now automatically distributed to buckets based on your planned amounts/percentages
- System detects when you're over-planned and shows warnings
- Distribution recalculates when you create/edit/delete buckets

## Running the Migration

### Method 1: Using Convex Dashboard
1. Open your Convex dashboard: https://dashboard.convex.dev
2. Navigate to your project
3. Go to "Functions" tab
4. Find `buckets:migrateToNewModel`
5. Click "Run" (no arguments needed)
6. The function will convert all existing buckets to the new model

### Method 2: Using the Migration Screen (Web)
A Migration component has been created at `src/screens/Migration.tsx`. To use it:

1. Import and render it temporarily in your app:
   ```tsx
   import { Migration } from './src/screens/Migration';

   // In your App.tsx or similar:
   <Migration />
   ```

2. Click "Run Migration" button
3. Wait for completion message
4. Refresh the app

### Method 3: Via Code
```typescript
import { useMutation } from 'convex/react';
import { api } from './convex/_generated/api';

const migrateToNewModel = useMutation(api.buckets.migrateToNewModel);

// Call it:
await migrateToNewModel({});
```

## What the Migration Does

For each existing bucket:
1. Sets `bucketMode` to `'spend'` (all old buckets are spending buckets)
2. Converts `allocationValue` to either:
   - `plannedAmount` (if allocationType was 'amount')
   - `plannedPercent` (if allocationType was 'percentage')
3. Moves `currentBalance` to `fundedAmount`
4. Preserves all other fields (name, color, icon, etc.)

## After Migration

1. **Add income**: The system needs to know your monthly income to calculate distributions
   - Go to Settings → Income → Add your monthly income

2. **Distribution runs automatically**: When you add income or edit buckets, funding is recalculated

3. **Check for over-planning**: If you see a warning banner, you've planned more than your income allows

4. **Create save buckets** (optional):
   - Use AddBucket form with mode: "save"
   - Set a target amount
   - Save buckets don't consume your income planning

## New UI Features

### BucketCard
- **Spend buckets** show: "$X left of $Y funded"
- **Save buckets** show: "$X saved of $Y goal"
- Progress bar colors indicate usage/progress

### Distribution Status Banner
- Appears when total planned > total income
- Shows how much you're over-planned by
- Buckets will be partially funded proportionally

### Settings
- Income section now has "+Add" button
- Existing features (Export, Import, Notifications) still work

## Backward Compatibility

- Old buckets work seamlessly after migration
- `allocationValue` field is preserved for compatibility
- `currentBalance` is still available on save buckets
- Existing queries return buckets with computed `spentAmount`

## Troubleshooting

### "Document is missing bucketMode field"
- Run the migration (see above)
- Schema allows `bucketMode` to be optional during transition

### Buckets showing $0 funded
- Add monthly income via Settings → Income
- Or run distribution manually: `calculateDistribution({ userId })`

### Over-planning warning won't go away
- Reduce planned amounts in some buckets
- Or increase your income
- Distribution will fund what it can proportionally

## Next Steps

After successfully migrating:
- ✅ Phase 1 is complete
- 🔄 Phase 2: Transaction tagging, recommendations engine (coming next)
- 🔄 Phase 3: Memory system, weekly/monthly reports
- 🔄 Phase 4: UX polish (swipe to delete, etc.)

## Need Help?

If you encounter issues:
1. Check the Convex logs for error messages
2. Verify your schema matches the new definition
3. Ensure the migration completed successfully
4. Check that income has been added to trigger distribution
