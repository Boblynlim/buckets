import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';
import { getRandomCupIcon } from '../constants/bucketIcons';
import { COLORS, money } from './home/homeStyles';
import { CupForm, CupValues, amountFields, useCupContext } from './EditBucket';

// Adding a cup. Same page as editing (CupForm), plus a gentle amount
// suggestion and a line on how much of take-home is still unclaimed.

type Kind = 'bill' | 'budget' | 'goal';
const kindOf = (mode: CupValues['mode']): Kind => (mode === 'recurring' ? 'bill' : mode === 'save' ? 'goal' : 'budget');

// Income-scaled suggestions based on bucket name
const getSuggestion = (
  name: string,
  type: Kind,
  monthlyIncome: number,
): { amount: number; label: string } | null => {
  const n = name.toLowerCase().trim();
  if (!n || n.length < 3) return null;

  if (type !== 'goal') {
    const pctMap: Record<string, { pct: number; label: string }> = {
      rent: { pct: 30, label: 'housing' },
      housing: { pct: 30, label: 'housing' },
      mortgage: { pct: 30, label: 'housing' },
      groceries: { pct: 12, label: 'food' },
      grocery: { pct: 12, label: 'food' },
      food: { pct: 12, label: 'food' },
      utilities: { pct: 7, label: 'bills' },
      bills: { pct: 7, label: 'bills' },
      transport: { pct: 15, label: 'transport' },
      car: { pct: 15, label: 'transport' },
      insurance: { pct: 10, label: 'insurance' },
      health: { pct: 8, label: 'health' },
      medical: { pct: 8, label: 'health' },
      travel: { pct: 10, label: 'travel' },
      vacation: { pct: 10, label: 'travel' },
      dining: { pct: 8, label: 'dining' },
      restaurant: { pct: 8, label: 'dining' },
      entertainment: { pct: 8, label: 'fun' },
      fun: { pct: 8, label: 'fun' },
      shopping: { pct: 8, label: 'shopping' },
      clothes: { pct: 5, label: 'wardrobe' },
      fitness: { pct: 3, label: 'fitness' },
      gym: { pct: 2, label: 'fitness' },
      gift: { pct: 3, label: 'gifts' },
      parent: { pct: 5, label: 'family' },
      family: { pct: 5, label: 'family' },
      subscription: { pct: 3, label: 'subscriptions' },
      pet: { pct: 3, label: 'pets' },
      enrichment: { pct: 5, label: 'learning' },
      education: { pct: 5, label: 'learning' },
      hobby: { pct: 5, label: 'hobbies' },
      self: { pct: 3, label: 'self care' },
      beauty: { pct: 3, label: 'beauty' },
      tax: { pct: 5, label: 'taxes' },
      maintenance: { pct: 3, label: 'maintenance' },
      home: { pct: 5, label: 'home' },
      decor: { pct: 3, label: 'decor' },
      date: { pct: 5, label: 'dates' },
    };

    for (const [key, val] of Object.entries(pctMap)) {
      if (n.includes(key)) {
        const amt = monthlyIncome > 0 ? Math.round((val.pct / 100) * monthlyIncome) : 0;
        return amt > 0
          ? { amount: amt, label: `about ${val.pct}% of take-home, for ${val.label}` }
          : null;
      }
    }
    return null;
  }

  // Goal suggestions
  const goalMap: Record<string, { amount: number; label: string }> = {
    emergency: { amount: monthlyIncome > 0 ? monthlyIncome * 6 : 5000, label: '6 months of income' },
    vacation: { amount: 3000, label: 'average trip fund' },
    travel: { amount: 3000, label: 'travel fund' },
    wedding: { amount: 15000, label: 'wedding fund' },
    house: { amount: 20000, label: 'down payment' },
    home: { amount: 20000, label: 'down payment' },
    car: { amount: 5000, label: 'car fund' },
    laptop: { amount: 1500, label: 'tech purchase' },
    phone: { amount: 1200, label: 'phone upgrade' },
    renovation: { amount: 10000, label: 'renovation fund' },
  };

  for (const [key, val] of Object.entries(goalMap)) {
    if (n.includes(key)) return val;
  }
  return null;
};

interface AddBucketProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (bucket: any) => void;
}

export const AddBucket: React.FC<AddBucketProps> = ({ visible, onClose }) => {
  const { user: currentUser } = useAuth();
  const userId = currentUser?._id;
  const createBucket = useMutation(api.buckets.create);
  const { takeHome, groups, placeOnShelf } = useCupContext(userId);
  const [cupIcon] = useState(() => getRandomCupIcon());
  const existing = useQuery(api.buckets.getByUser, userId ? { userId } : 'skip') as any[] | undefined;

  // Mirrors convex/distribution.getDistributionStatus: what each active cup
  // already claims from take-home each month.
  const claimed = useMemo(() => (existing ?? []).filter((b) => b.isActive !== false).reduce((sum: number, b: any) => {
    if (b.bucketMode === 'save') {
      if (!b.contributionType || b.contributionType === 'none') return sum;
      if (b.contributionType === 'percentage' && b.contributionPercent) return sum + (takeHome * b.contributionPercent) / 100;
      return sum + (b.contributionAmount || 0);
    }
    if (b.allocationType === 'percentage' && b.plannedPercent) return sum + (takeHome * b.plannedPercent) / 100;
    return sum + (b.plannedAmount || b.allocationValue || 0);
  }, 0), [existing, takeHome]);

  if (!visible) return null;

  const initial: CupValues = {
    name: '', mode: 'spend', shelf: 'Everyday', allocationType: 'amount',
    amount: '', target: '', contributionType: 'amount', alertThreshold: '20',
  };

  const save = async (v: CupValues) => {
    if (!userId) return;
    const id = await createBucket({
      userId,
      name: v.name.trim(),
      bucketMode: v.mode,
      alertThreshold: parseFloat(v.alertThreshold) || 20,
      color: theme.colors.primary,
      icon: cupIcon,
      ...(amountFields(v) as any),
    });
    if (v.shelf && v.mode !== 'save') await placeOnShelf(id, v.shelf);
    onClose();
  };

  const helper = (v: CupValues, set: (p: Partial<CupValues>) => void) => {
    const kind = kindOf(v.mode);
    const s = getSuggestion(v.name, kind, takeHome);
    const field = kind === 'goal' ? 'target' : 'amount';
    const empty = !v[field];
    const n = parseFloat(v.amount) || 0;
    const thisOne = v.mode === 'save'
      ? (v.contributionType === 'none' ? 0 : v.contributionType === 'percentage' ? (takeHome * n) / 100 : n)
      : v.allocationType === 'percentage' ? (takeHome * n) / 100 : n;
    const free = takeHome - claimed - thisOne;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: -12 }}>
        {s && empty && v.allocationType === 'amount' && (
          <button type="button" className="bk-chip" onClick={() => set({ [field]: String(s.amount) } as any)}
            style={{ alignSelf: 'flex-start', height: 40, padding: '0 14px', fontSize: 14 }}>
            Try {money(s.amount)}. {s.label.charAt(0).toUpperCase() + s.label.slice(1)}
          </button>
        )}
        {takeHome > 0 && existing && (
          <span style={{ fontSize: 13, color: free < 0 ? COLORS.rust : COLORS.muted }}>
            {free < 0
              ? `That’s ${money(-free)} more than your ${money(takeHome)} take-home.`
              : `${money(free)} of your ${money(takeHome)} take-home is still free.`}
          </span>
        )}
      </div>
    );
  };

  if (groups === undefined) {
    return <div className="bk-root" style={{ position: 'fixed', inset: 0, zIndex: 2500, background: COLORS.wall }} />;
  }

  return (
    <CupForm
      title="New cup"
      initial={initial}
      takeHome={takeHome}
      onClose={onClose}
      onSave={save}
      saveLabel="Add cup"
      helper={helper}
      // Fixed things are bills paid the same each month.
      onShelfChange={(shelf, v) =>
        shelf === 'Fixed' && v.mode === 'spend' ? { mode: 'recurring' }
          : shelf !== 'Fixed' && v.mode === 'recurring' ? { mode: 'spend' } : {}}
    />
  );
};
