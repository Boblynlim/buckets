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
  visible: boolean;
  onClose: () => void;
}

export const AddExpense: React.FC<AddExpenseProps> = ({ visible, onClose }) => {
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
      const updatedBucket = allBuckets.find(b => b._id === selectedBucket._id);
      if (updatedBucket && updatedBucket.currentBalance !== selectedBucket.currentBalance) {
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
      onClose();
    } catch (error: any) {
      console.error('Failed to create expense:', error);
      alert(error.message || 'Failed to add expense. Please try again.');
    }
  };

  const amountValue = parseFloat(amount) || 0;
  const hasInsufficientBalance = selectedBucket && amountValue > selectedBucket.currentBalance;
  const isValid = amount && amountValue > 0 && selectedBucket && !hasInsufficientBalance;

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
                placeholderTextColor="#C7C7CC"
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
                    { backgroundColor: selectedBucket?.color || theme.colors.primary },
                  ]}
                />
                <View style={{flex: 1}}>
                  <Text style={styles.bucketSelectorText}>
                    {selectedBucket?.name || 'Select a bucket'}
                  </Text>
                  {selectedBucket && (
                    <Text style={styles.bucketBalanceHint}>
                      ${selectedBucket.currentBalance.toFixed(2)} available
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            {/* Bucket Picker */}
            {showBucketPicker && (
              <View style={styles.bucketPicker}>
                {allBuckets.map(bucket => (
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
                    <View style={{flex: 1}}>
                      <Text style={styles.bucketOptionText}>{bucket.name}</Text>
                      <Text style={styles.bucketBalance}>
                        ${bucket.currentBalance.toFixed(2)} available
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
                  ⚠️ Insufficient balance! This bucket only has ${selectedBucket.currentBalance.toFixed(2)} available.
                  {'\n'}Add income to your buckets in Settings.
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
              placeholderTextColor="#C7C7CC"
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
    backgroundColor: '#F5F3F0',
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
    backgroundColor: '#FDFCFB',
    borderRadius: 20,
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: '#8A8478',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '400',
    color: '#8A8478',
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '400',
    color: '#2D2D2D',
    fontFamily: 'Merchant Copy, monospace',
    paddingVertical: 12,
    minHeight: 20,
    lineHeight: 20,
  },
  bucketSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
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
    fontSize: 14,
    color: '#2D2D2D',
    fontFamily: getFontFamily('regular'),
  },
  bucketBalanceHint: {
    fontSize: 20,
    color: '#8A8478',
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#C4BCAE',
  },
  bucketPicker: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  bucketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  bucketOptionSelected: {
    backgroundColor: '#EDEDFF',
  },
  bucketOptionText: {
    fontSize: 14,
    color: '#2D2D2D',
    fontFamily: getFontFamily('regular'),
  },
  bucketBalance: {
    fontSize: 20,
    color: '#8A8478',
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: '#4747FF',
    fontWeight: '500',
  },
  noteInput: {
    fontSize: 14,
    color: '#2D2D2D',
    fontFamily: getFontFamily('regular'),
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 80,
  },
  ratingButtonSelected: {
    backgroundColor: '#4747FF',
  },
  ratingEmoji: {
    fontSize: 28,
    marginBottom: 4,
    lineHeight: 32,
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#8A8478',
    fontWeight: '500',
    fontFamily: getFontFamily('regular'),
  },
  ratingLabelSelected: {
    color: '#FFFFFF',
  },
  dateDisplay: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 20,
    color: '#2D2D2D',
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
    fontSize: 18,
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
    fontSize: 20,
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
    fontSize: 20,
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
    color: '#8A8478',
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
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    fontFamily: getFontFamily('regular'),
    lineHeight: 18,
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
