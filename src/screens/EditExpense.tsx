import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import type { Expense, Bucket } from '../types';
import { DatePicker } from '../components/DatePicker';

interface EditExpenseProps {
  visible?: boolean;
  expense: Expense;
  bucket: Bucket;
  onClose?: () => void;
}

export const EditExpense: React.FC<EditExpenseProps> = ({
  visible = true,
  expense,
  bucket,
  onClose,
}) => {

  const [amount, setAmount] = useState(expense.amount.toString());
  const [note, setNote] = useState(expense.note);
  const [happinessRating, setHappinessRating] = useState(expense.happinessRating);
  const [date, setDate] = useState(new Date(expense.date));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBucketPicker, setShowBucketPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Get current user and buckets
  const currentUser = useQuery(api.users.getCurrentUser);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const updateExpense = useMutation(api.expenses.update);
  const removeExpense = useMutation(api.expenses.remove);

  const allBuckets = buckets || [];
  const [selectedBucket, setSelectedBucket] = useState(bucket);

  const isValid = amount && parseFloat(amount) > 0;
  const happinessEmojis = ['😢', '😕', '😐', '🙂', '😄'];
  const happinessLabels = ['Poor', 'Fair', 'Okay', 'Good', 'Great'];

  const handleSave = async () => {
    if (!isValid || !currentUser) {
      alert('Please enter a valid amount');
      return;
    }

    const newAmount = parseFloat(amount);
    const amountDiff = newAmount - expense.amount;

    // Check if new bucket has sufficient balance (if changing buckets or increasing amount)
    if (selectedBucket._id !== bucket._id || amountDiff > 0) {
      const targetBucket = selectedBucket._id !== bucket._id ? selectedBucket : bucket;
      const requiredBalance = selectedBucket._id !== bucket._id ? newAmount : amountDiff;

      if (targetBucket.currentBalance < requiredBalance) {
        alert(
          `Insufficient balance in ${targetBucket.name}.\nAvailable: $${targetBucket.currentBalance.toFixed(2)}\nRequired: $${requiredBalance.toFixed(2)}`
        );
        return;
      }
    }

    try {
      await updateExpense({
        expenseId: expense._id,
        bucketId: selectedBucket._id,
        amount: newAmount,
        date: date.getTime(),
        note: note.trim(),
        happinessRating,
      });

      alert('Expense updated successfully!');

      // Close modal or navigate back
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to update expense:', error);
      alert(error.message || 'Failed to update expense. Please try again.');
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);

    try {
      await removeExpense({ expenseId: expense._id });

      alert('Expense deleted successfully!\nBalance refunded to bucket.');

      // Close modal or navigate back
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to delete expense:', error);
      alert(error.message || 'Failed to delete expense. Please try again.');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const content = (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Expense</Text>
          <TouchableOpacity onPress={handleSave} disabled={!isValid}>
            <Text
              style={[
                styles.saveButton,
                !isValid && styles.saveButtonDisabled,
              ]}>
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
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
        </View>

        {/* Bucket Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Bucket</Text>
          <Pressable
            style={styles.bucketSelector}
            onPress={() => setShowBucketPicker(!showBucketPicker)}>
            <View style={styles.bucketSelectorContent}>
              <View
                style={[
                  styles.bucketColorDot,
                  { backgroundColor: selectedBucket.color },
                ]}
              />
              <Text style={styles.bucketSelectorText}>
                {selectedBucket.name}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {/* Bucket Picker */}
          {showBucketPicker && (
            <View style={styles.bucketPicker}>
              {allBuckets.map(b => (
                <TouchableOpacity
                  key={b._id}
                  style={[
                    styles.bucketOption,
                    selectedBucket._id === b._id &&
                      styles.bucketOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedBucket(b);
                    setShowBucketPicker(false);
                  }}>
                  <View
                    style={[
                      styles.bucketColorDot,
                      { backgroundColor: b.color },
                    ]}
                  />
                  <Text style={styles.bucketOptionText}>{b.name}</Text>
                  <Text style={styles.bucketBalance}>
                    ${b.currentBalance.toFixed(2)}
                  </Text>
                  {selectedBucket._id === b._id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
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
            placeholderTextColor={theme.colors.textTertiary}
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
                onPress={() => setHappinessRating(rating)}>
                <Text style={styles.ratingEmoji}>
                  {happinessEmojis[rating - 1]}
                </Text>
                <Text
                  style={[
                    styles.ratingLabel,
                    happinessRating === rating && styles.ratingLabelSelected,
                  ]}>
                  {happinessLabels[rating - 1]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Section */}
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

        {/* Delete Button */}
        <View style={styles.deleteSection}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Expense</Text>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>
            Balance will be refunded to bucket
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Expense?</Text>
            <Text style={styles.modalMessage}>
              Delete this ${expense.amount.toFixed(2)} expense? The amount will be refunded to the bucket.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={confirmDelete}>
                <Text style={styles.modalButtonTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      <DatePicker
        visible={showDatePicker}
        selectedDate={date}
        onSelectDate={setDate}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );

  // If visible prop is provided (web), wrap in Modal
  if (onClose) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}>
        {content}
      </Modal>
    );
  }

  // Otherwise return content directly (native navigation)
  return content;
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
    borderRadius: 20,
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
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '400',
    color: theme.colors.text,
    fontFamily: 'Merchant Copy, monospace',
    paddingVertical: 12,
    minHeight: 20,
  },
  bucketSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.cardBackground,
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
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
  },
  chevron: {
    fontSize: 20,
    color: theme.colors.textTertiary,
  },
  bucketPicker: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.cardBackground,
  },
  bucketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  bucketOptionSelected: {
    backgroundColor: theme.colors.purple100,
  },
  bucketOptionText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
  },
  bucketBalance: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 8,
  },
  checkmark: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  noteInput: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
    backgroundColor: theme.colors.cardBackground,
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
    backgroundColor: theme.colors.cardBackground,
    minHeight: 80,
  },
  ratingButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  ratingEmoji: {
    fontSize: 28,
    marginBottom: 4,
    lineHeight: 32,
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    fontFamily: getFontFamily('regular'),
  },
  ratingLabelSelected: {
    color: theme.colors.textOnPrimary,
  },
  infoSection: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: theme.colors.purple100,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
  },
  deleteSection: {
    marginHorizontal: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textOnPrimary,
  },
  deleteHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.border,
  },
  modalButtonDelete: {
    backgroundColor: theme.colors.danger,
  },
  modalButtonTextCancel: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  modalButtonTextDelete: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textOnPrimary,
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
  chevron: {
    fontSize: 20,
    color: '#C4BCAE',
  },
});
