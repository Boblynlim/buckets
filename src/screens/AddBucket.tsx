import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import { getRandomBucketIcon } from '../constants/bucketIcons';

// Budget suggestion engine based on bucket name
const getBudgetSuggestion = (bucketName: string, bucketMode: 'spend' | 'save') => {
  const name = bucketName.toLowerCase().trim();

  if (bucketMode === 'spend') {
    // Spend bucket = Accumulation funds (builds up over time for splurging)
    const accumulationCategories: Record<string, { percent: number; description: string }> = {
      // Essential recurring expenses
      'rent': { percent: 30, description: 'Monthly housing allocation' },
      'housing': { percent: 30, description: 'Monthly housing allocation' },
      'mortgage': { percent: 30, description: 'Monthly housing payment' },
      'groceries': { percent: 12, description: 'Monthly food budget' },
      'food': { percent: 12, description: 'Monthly food budget' },
      'utilities': { percent: 7, description: 'Electric, water, internet' },
      'bills': { percent: 7, description: 'Recurring monthly bills' },
      'transport': { percent: 15, description: 'Monthly transport costs' },
      'car': { percent: 15, description: 'Car expenses & fuel' },
      'insurance': { percent: 10, description: 'Insurance payments' },
      'health': { percent: 8, description: 'Healthcare & medical' },
      'medical': { percent: 8, description: 'Healthcare expenses' },

      // Accumulation funds (build up for splurging)
      'travel': { percent: 10, description: 'Build up for trips & experiences' },
      'vacation': { percent: 10, description: 'Build up for holidays' },
      'trip': { percent: 10, description: 'Build up for travel' },
      'enrichment': { percent: 5, description: 'Build up for courses & learning' },
      'class': { percent: 5, description: 'Build up for courses & workshops' },
      'course': { percent: 5, description: 'Build up for learning' },
      'education': { percent: 5, description: 'Build up for learning & development' },
      'dining': { percent: 8, description: 'Build up for dining out' },
      'restaurant': { percent: 8, description: 'Build up for eating out' },
      'entertainment': { percent: 8, description: 'Build up for fun & leisure' },
      'fun': { percent: 8, description: 'Build up for spontaneous spending' },
      'hobby': { percent: 5, description: 'Build up for hobbies & interests' },
      'shopping': { percent: 8, description: 'Build up for shopping sprees' },
      'clothes': { percent: 5, description: 'Build up for wardrobe updates' },
      'clothing': { percent: 5, description: 'Build up for fashion' },
      'gadget': { percent: 5, description: 'Build up for tech purchases' },
      'tech': { percent: 5, description: 'Build up for technology' },
      'gift': { percent: 3, description: 'Build up for giving' },
      'subscription': { percent: 3, description: 'Monthly subscriptions' },
      'gym': { percent: 2, description: 'Fitness membership' },
      'fitness': { percent: 3, description: 'Build up for fitness & wellness' },
      'wellness': { percent: 3, description: 'Build up for self-care' },
      'beauty': { percent: 3, description: 'Build up for beauty & grooming' },
      'parent': { percent: 5, description: 'Monthly support for parents' },
      'family': { percent: 5, description: 'Family support & activities' },
      'pet': { percent: 3, description: 'Pet care & supplies' },
    };

    // Find matching category
    for (const [key, value] of Object.entries(accumulationCategories)) {
      if (name.includes(key)) {
        return { type: 'percentage' as const, value: value.percent, description: value.description };
      }
    }
  } else {
    // Save bucket suggestions (target amounts)
    const saveCategories: Record<string, { amount: number; description: string }> = {
      'emergency': { amount: 5000, description: '3-6 months expenses' },
      'vacation': { amount: 3000, description: 'Average vacation budget' },
      'travel': { amount: 3000, description: 'Travel fund' },
      'car': { amount: 2000, description: 'Car maintenance or down payment' },
      'wedding': { amount: 15000, description: 'Average wedding costs' },
      'house': { amount: 20000, description: 'Home down payment' },
      'home': { amount: 20000, description: 'Home down payment' },
      'down payment': { amount: 20000, description: 'Down payment fund' },
      'education': { amount: 10000, description: 'Education fund' },
      'college': { amount: 10000, description: 'College savings' },
      'retirement': { amount: 50000, description: 'Retirement savings goal' },
      'laptop': { amount: 1500, description: 'New laptop fund' },
      'computer': { amount: 1500, description: 'Computer purchase' },
      'phone': { amount: 1000, description: 'New phone fund' },
      'iphone': { amount: 1200, description: 'New iPhone' },
      'gift': { amount: 500, description: 'Gift fund' },
      'holiday': { amount: 1000, description: 'Holiday shopping' },
      'christmas': { amount: 1000, description: 'Christmas gifts' },
      'birthday': { amount: 500, description: 'Birthday gifts' },
    };

    // Find matching category
    for (const [key, value] of Object.entries(saveCategories)) {
      if (name.includes(key)) {
        return { type: 'amount' as const, value: value.amount, description: value.description };
      }
    }
  }

  return null;
};

interface AddBucketProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (bucket: {
    name: string;
    allocationType: 'amount' | 'percentage';
    allocationValue: number;
    alertThreshold: number;
    color: string;
  }) => void;
}

export const AddBucket: React.FC<AddBucketProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [bucketMode, setBucketMode] = useState<'spend' | 'save'>('spend');

  // Spend bucket state
  const [allocationType, setAllocationType] = useState<'amount' | 'percentage'>('amount');
  const [allocationValue, setAllocationValue] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('20');

  // Save bucket state
  const [targetAmount, setTargetAmount] = useState('');
  const [contributionType, setContributionType] = useState<'amount' | 'percentage' | 'none'>('none');
  const [contributionValue, setContributionValue] = useState('');
  const [goalAlerts, setGoalAlerts] = useState<number[]>([100]); // Default: notify at 100%
  const [reminderDays, setReminderDays] = useState(false);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [capBehavior, setCapBehavior] = useState<'stop' | 'unallocated' | 'bucket' | 'proportional'>('stop');

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);
  const createBucket = useMutation(api.buckets.create);

  // Get user's income and existing buckets for smart allocation
  const userIncome = useQuery(
    api.income.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip'
  );
  const existingBuckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  // Calculate total recurring income
  const totalIncome = React.useMemo(() => {
    if (!userIncome) return 0;
    return userIncome
      .filter((income: any) => income.isRecurring)
      .reduce((sum: number, income: any) => sum + income.amount, 0);
  }, [userIncome]);

  // Calculate already allocated percentage
  const allocatedPercent = React.useMemo(() => {
    if (!existingBuckets || totalIncome === 0) return 0;

    let totalAllocated = 0;
    existingBuckets.forEach((bucket: any) => {
      if (bucket.bucketMode === 'spend') {
        if (bucket.allocationType === 'percentage' && bucket.plannedPercent) {
          totalAllocated += bucket.plannedPercent;
        } else if (bucket.allocationType === 'amount' && bucket.plannedAmount) {
          totalAllocated += (bucket.plannedAmount / totalIncome) * 100;
        }
      }
    });

    return totalAllocated;
  }, [existingBuckets, totalIncome]);

  // Available percentage left
  const availablePercent = Math.max(0, 100 - allocatedPercent);

  // Smart suggestion state
  const [suggestion, setSuggestion] = useState<{
    type: 'amount' | 'percentage';
    value: number;
    description: string;
    adjusted?: boolean;
  } | null>(null);

  // Update suggestion when bucket name or mode changes
  useEffect(() => {
    if (name.length >= 3) {
      const baseSuggestion = getBudgetSuggestion(name, bucketMode);

      if (baseSuggestion && baseSuggestion.type === 'percentage') {
        // Check if suggestion would cause over-allocation
        if (baseSuggestion.value > availablePercent && availablePercent > 0) {
          // Adjust suggestion to fit available budget
          setSuggestion({
            ...baseSuggestion,
            value: Math.floor(availablePercent),
            adjusted: true,
            description: `${baseSuggestion.description} (adjusted to available budget)`,
          });
        } else if (availablePercent > 0) {
          setSuggestion(baseSuggestion);
        } else {
          setSuggestion(null); // No budget left
        }
      } else {
        setSuggestion(baseSuggestion);
      }
    } else {
      setSuggestion(null);
    }
  }, [name, bucketMode, availablePercent]);

  // Initialize demo user if needed
  useEffect(() => {
    if (currentUser === null) {
      console.log('No user found in AddBucket, initializing...');
      initDemoUser().catch(err => {
        console.error('Error initializing demo user:', err);
      });
    }
  }, [currentUser, initDemoUser]);

  const handleSave = async () => {
    try {
      // Validation based on bucket mode
      if (!name) {
        alert('Please enter a bucket name');
        return;
      }

      if (bucketMode === 'spend' && !allocationValue) {
        alert('Please enter an allocation amount');
        return;
      }

      if (bucketMode === 'save' && !targetAmount) {
        alert('Please enter a target amount');
        return;
      }

      // Wait for user to be initialized
      if (currentUser === null) {
        console.log('User is null, initializing before save...');
        await initDemoUser();
        // The query will refetch automatically, but we need to wait
        alert('Please try saving again. Your account is being set up.');
        return;
      }

      // Still loading - wait for query to complete
      if (currentUser === undefined) {
        return;
      }

      console.log('Creating bucket with user:', currentUser._id);

      // Randomly select an icon for the bucket
      const randomIcon = getRandomBucketIcon();
      const defaultColor = theme.colors.primary;

      console.log('Bucket details:', {
        name,
        allocationType,
        allocationValue: parseFloat(allocationValue),
        alertThreshold: parseFloat(alertThreshold),
        color: defaultColor,
        icon: randomIcon,
      });

      // Prepare data based on bucket mode
      const baseData = {
        userId: currentUser._id,
        name,
        bucketMode,
        alertThreshold: parseFloat(alertThreshold),
        color: defaultColor,
        icon: randomIcon,
      };

      let bucketParams;
      if (bucketMode === 'spend') {
        bucketParams = {
          ...baseData,
          allocationType,
          ...(allocationType === 'amount'
            ? { plannedAmount: parseFloat(allocationValue) }
            : { plannedPercent: parseFloat(allocationValue) }
          ),
        };
      } else {
        // save mode
        bucketParams = {
          ...baseData,
          targetAmount: parseFloat(targetAmount),
          contributionType,
          ...(contributionType === 'amount' && { contributionAmount: parseFloat(contributionValue) }),
          ...(contributionType === 'percentage' && { contributionPercent: parseFloat(contributionValue) }),
          goalAlerts,
          reminderDays: reminderDays ? 30 : undefined,
          notifyOnComplete,
          capBehavior,
        };
      }

      // Create bucket in Convex
      const bucketId = await createBucket(bucketParams);

      console.log('Bucket created successfully with ID:', bucketId);

      // Reset form
      setName('');
      setBucketMode('spend');
      setAllocationValue('');
      setTargetAmount('');
      setAlertThreshold('20');
      setContributionType('none');
      setContributionValue('');
      setGoalAlerts([100]);
      setReminderDays(false);
      setNotifyOnComplete(true);
      setCapBehavior('stop');
      onClose();
    } catch (error: any) {
      console.error('Failed to create bucket:', error);
      const errorMessage =
        error?.message || 'Failed to create bucket. Please try again.';
      alert(errorMessage);
    }
  };

  const isValid = bucketMode === 'spend'
    ? name.trim() && allocationValue && parseFloat(allocationValue) > 0
    : name.trim() &&
      targetAmount &&
      parseFloat(targetAmount) > 0 &&
      (contributionType === 'none' || (contributionValue && parseFloat(contributionValue) > 0));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>New Bucket</Text>
            <TouchableOpacity onPress={handleSave} disabled={!isValid}>
              <Text
                style={[
                  styles.saveButton,
                  !isValid && styles.saveButtonDisabled,
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* Budget Overview - Show allocation status */}
          {bucketMode === 'spend' && totalIncome > 0 && (
            <View style={styles.budgetOverview}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Monthly Income</Text>
                <Text style={styles.budgetValue}>${totalIncome.toFixed(2)}</Text>
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Already Allocated</Text>
                <Text style={[
                  styles.budgetValue,
                  allocatedPercent >= 100 && styles.budgetValueWarning
                ]}>
                  {allocatedPercent.toFixed(1)}%
                </Text>
              </View>
              <View style={[styles.budgetRow, styles.budgetRowHighlight]}>
                <Text style={styles.budgetLabelBold}>Available</Text>
                <Text style={[
                  styles.budgetValueBold,
                  availablePercent <= 0 && styles.budgetValueDanger
                ]}>
                  {availablePercent.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}

          {/* Over-allocation warning */}
          {bucketMode === 'spend' && allocatedPercent >= 100 && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ You've already allocated 100% of your income
              </Text>
              <Text style={styles.warningSubtext}>
                Adding this bucket will over-allocate your budget. Consider reducing other buckets first.
              </Text>
            </View>
          )}

          {/* Bucket Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Bucket Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={bucketMode === 'spend' ? 'e.g., Travel, Enrichment, Dining' : 'e.g., Emergency Fund, House Down Payment'}
              placeholderTextColor="#B5AFA5"
            />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Bucket Mode */}
          <View style={styles.section}>
            <Text style={styles.label}>Bucket Type</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  bucketMode === 'spend' && styles.toggleButtonActive,
                ]}
                onPress={() => setBucketMode('spend')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    bucketMode === 'spend' && styles.toggleTextActive,
                  ]}
                >
                  Spend
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  bucketMode === 'save' && styles.toggleButtonActive,
                ]}
                onPress={() => setBucketMode('save')}
              >
                <Text
                  style={[
                    styles.toggleText,
                    bucketMode === 'save' && styles.toggleTextActive,
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {bucketMode === 'spend'
                ? 'Track monthly spending against a budget'
                : 'Save toward a specific goal'}
            </Text>
          </View>

          {/* Allocation Type (Spend mode only) */}
          {bucketMode === 'spend' && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.label}>Allocation Type</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    allocationType === 'amount' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setAllocationType('amount')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      allocationType === 'amount' && styles.toggleTextActive,
                    ]}
                  >
                    Fixed Amount
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    allocationType === 'percentage' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setAllocationType('percentage')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      allocationType === 'percentage' && styles.toggleTextActive,
                    ]}
                  >
                    Percentage
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
          )}

          {/* Allocation Value (Spend mode only) */}
          {bucketMode === 'spend' && (
          <View style={styles.section}>
            <Text style={styles.label}>
              {allocationType === 'amount'
                ? 'Monthly Amount'
                : 'Percentage of Income'}
            </Text>

            {/* Smart Suggestion */}
            {suggestion && suggestion.type === 'percentage' && allocationType === 'percentage' && !allocationValue && (
              <TouchableOpacity
                style={styles.suggestionCard}
                onPress={() => setAllocationValue(suggestion.value.toString())}
              >
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionIcon}>💡</Text>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={styles.suggestionTitle}>
                      Suggested: {suggestion.value}% of income
                    </Text>
                    <Text style={styles.suggestionDescription}>
                      {suggestion.description}
                    </Text>
                  </View>
                  <Text style={styles.suggestionAction}>Apply</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>
                {allocationType === 'amount' ? '$' : '%'}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={allocationValue}
                onChangeText={setAllocationValue}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#B5AFA5"
              />
            </View>

            {/* Real-time over-allocation warning */}
            {allocationValue && allocationType === 'percentage' && (
              (() => {
                const currentPercent = parseFloat(allocationValue) || 0;
                const newTotal = allocatedPercent + currentPercent;
                const isOverAllocated = newTotal > 100;

                if (isOverAllocated) {
                  return (
                    <View style={styles.inlineWarning}>
                      <Text style={styles.inlineWarningText}>
                        ⚠️ This will allocate {newTotal.toFixed(1)}% of your income (over by {(newTotal - 100).toFixed(1)}%)
                      </Text>
                    </View>
                  );
                } else if (newTotal >= 90) {
                  return (
                    <View style={styles.inlineCaution}>
                      <Text style={styles.inlineCautionText}>
                        💡 This will use {newTotal.toFixed(1)}% of your income ({(100 - newTotal).toFixed(1)}% remaining)
                      </Text>
                    </View>
                  );
                }
                return null;
              })()
            )}

            {allocationValue && allocationType === 'amount' && totalIncome > 0 && (
              (() => {
                const currentAmount = parseFloat(allocationValue) || 0;
                const currentPercent = (currentAmount / totalIncome) * 100;
                const newTotal = allocatedPercent + currentPercent;
                const isOverAllocated = newTotal > 100;

                if (isOverAllocated) {
                  return (
                    <View style={styles.inlineWarning}>
                      <Text style={styles.inlineWarningText}>
                        ⚠️ This is {currentPercent.toFixed(1)}% of your income, taking you to {newTotal.toFixed(1)}% total
                      </Text>
                    </View>
                  );
                } else if (newTotal >= 90) {
                  return (
                    <View style={styles.inlineCaution}>
                      <Text style={styles.inlineCautionText}>
                        💡 This is {currentPercent.toFixed(1)}% of your income ({(100 - newTotal).toFixed(1)}% remaining after)
                      </Text>
                    </View>
                  );
                }
                return null;
              })()
            )}
          </View>
          )}

          {/* Target Amount (Save mode only) */}
          {bucketMode === 'save' && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.label}>Target Amount</Text>

              {/* Smart Suggestion */}
              {suggestion && suggestion.type === 'amount' && !targetAmount && (
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => setTargetAmount(suggestion.value.toString())}
                >
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionIcon}>💡</Text>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionTitle}>
                        Suggested: ${suggestion.value.toLocaleString()}
                      </Text>
                      <Text style={styles.suggestionDescription}>
                        {suggestion.description}
                      </Text>
                    </View>
                    <Text style={styles.suggestionAction}>Apply</Text>
                  </View>
                </TouchableOpacity>
              )}

              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#B5AFA5"
                />
              </View>
              <Text style={styles.helperText}>
                How much do you want to save in this bucket?
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Monthly Contribution */}
            <View style={styles.section}>
              <Text style={styles.label}>Monthly Contribution (Optional)</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    contributionType === 'none' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setContributionType('none')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      contributionType === 'none' && styles.toggleTextActive,
                    ]}
                  >
                    Manual Only
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    contributionType === 'amount' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setContributionType('amount')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      contributionType === 'amount' && styles.toggleTextActive,
                    ]}
                  >
                    $ Amount
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    contributionType === 'percentage' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setContributionType('percentage')}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      contributionType === 'percentage' && styles.toggleTextActive,
                    ]}
                  >
                    % Income
                  </Text>
                </TouchableOpacity>
              </View>
              {contributionType !== 'none' && (
                <View style={[styles.amountInputContainer, { marginTop: 16 }]}>
                  <Text style={styles.currencySymbol}>
                    {contributionType === 'amount' ? '$' : '%'}
                  </Text>
                  <TextInput
                    style={styles.amountInput}
                    value={contributionValue}
                    onChangeText={setContributionValue}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#B5AFA5"
                  />
                </View>
              )}
              <Text style={styles.helperText}>
                {contributionType === 'none'
                  ? "You'll add money manually whenever you want"
                  : "We'll allocate this automatically each month until you hit your target"}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Goal Alerts */}
            <View style={styles.section}>
              <Text style={styles.label}>Goal Alerts</Text>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                if (goalAlerts.includes(50)) {
                  setGoalAlerts(goalAlerts.filter(a => a !== 50));
                } else {
                  setGoalAlerts([...goalAlerts, 50].sort((a, b) => a - b));
                }
              }}
            >
              <View style={[styles.checkbox, goalAlerts.includes(50) && styles.checkboxActive]}>
                {goalAlerts.includes(50) && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>When I reach 50%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                if (goalAlerts.includes(75)) {
                  setGoalAlerts(goalAlerts.filter(a => a !== 75));
                } else {
                  setGoalAlerts([...goalAlerts, 75].sort((a, b) => a - b));
                }
              }}
            >
              <View style={[styles.checkbox, goalAlerts.includes(75) && styles.checkboxActive]}>
                {goalAlerts.includes(75) && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>When I reach 75%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                if (goalAlerts.includes(100)) {
                  setGoalAlerts(goalAlerts.filter(a => a !== 100));
                } else {
                  setGoalAlerts([...goalAlerts, 100].sort((a, b) => a - b));
                }
              }}
            >
              <View style={[styles.checkbox, goalAlerts.includes(100) && styles.checkboxActive]}>
                {goalAlerts.includes(100) && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>When I reach 100% (goal complete)</Text>
            </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setReminderDays(!reminderDays)}
              >
                <View style={[styles.checkbox, reminderDays && styles.checkboxActive]}>
                  {reminderDays && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Remind me if I haven't contributed in 30 days</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Cap Behavior */}
            <View style={styles.section}>
              <Text style={styles.label}>When Goal Is Reached</Text>

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setCapBehavior('stop')}
            >
              <View style={[styles.radio, capBehavior === 'stop' && styles.radioActive]}>
                {capBehavior === 'stop' && <View style={styles.radioDot} />}
              </View>
              <View style={styles.radioTextContainer}>
                <Text style={styles.radioLabel}>Stop contributions</Text>
                <Text style={styles.radioDescription}>Don't allocate more once target is reached</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setCapBehavior('unallocated')}
            >
              <View style={[styles.radio, capBehavior === 'unallocated' && styles.radioActive]}>
                {capBehavior === 'unallocated' && <View style={styles.radioDot} />}
              </View>
              <View style={styles.radioTextContainer}>
                <Text style={styles.radioLabel}>Reroute to unallocated</Text>
                <Text style={styles.radioDescription}>Keep available for manual allocation</Text>
              </View>
            </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => setCapBehavior('proportional')}
              >
                <View style={[styles.radio, capBehavior === 'proportional' && styles.radioActive]}>
                  {capBehavior === 'proportional' && <View style={styles.radioDot} />}
                </View>
                <View style={styles.radioTextContainer}>
                  <Text style={styles.radioLabel}>Distribute proportionally</Text>
                  <Text style={styles.radioDescription}>Split across other spend buckets</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
          )}

          {/* Alert Threshold (Spend mode only) */}
          {bucketMode === 'spend' && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.label}>Low Balance Alert (%)</Text>
              <TextInput
                style={styles.alertInput}
                value={alertThreshold}
                onChangeText={setAlertThreshold}
                keyboardType="decimal-pad"
                placeholder="20"
                placeholderTextColor="#B5AFA5"
              />
              <Text style={styles.helperText}>
                You'll be notified when {alertThreshold}% of your budget is used
              </Text>
            </View>
          </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DF',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: getFontFamily('regular'),
  },
  saveButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: getFontFamily('bold'),
  },
  saveButtonDisabled: {
    color: '#B5AFA5',
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: getFontFamily('bold'),
    color: '#877E6F',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    fontSize: 17,
    color: '#1A1A1A',
    fontFamily: getFontFamily('regular'),
    backgroundColor: '#FAFAF8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  currencySymbol: {
    fontSize: 28,
    color: '#877E6F',
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 12,
    fontWeight: '400',
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    color: '#1A1A1A',
    fontFamily: 'Merchant Copy, monospace',
    paddingVertical: 16,
    fontWeight: '400',
  },
  helperText: {
    fontSize: 14,
    color: '#877E6F',
    fontFamily: getFontFamily('regular'),
    marginTop: 12,
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F3F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  toggleText: {
    fontSize: 15,
    color: '#877E6F',
    fontFamily: getFontFamily('regular'),
    letterSpacing: -0.2,
  },
  alertInput: {
    fontSize: 28,
    color: '#1A1A1A',
    fontFamily: 'Merchant Copy, monospace',
    backgroundColor: '#FAFAF8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    fontWeight: '400',
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontFamily: getFontFamily('bold'),
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D5CFBF',
    backgroundColor: '#FAFAF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 21,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D5CFBF',
    backgroundColor: '#FAFAF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  radioActive: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.primary,
  },
  radioTextContainer: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 15,
    fontFamily: getFontFamily('bold'),
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  radioDescription: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: '#877E6F',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E4DF',
    marginHorizontal: 24,
    marginVertical: 16,
  },
  suggestionCard: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D0DCFF',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionIcon: {
    fontSize: 24,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 15,
    fontFamily: getFontFamily('bold'),
    color: '#2D3F8E',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  suggestionDescription: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: '#5A6BA8',
    lineHeight: 18,
  },
  suggestionAction: {
    fontSize: 15,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  budgetOverview: {
    backgroundColor: '#F8F9FA',
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 8,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  budgetRowHighlight: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DF',
  },
  budgetLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: '#877E6F',
  },
  budgetLabelBold: {
    fontSize: 15,
    fontFamily: getFontFamily('bold'),
    color: '#1A1A1A',
  },
  budgetValue: {
    fontSize: 15,
    fontFamily: 'Merchant Copy, monospace',
    color: '#1A1A1A',
  },
  budgetValueBold: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.primary,
  },
  budgetValueWarning: {
    color: '#F59E0B',
  },
  budgetValueDanger: {
    color: theme.colors.danger,
  },
  warningBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE5A3',
  },
  warningText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#856404',
    fontFamily: getFontFamily('bold'),
    marginBottom: 6,
  },
  warningSubtext: {
    fontSize: 14,
    color: '#856404',
    fontFamily: getFontFamily('regular'),
    lineHeight: 20,
  },
  inlineWarning: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  inlineWarningText: {
    fontSize: 13,
    color: '#991B1B',
    fontFamily: getFontFamily('regular'),
    lineHeight: 18,
  },
  inlineCaution: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inlineCautionText: {
    fontSize: 13,
    color: '#92400E',
    fontFamily: getFontFamily('regular'),
    lineHeight: 18,
  },
});
