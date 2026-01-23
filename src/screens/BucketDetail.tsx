import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useQuery, useMutation} from 'convex/react';
import {api} from '../../convex/_generated/api';
import type {Bucket, Expense} from '../types';
import {theme} from '../theme';
import {getFontFamily} from '../theme/fonts';
import {SwipeableExpense} from '../components/SwipeableExpense';

type BucketsStackParamList = {
  BucketsOverview: undefined;
  BucketDetail: {bucket: Bucket};
  EditBucket: {bucket: Bucket};
  EditExpense: {expense: Expense; bucket: Bucket};
};

type NavigationProp = NativeStackNavigationProp<BucketsStackParamList>;

type BucketDetailRouteProp = RouteProp<
  BucketsStackParamList,
  'BucketDetail'
>;

// Props for web usage (optional, falls back to navigation)
interface BucketDetailProps {
  bucket?: Bucket;
  onBack?: () => void;
  onEditBucket?: (bucket: Bucket) => void;
  onEditExpense?: (expense: Expense, bucket: Bucket) => void;
}

export const BucketDetail: React.FC<BucketDetailProps> = (props) => {
  // Safely get navigation (will be null on web)
  let route: any = null;
  let navigation: any = null;

  try {
    const { useRoute, useNavigation } = require('@react-navigation/native');
    route = useRoute() as BucketDetailRouteProp;
    navigation = useNavigation() as NavigationProp;
  } catch (error) {
    // Not in navigation context (web) - use props instead
  }

  // Support both prop-based (web) and route-based (mobile) usage
  const bucket = props.bucket || route?.params?.bucket;
  const [refreshing, setRefreshing] = useState(false);

  // Get expenses for this bucket from Convex
  const expenses = useQuery(api.expenses.getByBucket, bucket ? { bucketId: bucket._id as any } : 'skip');
  const deleteExpense = useMutation(api.expenses.remove);

  // Calculate values based on bucket mode
  const isSaveBucket = bucket.bucketMode === 'save';

  let spent = 0;
  let funded = 0;
  let carryover = 0;
  let totalFunded = 0;
  let remaining = 0;
  let percentUsed = 0;

  if (isSaveBucket) {
    // For save buckets: show current balance vs target
    const currentBalance = bucket.currentBalance || 0;
    const targetAmount = bucket.targetAmount || 0;
    remaining = currentBalance;
    totalFunded = targetAmount;
    percentUsed = targetAmount > 0 ? (currentBalance / targetAmount) * 100 : 0;
  } else {
    // For spend buckets: show spent vs funded
    spent = bucket.spentAmount || 0;
    funded = bucket.fundedAmount || bucket.allocationValue || 0;
    carryover = bucket.carryoverBalance || 0;
    totalFunded = funded + carryover;
    remaining = totalFunded - spent; // Can be negative if overspent
    percentUsed = totalFunded > 0
      ? Math.min(100, (spent / totalFunded) * 100)
      : 0;
  }

  const happinessEmojis = ['😢', '😕', '😐', '🙂', '😄'];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleEditExpense = (expense: Expense) => {
    if (props.onEditExpense && bucket) {
      props.onEditExpense(expense, bucket);
    } else if (navigation) {
      navigation.navigate('EditExpense', {expense, bucket});
    }
  };

  const handleEditBucket = () => {
    if (props.onEditBucket && bucket) {
      props.onEditBucket(bucket);
    } else if (navigation) {
      navigation.navigate('EditBucket', {bucket});
    }
  };

  const handleDeleteExpense = (expenseId: string, expenseNote: string) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expenseNote}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense({ expenseId: expenseId as any });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete expense');
              console.error('Delete expense error:', error);
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // The useQuery will automatically refetch
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Show loading state while expenses are loading
  const isLoading = expenses === undefined;
  const expensesList = expenses || [];

  // Guard against missing bucket
  if (!bucket) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Bucket not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => props.onBack ? props.onBack() : navigation?.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{bucket.name}</Text>
          <Text style={styles.subtitle}>
            {isSaveBucket
              ? `$${remaining.toFixed(2)} saved of $${totalFunded.toFixed(2)}`
              : `$${remaining.toFixed(2)} of $${totalFunded.toFixed(2)}`
            }
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressSection, {backgroundColor: bucket.color + '15'}]}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(percentUsed, 100)}%`,
                backgroundColor: bucket.color,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {isSaveBucket
            ? `${Math.round(percentUsed)}% saved`
            : `${Math.round(100 - percentUsed)}% remaining`
          }
        </Text>
      </View>

      {/* Savings Info for save buckets */}
      {isSaveBucket && (
        <View style={styles.fundingBreakdown}>
          <Text style={styles.fundingTitle}>Savings Progress</Text>
          <View style={styles.fundingRow}>
            <Text style={styles.fundingLabel}>Current balance</Text>
            <Text style={styles.fundingValue}>${(bucket.currentBalance || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.fundingRow}>
            <Text style={styles.fundingLabel}>Target amount</Text>
            <Text style={styles.fundingValue}>${(bucket.targetAmount || 0).toFixed(2)}</Text>
          </View>
          {bucket.contributionType !== 'none' && (
            <View style={styles.fundingRow}>
              <Text style={styles.fundingLabel}>Monthly contribution</Text>
              <Text style={styles.fundingValue}>
                {bucket.contributionType === 'amount'
                  ? `$${(bucket.contributionAmount || 0).toFixed(2)}`
                  : `${(bucket.contributionPercent || 0)}% of income`
                }
              </Text>
            </View>
          )}
          <View style={[styles.fundingRow, styles.fundingRowTotal]}>
            <Text style={styles.fundingLabelBold}>Still needed</Text>
            <Text style={styles.fundingValueBold}>
              ${Math.max(0, (bucket.targetAmount || 0) - (bucket.currentBalance || 0)).toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Funding Breakdown - show if there's a carryover */}
      {bucket.bucketMode === 'spend' && (carryover !== 0 || funded > 0) && (
        <View style={styles.fundingBreakdown}>
          <Text style={styles.fundingTitle}>Funding Breakdown</Text>
          <View style={styles.fundingRow}>
            <Text style={styles.fundingLabel}>This month</Text>
            <Text style={styles.fundingValue}>${funded.toFixed(2)}</Text>
          </View>
          {carryover !== 0 && (
            <View style={styles.fundingRow}>
              <Text style={styles.fundingLabel}>
                {carryover > 0 ? 'Carried forward' : 'Debt from last month'}
              </Text>
              <Text style={[
                styles.fundingValue,
                carryover < 0 && styles.fundingValueNegative
              ]}>
                {carryover > 0 ? '+' : ''}${carryover.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={[styles.fundingRow, styles.fundingRowTotal]}>
            <Text style={styles.fundingLabelBold}>Total available</Text>
            <Text style={styles.fundingValueBold}>${totalFunded.toFixed(2)}</Text>
          </View>
          <View style={styles.fundingRow}>
            <Text style={styles.fundingLabel}>Spent</Text>
            <Text style={styles.fundingValue}>-${spent.toFixed(2)}</Text>
          </View>
          <View style={[styles.fundingRow, styles.fundingRowTotal]}>
            <Text style={styles.fundingLabelBold}>Remaining</Text>
            <Text style={[
              styles.fundingValueBold,
              remaining < 0 && styles.fundingValueNegative
            ]}>
              ${remaining.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Expenses List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Recent Expenses ({expensesList.length})
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading expenses...</Text>
            </View>
          ) : expensesList.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>📭</Text>
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add an expense to start tracking!
              </Text>
            </View>
          ) : (
            expensesList.map(expense => (
              <SwipeableExpense
                key={expense._id}
                expense={expense}
                onPress={() => handleEditExpense(expense)}
                onDelete={() => handleDeleteExpense(expense._id, expense.note)}
                formatDate={formatDate}
                happinessEmojis={happinessEmojis}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: bucket.color}]}
          onPress={handleEditBucket}>
          <Text style={styles.actionButtonText}>Edit Bucket</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: '#4747FF',
    fontWeight: '400',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 2,
  },
  progressSection: {
    padding: 20,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 15,
    color: '#8E8E93',
  },
  expenseCard: {
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  expenseMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseLeft: {
    flex: 1,
  },
  expenseNote: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 15,
    color: '#8E8E93',
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Merchant Copy, monospace',
    color: '#FF3B30',
    marginBottom: 4,
  },
  expenseHappiness: {
    fontSize: 20,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  fundingBreakdown: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  fundingTitle: {
    fontSize: 15,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fundingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  fundingRowTotal: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  fundingLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  fundingLabelBold: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  fundingValue: {
    fontSize: 15,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
  },
  fundingValueBold: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.primary,
  },
  fundingValueNegative: {
    color: theme.colors.danger,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant, monospace',
  },
});
