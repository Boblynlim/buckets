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

          {/* Bucket Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Bucket Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={bucketMode === 'spend' ? 'e.g., Groceries, Fun Money' : 'e.g., Emergency Fund, Vacation'}
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>

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
          )}

          {/* Allocation Value (Spend mode only) */}
          {bucketMode === 'spend' && (
          <View style={styles.section}>
            <Text style={styles.label}>
              {allocationType === 'amount'
                ? 'Monthly Amount'
                : 'Percentage of Income'}
            </Text>
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
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>
          </View>
          )}

          {/* Target Amount (Save mode only) */}
          {bucketMode === 'save' && (
          <View style={styles.section}>
            <Text style={styles.label}>Target Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>
            <Text style={styles.helperText}>
              How much do you want to save in this bucket?
            </Text>
          </View>
          )}

          {/* Monthly Contribution (Save mode only) */}
          {bucketMode === 'save' && (
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
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>
                  {contributionType === 'amount' ? '$' : '%'}
                </Text>
                <TextInput
                  style={styles.amountInput}
                  value={contributionValue}
                  onChangeText={setContributionValue}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>
            )}
            <Text style={styles.helperText}>
              {contributionType === 'none'
                ? "You'll add money manually whenever you want"
                : "We'll allocate this automatically each month until you hit your target"}
            </Text>
          </View>
          )}

          {/* Goal Alerts (Save mode only) */}
          {bucketMode === 'save' && (
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
          )}

          {/* Cap Behavior (Save mode only) */}
          {bucketMode === 'save' && (
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
          )}

          {/* Alert Threshold (Spend mode only) */}
          {bucketMode === 'spend' && (
          <View style={styles.section}>
            <Text style={styles.label}>Low Balance Alert (%)</Text>
            <TextInput
              style={styles.alertInput}
              value={alertThreshold}
              onChangeText={setAlertThreshold}
              keyboardType="decimal-pad"
              placeholder="20"
              placeholderTextColor={theme.colors.textTertiary}
            />
            <Text style={styles.helperText}>
              You'll be notified when {alertThreshold}% of your budget is used
            </Text>
          </View>
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
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  cancelButton: {
    fontSize: 14,
    color: theme.colors.primary,
    fontFamily: getFontFamily('regular'),
  },
  saveButton: {
    fontSize: 14,
    color: theme.colors.primary,
    fontFamily: getFontFamily('bold'),
  },
  saveButtonDisabled: {
    color: theme.colors.textTertiary,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    color: theme.colors.text,
    fontFamily: 'Merchant Copy, monospace',
    paddingVertical: 12,
    minHeight: 20,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    marginTop: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.sm,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('bold'),
  },
  alertInput: {
    fontSize: 20,
    color: theme.colors.text,
    fontFamily: 'Merchant Copy, monospace',
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    minHeight: 20,
    lineHeight: 20,
  },
  toggleTextActive: {
    color: theme.colors.textOnPrimary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    fontSize: 14,
    color: theme.colors.textOnPrimary,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    flex: 1,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioActive: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  radioTextContainer: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 2,
  },
  radioDescription: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
});
