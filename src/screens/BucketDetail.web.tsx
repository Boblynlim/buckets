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
} from 'react-native';
import { Edit2 } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { formatDistanceToNow } from 'date-fns';
import type { Bucket, Expense } from '../types';
import { BUCKET_ICON_IMAGES, type BucketIcon } from '../constants/bucketIcons';

interface BucketDetailProps {
  bucket: Bucket;
  onBack: () => void;
  onEditBucket?: (bucket: Bucket) => void;
  onEditExpense?: (expense: Expense, bucket: Bucket) => void;
}

export const BucketDetail: React.FC<BucketDetailProps> = ({
  bucket,
  onBack,
  onEditBucket,
  onEditExpense,
}) => {
  // IMPORTANT: Use spentAmount from backend (derived from transactions)
  // This ensures deletes/edits automatically update the value
  const totalSpent = bucket.spentAmount || 0;
  const totalFunded = bucket.fundedAmount || bucket.allocationValue || 0;
  const remaining = Math.max(0, totalFunded - totalSpent);

  // Get expenses for this bucket from Convex
  const expenses = useQuery(api.expenses.getByBucket, { bucketId: bucket._id });

  // Default to 'octopus' if icon is not set (for backward compatibility)
  const iconName = (bucket.icon || 'octopus') as BucketIcon;

  return (
    <SafeAreaView style={styles.container}>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Bucket Info */}
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
            <Text style={styles.spentLabel}>TOTAL SPENT</Text>
            <Text style={styles.spentAmount}>${totalSpent.toFixed(2)}</Text>
            <Text style={styles.remainingText}>
              ${remaining.toFixed(2)} remaining of ${totalFunded.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Transactions List */}
        <View style={styles.transactionsContainer}>
          <Text style={styles.transactionsTitle}>Transactions</Text>

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  },
  scrollContent: {
    paddingBottom: 120,
  },
  bucketInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
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
  transactionsContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0A0A0A',
    marginBottom: 16,
    fontFamily: 'Merchant, monospace',
    letterSpacing: -0.3,
  },
  transactionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
