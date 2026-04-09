import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';
import { getRandomCupIcon, getCupImage } from '../constants/bucketIcons';
import { Drawer } from '../components/Drawer';

// Map UI labels to schema values
type BucketType = 'bill' | 'budget' | 'goal';
const TYPE_TO_MODE: Record<BucketType, 'recurring' | 'spend' | 'save'> = {
  bill: 'recurring',
  budget: 'spend',
  goal: 'save',
};

// Income-scaled suggestions based on bucket name
const getSuggestion = (
  name: string,
  type: BucketType,
  monthlyIncome: number,
): { amount: number; label: string } | null => {
  const n = name.toLowerCase().trim();
  if (!n || n.length < 3) return null;

  if (type === 'bill' || type === 'budget') {
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
          ? { amount: amt, label: `~${val.pct}% of income for ${val.label}` }
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
  const [name, setName] = useState('');
  const [bucketType, setBucketType] = useState<BucketType>('budget');
  const [amount, setAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('20');
  const [isSaving, setIsSaving] = useState(false);

  // Random cup for preview
  const [cupIcon] = useState(() => getRandomCupIcon());
  const cupImage = getCupImage(cupIcon);

  const { user: currentUser } = useAuth();
  const createBucket = useMutation(api.buckets.create);

  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const userIncome = useQuery(
    api.monthlyIncome.getByMonth,
    currentUser ? { userId: currentUser._id, month: currentMonthStr } : 'skip',
  );
  const existingBuckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  // Calculate budget context
  const monthlyIncome = useMemo(() => {
    if (!userIncome) return 0;
    return userIncome.reduce((sum: number, i: any) => sum + i.amount, 0);
  }, [userIncome]);

  const allocatedAmount = useMemo(() => {
    if (!existingBuckets) return 0;
    return (existingBuckets as any[]).reduce((sum: number, b: any) => {
      if (b.bucketMode === 'save') return sum + (b.contributionAmount || 0);
      return sum + (b.plannedAmount || 0);
    }, 0);
  }, [existingBuckets]);

  const freeAmount = monthlyIncome - allocatedAmount;
  const allocatedPct = monthlyIncome > 0 ? Math.round((allocatedAmount / monthlyIncome) * 100) : 0;

  // Current input amount for live bar
  const inputAmount = parseFloat(amount) || 0;
  const inputTarget = parseFloat(targetAmount) || 0;
  const inputContribution = parseFloat(contributionAmount) || 0;

  const newAllocatedPct = monthlyIncome > 0
    ? Math.round(((allocatedAmount + (bucketType === 'goal' ? inputContribution : inputAmount)) / monthlyIncome) * 100)
    : 0;

  // Suggestion
  const suggestion = useMemo(
    () => getSuggestion(name, bucketType, monthlyIncome),
    [name, bucketType, monthlyIncome],
  );

  const handleSave = async () => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      if (!currentUser) { setIsSaving(false); return; }
      if (!name.trim()) { alert('Give your cup a name'); setIsSaving(false); return; }

      const mode = TYPE_TO_MODE[bucketType];
      const baseData = {
        userId: currentUser._id,
        name: name.trim(),
        bucketMode: mode,
        alertThreshold: parseFloat(alertThreshold) || 20,
        color: theme.colors.primary,
        icon: cupIcon,
      };

      let params: any;
      if (bucketType === 'bill') {
        if (!amount || parseFloat(amount) <= 0) { alert('Enter the bill amount'); setIsSaving(false); return; }
        params = { ...baseData, allocationType: 'amount' as const, plannedAmount: parseFloat(amount) };
      } else if (bucketType === 'budget') {
        if (!amount || parseFloat(amount) <= 0) { alert('Set a monthly budget'); setIsSaving(false); return; }
        params = { ...baseData, allocationType: 'amount' as const, plannedAmount: parseFloat(amount) };
      } else {
        if (!targetAmount || parseFloat(targetAmount) <= 0) { alert('Set a savings goal'); setIsSaving(false); return; }
        params = {
          ...baseData,
          targetAmount: parseFloat(targetAmount),
          contributionType: inputContribution > 0 ? 'amount' as const : 'none' as const,
          ...(inputContribution > 0 && { contributionAmount: inputContribution }),
        };
      }

      await createBucket(params);

      // Reset
      setName('');
      setBucketType('budget');
      setAmount('');
      setTargetAmount('');
      setContributionAmount('');
      setShowAdvanced(false);
      setIsSaving(false);
      onClose();
    } catch (error: any) {
      console.error('Failed to create bucket:', error);
      alert(error?.message || 'Failed to create bucket.');
      setIsSaving(false);
    }
  };

  const isValid = bucketType === 'goal'
    ? name.trim() && targetAmount && parseFloat(targetAmount) > 0
    : name.trim() && amount && parseFloat(amount) > 0;

  // Budget bar width
  const barPct = Math.min(100, newAllocatedPct);
  const isOver = newAllocatedPct > 100;

  return (
    <Drawer visible={visible} onClose={onClose} fullScreen>
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>New Cup</Text>
            <TouchableOpacity onPress={handleSave} disabled={!isValid || isSaving}>
              <Text style={[styles.saveButton, (!isValid || isSaving) && styles.saveButtonDisabled]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cup Preview */}
          <View style={styles.cupPreview}>
            <Image source={cupImage} style={styles.cupImage} resizeMode="contain" />
          </View>

          {/* Name Input */}
          <View style={styles.nameSection}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="name this cup..."
              placeholderTextColor="rgba(61,50,41,0.2)"
              textAlign="center"
              autoFocus
            />
          </View>

          {/* Type Pills */}
          <View style={styles.typeRow}>
            {(['bill', 'budget', 'goal'] as BucketType[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.typePill, bucketType === t && styles.typePillActive]}
                onPress={() => setBucketType(t)}
              >
                <Text style={[styles.typePillText, bucketType === t && styles.typePillTextActive]}>
                  {t === 'bill' ? 'BILL' : t === 'budget' ? 'BUDGET' : 'GOAL'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.typeHelper}>
            {bucketType === 'bill'
              ? 'fixed monthly expense — same amount each time'
              : bucketType === 'budget'
              ? 'flexible spending — track against a monthly limit'
              : 'save toward a target amount over time'}
          </Text>

          {/* Budget Bar */}
          {monthlyIncome > 0 && (
            <View style={styles.budgetBar}>
              <View style={styles.budgetBarTrack}>
                <View
                  style={[
                    styles.budgetBarFill,
                    { width: `${Math.min(100, allocatedPct)}%` },
                  ]}
                />
                {(bucketType !== 'goal' ? inputAmount : inputContribution) > 0 && (
                  <View
                    style={[
                      styles.budgetBarNew,
                      {
                        left: `${Math.min(100, allocatedPct)}%`,
                        width: `${Math.min(100 - allocatedPct, Math.round(((bucketType !== 'goal' ? inputAmount : inputContribution) / monthlyIncome) * 100))}%`,
                      },
                      isOver && styles.budgetBarOver,
                    ]}
                  />
                )}
              </View>
              <View style={styles.budgetBarLabels}>
                <Text style={styles.budgetBarText}>
                  {newAllocatedPct}% allocated
                </Text>
                <Text style={[styles.budgetBarText, isOver && { color: '#C0564E' }]}>
                  ${Math.max(0, freeAmount - (bucketType !== 'goal' ? inputAmount : inputContribution)).toFixed(0)} free
                </Text>
              </View>
            </View>
          )}

          {/* Amount Fields — contextual */}
          {(bucketType === 'bill' || bucketType === 'budget') && (
            <View style={styles.amountSection}>
              {/* Suggestion */}
              {suggestion && !amount && (
                <Pressable
                  style={styles.suggestionChip}
                  onPress={() => setAmount(suggestion.amount.toString())}
                >
                  <Text style={styles.suggestionText}>
                    ${suggestion.amount.toLocaleString()} · {suggestion.label}
                  </Text>
                  <Text style={styles.suggestionApply}>apply</Text>
                </Pressable>
              )}

              <View style={styles.amountRow}>
                <Text style={styles.amountCurrency}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(61,50,41,0.15)"
                />
                <Text style={styles.amountSuffix}>/ month</Text>
              </View>
            </View>
          )}

          {bucketType === 'goal' && (
            <View style={styles.amountSection}>
              {/* Suggestion */}
              {suggestion && !targetAmount && (
                <Pressable
                  style={styles.suggestionChip}
                  onPress={() => setTargetAmount(suggestion.amount.toString())}
                >
                  <Text style={styles.suggestionText}>
                    ${suggestion.amount.toLocaleString()} · {suggestion.label}
                  </Text>
                  <Text style={styles.suggestionApply}>apply</Text>
                </Pressable>
              )}

              <View style={styles.amountRow}>
                <Text style={styles.amountCurrency}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(61,50,41,0.15)"
                />
                <Text style={styles.amountSuffix}>goal</Text>
              </View>

              {/* Monthly contribution */}
              <View style={styles.contributionRow}>
                <Text style={styles.contributionLabel}>contribute</Text>
                <Text style={styles.contributionCurrency}>$</Text>
                <TextInput
                  style={styles.contributionInput}
                  value={contributionAmount}
                  onChangeText={setContributionAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(61,50,41,0.15)"
                />
                <Text style={styles.contributionSuffix}>/ month</Text>
              </View>

              {/* Time estimate */}
              {inputTarget > 0 && inputContribution > 0 && (
                <Text style={styles.timeEstimate}>
                  {Math.ceil(inputTarget / inputContribution)} months to reach your goal
                </Text>
              )}
            </View>
          )}

          {/* Over-allocation warning */}
          {isOver && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                over budget by ${Math.abs(freeAmount - (bucketType !== 'goal' ? inputAmount : inputContribution)).toFixed(0)}
              </Text>
            </View>
          )}

          {/* Advanced options */}
          {bucketType !== 'goal' && (
            <Pressable
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.advancedToggleText}>
                {showAdvanced ? 'less options' : 'more options'}
              </Text>
            </Pressable>
          )}

          {showAdvanced && bucketType !== 'goal' && (
            <View style={styles.advancedSection}>
              <Text style={styles.advancedLabel}>alert when</Text>
              <View style={styles.advancedRow}>
                <TextInput
                  style={styles.advancedInput}
                  value={alertThreshold}
                  onChangeText={setAlertThreshold}
                  keyboardType="decimal-pad"
                  placeholder="20"
                  placeholderTextColor="rgba(61,50,41,0.2)"
                />
                <Text style={styles.advancedSuffix}>% remaining</Text>
              </View>
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </Drawer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE3D5',
  },
  scrollView: {
    flex: 1,
  },

  // Header — matches AddExpense
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: 'Merchant',
  },
  saveButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: 'Merchant',
    fontWeight: '500',
  },
  saveButtonDisabled: {
    color: '#B5AFA5',
  },

  // Cup preview
  cupPreview: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  cupImage: {
    width: 80,
    height: 80,
  },

  // Name
  nameSection: {
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  nameInput: {
    fontSize: 24,
    fontFamily: 'Merchant',
    color: '#1A1A1A',
    textAlign: 'center',
    paddingVertical: 8,
    letterSpacing: -0.5,
  },

  // Type pills — matches worth-it row style
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  typePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(61,50,41,0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typePillActive: {
    backgroundColor: 'rgba(160,208,192,0.2)',
    borderColor: 'rgba(92,138,122,0.3)',
  },
  typePillText: {
    fontSize: 13,
    fontFamily: 'Merchant',
    fontWeight: '600',
    color: '#877E6F',
    letterSpacing: 0.8,
  },
  typePillTextActive: {
    color: '#245045',
  },
  typeHelper: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: '#A09686',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 40,
  },

  // Budget bar
  budgetBar: {
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 8,
  },
  budgetBarTrack: {
    height: 6,
    backgroundColor: 'rgba(61,50,41,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  budgetBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(92,138,122,0.4)',
    borderRadius: 3,
  },
  budgetBarNew: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(92,138,122,0.7)',
    borderRadius: 3,
  },
  budgetBarOver: {
    backgroundColor: 'rgba(192,86,78,0.6)',
  },
  budgetBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  budgetBarText: {
    fontSize: 13,
    fontFamily: 'Merchant Copy',
    color: '#877E6F',
  },

  // Amount section
  amountSection: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  amountCurrency: {
    fontSize: 28,
    fontFamily: 'Merchant Copy',
    color: 'rgba(61,50,41,0.25)',
  },
  amountInput: {
    fontSize: 36,
    fontFamily: 'Merchant Copy',
    color: '#1A1A1A',
    minWidth: 60,
    textAlign: 'center',
    paddingVertical: 4,
  },
  amountSuffix: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#A09686',
    marginLeft: 4,
  },

  // Contribution (goal mode)
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(61,50,41,0.06)',
  },
  contributionLabel: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: '#A09686',
  },
  contributionCurrency: {
    fontSize: 20,
    fontFamily: 'Merchant Copy',
    color: 'rgba(61,50,41,0.25)',
  },
  contributionInput: {
    fontSize: 24,
    fontFamily: 'Merchant Copy',
    color: '#1A1A1A',
    minWidth: 50,
    textAlign: 'center',
    paddingVertical: 2,
  },
  contributionSuffix: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: '#A09686',
  },
  timeEstimate: {
    fontSize: 14,
    fontFamily: 'Merchant',
    fontStyle: 'italic',
    color: '#5C8A7A',
    textAlign: 'center',
    marginTop: 12,
  },

  // Suggestion chip
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(160,208,192,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'center',
    gap: 8,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: '#245045',
  },
  suggestionApply: {
    fontSize: 13,
    fontFamily: 'Merchant',
    fontWeight: '600',
    color: '#5C8A7A',
  },

  // Warning
  warningBox: {
    marginHorizontal: 24,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(192,86,78,0.08)',
    borderRadius: 12,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: '#C0564E',
  },

  // Advanced
  advancedToggle: {
    alignItems: 'center',
    marginTop: 28,
  },
  advancedToggleText: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: '#A09686',
    textDecorationLine: 'underline',
  },
  advancedSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  advancedLabel: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: '#877E6F',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  advancedInput: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: '#1A1A1A',
    backgroundColor: 'rgba(61,50,41,0.04)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    width: 60,
    textAlign: 'center',
  },
  advancedSuffix: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: '#A09686',
  },
});
