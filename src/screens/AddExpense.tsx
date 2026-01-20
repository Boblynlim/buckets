import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import { DatePicker } from '../components/DatePicker';

interface AddExpenseProps {
  visible?: boolean;
  onClose?: () => void;
}

export const AddExpense: React.FC<AddExpenseProps> = ({
  visible = true,
  onClose,
}) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [happinessRating, setHappinessRating] = useState(3);
  const [date, setDate] = useState(new Date());
  const [showBucketPicker, setShowBucketPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Get current user and buckets from Convex
  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const createExpense = useMutation(api.expenses.create);

  // Initialize demo user if needed
  React.useEffect(() => {
    if (currentUser === null) {
      console.log('No user found in AddExpense, initializing...');
      initDemoUser().catch(err => {
        console.error('Error initializing demo user:', err);
      });
    }
  }, [currentUser, initDemoUser]);

  // Use real buckets data
  const allBuckets = buckets || [];
  const [selectedBucket, setSelectedBucket] = useState(allBuckets[0]);

  // Update selected bucket when buckets load or when data changes
  React.useEffect(() => {
    if (allBuckets.length > 0 && !selectedBucket) {
      setSelectedBucket(allBuckets[0]);
    }
    // Update selected bucket if it exists in the new buckets list
    if (selectedBucket && allBuckets.length > 0) {
      const updatedBucket = allBuckets.find((b: any) => b._id === selectedBucket._id);
      if (
        updatedBucket &&
        updatedBucket.currentBalance !== selectedBucket.currentBalance
      ) {
        console.log('Bucket balance updated:', {
          bucketName: updatedBucket.name,
          oldBalance: selectedBucket.currentBalance,
          newBalance: updatedBucket.currentBalance,
        });
        setSelectedBucket(updatedBucket);
      }
    }
  }, [allBuckets]);

  // Log bucket data for debugging
  React.useEffect(() => {
    if (selectedBucket) {
      console.log('Selected bucket:', {
        name: selectedBucket.name,
        currentBalance: selectedBucket.currentBalance,
        allocationValue: selectedBucket.allocationValue,
      });
    }
  }, [selectedBucket]);

  const handleSave = async () => {
    // Wait for user to be initialized if it's null
    if (currentUser === null) {
      console.log('User is null, initializing before save...');
      await initDemoUser();
      // Query will refetch automatically, but user needs to try again
      alert('Please try saving again. Your account is being set up.');
      return;
    }

    // Still loading
    if (currentUser === undefined) {
      return; // Wait for query to complete
    }

    if (!selectedBucket) {
      alert('Please select a bucket');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await createExpense({
        userId: currentUser._id,
        bucketId: selectedBucket._id,
        amount: parseFloat(amount),
        date: date.getTime(),
        note,
        happinessRating,
      });

      // Reset form
      setAmount('');
      setNote('');
      setHappinessRating(3);
      setDate(new Date());

      // Close modal
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to create expense:', error);
      alert(error.message || 'Failed to add expense. Please try again.');
    }
  };

  // Helper function to calculate available balance based on bucket mode
  const getAvailableBalance = (bucket: any) => {
    if (!bucket) return 0;

    if (bucket.bucketMode === 'spend') {
      // For spend buckets: (funded + carryover) - spent
      const funded = bucket.fundedAmount || 0;
      const carryover = bucket.carryoverBalance || 0;
      const spent = bucket.spentAmount || 0;
      return (funded + carryover) - spent; // Can be negative if overspent
    } else {
      // For save buckets: current balance
      return bucket.currentBalance || 0;
    }
  };

  const amountValue = parseFloat(amount) || 0;
  const availableBalance = selectedBucket ? getAvailableBalance(selectedBucket) : 0;
  const hasInsufficientBalance =
    selectedBucket && amountValue > availableBalance;
  const isValid =
    amount && amountValue > 0 && selectedBucket && !hasInsufficientBalance;

  const happinessEmojis = ['😢', '😕', '😐', '🙂', '😄'];
  const happinessLabels = ['Poor', 'Fair', 'Okay', 'Good', 'Great'];

  // Show loading state while fetching data
  if (currentUser === undefined || buckets === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4747FF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state if no buckets
  if (allBuckets.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Expense</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No buckets yet!</Text>
          <Text style={styles.emptySubtext}>
            Create a bucket first to track expenses.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.title}>Add Expense</Text>
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

          {/* Info message if no buckets are funded */}
          {allBuckets.every((b: any) => getAvailableBalance(b) === 0) && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Your buckets aren't funded yet!
                {'\n\n'}Go to Settings → Set Income and add your recurring monthly income to automatically fund your buckets.
              </Text>
            </View>
          )}

          {/* Amount Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#B5AFA5"
              />
            </View>
          </View>

          {/* Bucket Selector */}
          <View style={styles.section}>
            <Text style={styles.label}>Bucket</Text>
            <Pressable
              style={styles.bucketSelector}
              onPress={() => setShowBucketPicker(!showBucketPicker)}
            >
              <View style={styles.bucketSelectorContent}>
                <View
                  style={[
                    styles.bucketColorDot,
                    {
                      backgroundColor:
                        selectedBucket?.color || theme.colors.primary,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bucketSelectorText}>
                    {selectedBucket?.name || 'Select a bucket'}
                  </Text>
                  {selectedBucket && (
                    <Text style={styles.bucketBalanceHint}>
                      ${availableBalance.toFixed(2)}{' '}
                      available
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            {/* Bucket Picker */}
            {showBucketPicker && (
              <View style={styles.bucketPicker}>
                {allBuckets.map((bucket: any) => (
                  <TouchableOpacity
                    key={bucket._id}
                    style={[
                      styles.bucketOption,
                      selectedBucket?._id === bucket._id &&
                        styles.bucketOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedBucket(bucket);
                      setShowBucketPicker(false);
                    }}
                  >
                    <View
                      style={[
                        styles.bucketColorDot,
                        { backgroundColor: bucket.color },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bucketOptionText}>{bucket.name}</Text>
                      <Text style={styles.bucketBalance}>
                        ${getAvailableBalance(bucket).toFixed(2)} available
                      </Text>
                    </View>
                    {selectedBucket?._id === bucket._id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Insufficient Balance Warning */}
            {hasInsufficientBalance && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  {availableBalance === 0 && selectedBucket.bucketMode === 'spend' ? (
                    <>
                      💡 This bucket isn't funded yet!
                      {'\n'}Add recurring income in Settings to automatically fund your buckets.
                    </>
                  ) : (
                    <>
                      ⚠️ Insufficient balance! This bucket only has $
                      {availableBalance.toFixed(2)} available.
                      {'\n'}Add more income or reduce the expense amount.
                    </>
                  )}
                </Text>
              </View>
            )}
          </View>

          {/* Note Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="What did you buy?"
              placeholderTextColor="#B5AFA5"
              multiline
            />
          </View>

          {/* Happiness Rating */}
          <View style={styles.section}>
            <Text style={styles.label}>
              How happy does this purchase make you?
            </Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map(rating => (
                <TouchableOpacity
                  key={rating}
                  style={[
                    styles.ratingButton,
                    happinessRating === rating && styles.ratingButtonSelected,
                  ]}
                  onPress={() => setHappinessRating(rating)}
                >
                  <Text style={styles.ratingEmoji}>
                    {happinessEmojis[rating - 1]}
                  </Text>
                  <Text
                    style={[
                      styles.ratingLabel,
                      happinessRating === rating && styles.ratingLabelSelected,
                    ]}
                  >
                    {happinessLabels[rating - 1]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.label}>Date</Text>
            <Pressable
              style={styles.dateDisplay}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Date Picker Modal */}
        <DatePicker
          visible={showDatePicker}
          selectedDate={date}
          onSelectDate={setDate}
          onClose={() => setShowDatePicker(false)}
        />
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
  amountContainer: {
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
    fontWeight: '400',
    color: '#877E6F',
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '400',
    color: '#1A1A1A',
    fontFamily: 'Merchant Copy, monospace',
    paddingVertical: 16,
  },
  bucketSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAF8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  bucketSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bucketColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  bucketSelectorText: {
    fontSize: 17,
    color: '#1A1A1A',
    fontFamily: getFontFamily('regular'),
  },
  bucketBalanceHint: {
    fontSize: 14,
    color: '#877E6F',
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    color: '#D5CFBF',
    fontWeight: '300',
  },
  bucketPicker: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  bucketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DF',
  },
  bucketOptionSelected: {
    backgroundColor: theme.colors.primary + '10',
  },
  bucketOptionText: {
    fontSize: 17,
    color: '#1A1A1A',
    fontFamily: getFontFamily('regular'),
  },
  bucketBalance: {
    fontSize: 14,
    color: '#877E6F',
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 4,
  },
  checkmark: {
    fontSize: 20,
    color: '#4747FF',
    fontWeight: '600',
  },
  noteInput: {
    fontSize: 17,
    color: '#1A1A1A',
    fontFamily: getFontFamily('regular'),
    backgroundColor: '#FAFAF8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FAFAF8',
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  ratingButtonSelected: {
    backgroundColor: '#4747FF',
    borderColor: '#4747FF',
    shadowColor: '#4747FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  ratingEmoji: {
    fontSize: 32,
    marginBottom: 6,
    lineHeight: 36,
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 13,
    color: '#877E6F',
    fontWeight: '500',
    fontFamily: getFontFamily('regular'),
    letterSpacing: -0.2,
  },
  ratingLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dateDisplay: {
    backgroundColor: '#FAFAF8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  dateText: {
    fontSize: 17,
    color: '#1A1A1A',
    fontFamily: 'Merchant Copy, monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    backgroundColor: '#FDFCFB',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 340,
  },
  datePickerTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  datePickerOptions: {
    gap: 12,
    marginBottom: 20,
  },
  dateOption: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateOptionText: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
  },
  dateOptionSubtext: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.textSecondary,
  },
  customDateSection: {
    marginTop: 8,
  },
  customDateLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  dateInputField: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
  },
  datePickerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  datePickerCloseButton: {
    flex: 1,
    backgroundColor: theme.colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  datePickerCloseButtonText: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  datePickerConfirmButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  datePickerConfirmButtonText: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textOnPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant, monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#2D2D2D',
    fontFamily: 'Merchant, monospace',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8A8478',
    fontFamily: 'Merchant, monospace',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    fontFamily: getFontFamily('regular'),
    lineHeight: 22,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFE5A3',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    fontFamily: getFontFamily('regular'),
    lineHeight: 21,
  },
  iosPickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FDFCFB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  iosPickerTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  iosPickerCancel: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  iosPickerDone: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
  },
  iosDatePicker: {
    backgroundColor: '#FDFCFB',
    height: 260,
  },
});
