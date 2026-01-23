import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Edit2, Plus } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { formatDistanceToNow } from 'date-fns';
import type { Bucket, Expense } from '../types';
import { BUCKET_ICON_IMAGES, type BucketIcon } from '../constants/bucketIcons';

interface BucketDetailProps {
  visible: boolean;
  bucket: Bucket;
  onBack: () => void;
  onEditBucket?: (bucket: Bucket) => void;
  onEditExpense?: (expense: Expense, bucket: Bucket) => void;
  onAddExpense?: (bucket: Bucket) => void;
}

export const BucketDetail: React.FC<BucketDetailProps> = ({
  visible,
  bucket,
  onBack,
  onEditBucket,
  onEditExpense,
  onAddExpense,
}) => {
  // Calculate values based on bucket mode
  const isSaveBucket = bucket.bucketMode === 'save';

  let displayLabel = '';
  let displayAmount = 0;
  let displaySubtext = '';
  let allocationText = '';

  if (isSaveBucket) {
    // For save buckets: show current balance vs target
    const currentBalance = bucket.currentBalance || 0;
    const targetAmount = bucket.targetAmount || 0;
    displayLabel = 'CURRENT SAVINGS';
    displayAmount = currentBalance;
    displaySubtext = `$${currentBalance.toFixed(2)} saved of $${targetAmount.toFixed(2)}`;

    if (bucket.contributionType !== 'none') {
      const contribution = bucket.contributionType === 'amount'
        ? `$${(bucket.contributionAmount || 0).toFixed(2)}`
        : `${(bucket.contributionPercent || 0)}% of income`;
      allocationText = `Monthly contribution: ${contribution}`;
    }
  } else {
    // For spend buckets: show spent vs funded
    const totalSpent = bucket.spentAmount || 0;
    const allocated = bucket.fundedAmount || 0;
    const carryover = bucket.carryoverBalance || 0;
    const totalAvailable = allocated + carryover;
    const remaining = totalAvailable - totalSpent;

    displayLabel = 'TOTAL SPENT';
    displayAmount = totalSpent;
    displaySubtext = `$${remaining.toFixed(2)} remaining of $${totalAvailable.toFixed(2)}`;
    allocationText = `Allocated this month: $${allocated.toFixed(2)}`;
  }

  // Get expenses for this bucket from Convex
  const expenses = useQuery(api.expenses.getByBucket, { bucketId: bucket._id as any });

  // Default to 'octopus' if icon is not set (for backward compatibility)
  const iconName = (bucket.icon || 'octopus') as BucketIcon;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onBack}
    >
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bucket Detail</Text>
        {onEditBucket ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEditBucket(bucket)}
          >
            <Edit2 size={20} color="#4747FF" strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Bucket Info - Fixed */}
      <View style={styles.bucketInfo}>
        <View style={styles.iconContainer}>
          <Image
            source={BUCKET_ICON_IMAGES[iconName]}
            style={styles.iconImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.bucketName}>{bucket.name}</Text>
        <View style={styles.spentCard}>
          <Text style={styles.spentLabel}>{displayLabel}</Text>
          <Text style={styles.spentAmount}>${displayAmount.toFixed(2)}</Text>
          <Text style={styles.remainingText}>{displaySubtext}</Text>
          {allocationText && (
            <Text style={styles.allocationText}>{allocationText}</Text>
          )}
        </View>
      </View>

      {/* Transactions Header - Fixed */}
      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsTitle}>Transactions</Text>
        {onAddExpense && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAddExpense(bucket)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transactions List - Scrollable */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {expenses === undefined ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4747FF" />
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No expenses yet</Text>
            <Text style={styles.emptySubtext}>
              Start tracking expenses in this bucket
            </Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {expenses.map(expense => (
              <TouchableOpacity
                key={expense._id}
                style={styles.transactionItem}
                onPress={() =>
                  onEditExpense && onEditExpense(expense, bucket)
                }
              >
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionName}>
                    {expense.note || 'Expense'}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDistanceToNow(new Date(expense.createdAt), {
                      addSuffix: true,
                    })}
                  </Text>
                </View>
                <Text style={styles.transactionAmount}>
                  ${expense.amount.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3F0',
    width: '100%' as any,
    height: '100%' as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexShrink: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#0A0A0A',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant, monospace',
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  bucketInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    flexShrink: 0,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconImage: {
    width: 80,
    height: 80,
  },
  bucketName: {
    fontSize: 24,
    fontWeight: '500',
    color: '#0A0A0A',
    marginBottom: 24,
    fontFamily: 'Merchant, monospace',
    letterSpacing: -0.5,
  },
  spentCard: {
    backgroundColor: '#4747FF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  spentLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Merchant, monospace',
  },
  spentAmount: {
    fontSize: 32,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'Merchant Copy, monospace',
    letterSpacing: 0,
    marginBottom: 12,
  },
  remainingText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Merchant Copy, monospace',
  },
  allocationText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Merchant, monospace',
    marginTop: 8,
    fontStyle: 'italic',
  },
  savingsInfo: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  savingsRowTotal: {
    paddingTop: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  savingsLabel: {
    fontSize: 15,
    color: '#9CA3AF',
    fontFamily: 'Merchant, monospace',
  },
  savingsLabelBold: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant, monospace',
  },
  savingsValue: {
    fontSize: 16,
    color: '#0A0A0A',
    fontFamily: 'Merchant Copy, monospace',
  },
  savingsValueBold: {
    fontSize: 18,
    fontWeight: '500',
    color: '#4747FF',
    fontFamily: 'Merchant Copy, monospace',
  },
  savingsValueNegative: {
    color: '#DC2626',
  },
  transactionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexShrink: 0,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant, monospace',
    letterSpacing: -0.3,
  },
  addButton: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4747FF',
    fontFamily: 'Merchant, monospace',
  },
  transactionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginHorizontal: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0A0A0A',
    marginBottom: 4,
    fontFamily: 'Merchant, monospace',
  },
  transactionDate: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'Merchant, monospace',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant Copy, monospace',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant, monospace',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#9CA3AF',
    fontFamily: 'Merchant, monospace',
    textAlign: 'center',
  },
});
