import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Calendar, Droplets, Check, Search } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BucketCard } from '../components/BucketCard';
import { AddBucket } from './AddBucket';
import { BucketDetail } from './BucketDetail';
import type { Bucket, Expense } from '../types';
import { format } from 'date-fns';
import { theme } from '../theme';

type FilterTab = 'all' | 'low';

interface BucketsOverviewProps {
  onEditBucket?: (bucket: Bucket) => void;
  onEditExpense?: (expense: Expense, bucket: Bucket) => void;
}

// Generate 12 months for the current year
const generateMonths = () => {
  const months = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentYear, i, 1);
    months.push(date);
  }
  return months;
};

export const BucketsOverview: React.FC<BucketsOverviewProps> = ({
  onEditBucket,
  onEditExpense,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [showMonthlyTransactions, setShowMonthlyTransactions] = useState(false);

  // Current real month boundaries — used for bucket spending (must match carryover cycle).
  // carryoverBalance already accounts for previous months, so spentAmount must only
  // count this month's expenses to avoid double-counting historical spending.
  const _now = new Date();
  const currentMonthStart = new Date(_now.getFullYear(), _now.getMonth(), 1).getTime();
  const currentMonthEnd = new Date(_now.getFullYear(), _now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  // Get current user and buckets from Convex
  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);

  // Get buckets for current user — filtered to current month so spentAmount
  // only counts this month's expenses (carryoverBalance handles the rest).
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser
      ? { userId: currentUser._id, monthStart: currentMonthStart, monthEnd: currentMonthEnd }
      : 'skip',
  );

  // Get distribution status
  const distributionStatus = useQuery(
    api.distribution.getDistributionStatus,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  // Selected-month boundaries — used for the analytics total-spent header only
  const monthStart = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1,
  ).getTime();
  const monthEnd = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  ).getTime();

  const monthlySpending = useQuery(
    api.analytics.getMonthlyTotalSpent,
    currentUser
      ? {
          userId: currentUser._id,
          monthStart,
          monthEnd,
        }
      : 'skip',
  );

  // Get all expenses for the user to show in monthly view
  const allExpenses = useQuery(
    api.expenses.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  // Initialize demo user if needed (when query completes and returns null)
  useEffect(() => {
    // Only initialize if query has completed (not undefined) and returned null
    if (currentUser === null) {
      console.log('No user found, initializing demo user...');
      initDemoUser()
        .then(() => {
          console.log('Demo user initialized successfully');
        })
        .catch(err => {
          console.error('Error initializing demo user:', err);
        });
    }
  }, [currentUser, initDemoUser]);

  const months = generateMonths();

  // Use real buckets data, or empty array while loading
  const allBuckets = buckets || [];

  const tabFilteredBuckets =
    activeTab === 'all'
      ? allBuckets
      : allBuckets.filter((bucket: Bucket) => {
          const isSpendBucket = bucket.bucketMode === 'spend' || !bucket.bucketMode;
          let percentUsed = 0;

          if (isSpendBucket) {
            // For spend buckets: calculate based on new rollover system
            const spent = bucket.spentAmount || 0;
            const funded = bucket.fundedAmount || 0;
            const carryover = bucket.carryoverBalance || 0;
            const total = funded + carryover;
            percentUsed = total > 0 ? (spent / total) * 100 : 0;
          } else {
            // For save buckets: calculate progress toward goal
            const current = bucket.currentBalance || 0;
            const target = bucket.targetAmount || 0;
            percentUsed = target > 0 ? (current / target) * 100 : 0;
          }

          // Only show as low balance if it exceeds threshold
          return percentUsed >= (bucket.alertThreshold || 75);
        });

  const filteredBuckets = searchQuery.trim()
    ? tabFilteredBuckets.filter((b: Bucket) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabFilteredBuckets;

  const lowBalanceCount = allBuckets.filter((bucket: Bucket) => {
    const isSpendBucket = bucket.bucketMode === 'spend' || !bucket.bucketMode;
    let percentUsed = 0;

    if (isSpendBucket) {
      // For spend buckets: calculate based on new rollover system
      const spent = bucket.spentAmount || 0;
      const funded = bucket.fundedAmount || 0;
      const carryover = bucket.carryoverBalance || 0;
      const total = funded + carryover;
      percentUsed = total > 0 ? (spent / total) * 100 : 0;
    } else {
      // For save buckets: calculate progress toward goal
      const current = bucket.currentBalance || 0;
      const target = bucket.targetAmount || 0;
      percentUsed = target > 0 ? (current / target) * 100 : 0;
    }

    // Only count as low balance if it exceeds threshold
    return percentUsed >= (bucket.alertThreshold || 75);
  }).length;

  const totalBalance = allBuckets.reduce(
    (sum: number, bucket: Bucket) => sum + (bucket.currentBalance || 0),
    0,
  );

  // IMPORTANT: Monthly Total Spent is derived from transactions, not bucket balances
  // Source of truth: analytics.getMonthlyTotalSpent query
  const totalSpent = monthlySpending?.totalSpent || 0;

  const handleBucketPress = (bucket: Bucket) => {
    setSelectedBucket(bucket);
  };

  const handleSaveBucket = (bucketData: any) => {
    console.log('New bucket:', bucketData);
    setShowAddBucket(false);
  };

  // Show loading state while fetching data
  if (currentUser === undefined || buckets === undefined) {
    return (
      <View style={styles.loadingWrapper}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your buckets...</Text>
        </View>
      </View>
    );
  }

  // Show bucket detail modal if a bucket is selected
  const bucketDetailModal = selectedBucket && (
    <BucketDetail
      visible={!!selectedBucket}
      bucket={selectedBucket}
      onBack={() => setSelectedBucket(null)}
      onEditBucket={onEditBucket}
      onEditExpense={onEditExpense}
      onAddExpense={(bucket) => {
        // For web, we'll just call onEditExpense with a new empty expense
        // This will work if the parent handles creating new expenses
        if (onEditExpense) {
          // Create a temporary expense object for adding new
          const newExpense = {
            _id: 'new' as any,
            _creationTime: Date.now(),
            userId: bucket.userId,
            bucketId: bucket._id,
            amount: 0,
            note: '',
            createdAt: Date.now(),
            date: Date.now(),
            happinessRating: 3,
          } as Expense;
          onEditExpense(newExpense, bucket);
        }
      }}
    />
  );

  // Monthly transactions modal
  const monthlyTransactionsModal = showMonthlyTransactions && allExpenses && (() => {
    // Filter expenses for selected month
    const monthlyExpenses = allExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return (
        expenseDate.getMonth() === selectedMonth.getMonth() &&
        expenseDate.getFullYear() === selectedMonth.getFullYear()
      );
    });

    // Sort by date descending (newest first)
    monthlyExpenses.sort((a, b) => b.date - a.date);

    // Create a map of bucket IDs to bucket objects for display
    const bucketMap = new Map(allBuckets.map(b => [b._id, b]));

    return (
      <Modal
        visible={showMonthlyTransactions}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowMonthlyTransactions(false)}
      >
        <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={styles.monthlyHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowMonthlyTransactions(false)}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthlyHeaderTitle}>
            {format(selectedMonth, 'MMMM yyyy')}
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Total Spent Card */}
        <View style={styles.monthlyTotalCard}>
          <Text style={styles.monthlyTotalLabel}>TOTAL SPENT</Text>
          <Text style={styles.monthlyTotalAmount}>${totalSpent.toFixed(2)}</Text>
          <Text style={styles.monthlyTotalCount}>
            {monthlyExpenses.length} transaction{monthlyExpenses.length === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Transactions List */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {monthlyExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Start spending from your buckets
              </Text>
            </View>
          ) : (
            <View style={styles.monthlyTransactionsList}>
              {monthlyExpenses.map(expense => {
                const bucket = bucketMap.get(expense.bucketId);
                return (
                  <TouchableOpacity
                    key={expense._id}
                    style={styles.monthlyTransactionItem}
                    onPress={() => {
                      if (onEditExpense && bucket) {
                        onEditExpense(expense, bucket);
                      }
                    }}
                  >
                    <View style={styles.monthlyTransactionLeft}>
                      <View style={styles.monthlyTransactionHeader}>
                        <Text style={styles.monthlyTransactionNote}>
                          {expense.note || 'Expense'}
                        </Text>
                        {bucket && (
                          <View style={[styles.bucketPillSmall, { backgroundColor: bucket.color }]}>
                            <Text style={styles.bucketPillText}>{bucket.name}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.monthlyTransactionDate}>
                        {format(new Date(expense.date), 'MMM d, yyyy')}
                      </Text>
                    </View>
                    <Text style={styles.monthlyTransactionAmount}>
                      ${expense.amount.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
      </Modal>
    );
  })();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header with title and calendar */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Buckets</Text>
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => setShowMonthPicker(true)}
          >
            <Calendar size={20} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Month and total spent in card */}
        <TouchableOpacity
          style={styles.statsCard}
          onPress={() => setShowMonthlyTransactions(true)}
        >
          <View style={styles.statsCardHeader}>
            <Text style={styles.monthText}>
              {format(selectedMonth, 'MMMM yyyy')}
            </Text>
          </View>
          <View style={styles.statsCardBody}>
            <Text style={styles.totalSpentLabel}>Total spent</Text>
            <Text style={styles.totalSpentAmount}>
              ${totalSpent.toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Distribution Status Banner */}
        {distributionStatus && distributionStatus.isOverPlanned && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ Over-planned by ${distributionStatus.overPlannedBy.toFixed(2)}
            </Text>
            <Text style={styles.warningSubtext}>
              Your buckets won't be fully funded this month
            </Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search size={16} color="#877E6F" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search buckets..."
              placeholderTextColor="#B5AFA5"
            />
          </View>
        </View>

        {/* Simple tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'all' && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab('all')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'all' && styles.tabTextActive,
              ]}
            >
              All buckets{' '}
              <Text style={styles.tabCount}>{allBuckets.length}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'low' && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab('low')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'low' && styles.tabTextActive,
              ]}
            >
              Low balance{' '}
              {lowBalanceCount > 0 && (
                <Text style={styles.tabCount}>{lowBalanceCount}</Text>
              )}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Buckets List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info message if no buckets are funded */}
        {allBuckets.length > 0 &&
         allBuckets.every((b: Bucket) => {
           if (b.bucketMode === 'spend') {
             const funded = b.fundedAmount || 0;
             const spent = b.spentAmount || 0;
             return (funded - spent) === 0;
           }
           return (b.currentBalance || 0) === 0;
         }) && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Get started by adding income!
              {'\n\n'}Go to Settings → Set Income and add your recurring monthly income to automatically fund your buckets.
            </Text>
          </View>
        )}

        {filteredBuckets.map((bucket: Bucket) => (
          <BucketCard
            key={bucket._id}
            bucket={bucket}
            onPress={() => handleBucketPress(bucket)}
          />
        ))}

        {filteredBuckets.length === 0 && (
          <View style={styles.emptyState}>
            <Droplets
              size={64}
              color={theme.colors.primary}
              strokeWidth={1.5}
            />
            <Text style={styles.emptyStateText}>No buckets running low</Text>
            <Text style={styles.emptyStateSubtext}>
              You're doing great with your budget!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Bucket Modal */}
      <AddBucket
        visible={showAddBucket}
        onClose={() => setShowAddBucket(false)}
        onSave={handleSaveBucket}
      />

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={styles.monthPickerContainer}>
            <View style={styles.monthPickerHeader}>
              <Text style={styles.monthPickerTitle}>
                {selectedMonth.getFullYear()}
              </Text>
            </View>
            <View style={styles.monthGrid}>
              {months.map((month, index) => {
                const isSelected =
                  month.getMonth() === selectedMonth.getMonth() &&
                  month.getFullYear() === selectedMonth.getFullYear();
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.monthGridItem,
                      isSelected && styles.monthGridItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedMonth(month);
                      setShowMonthPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthGridItemText,
                        isSelected && styles.monthGridItemTextSelected,
                      ]}
                    >
                      {format(month, 'MMM')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Monthly Transactions Modal */}
      {monthlyTransactionsModal}

      {/* Bucket Detail Modal */}
      {bucketDetailModal}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    maxHeight: '100vh' as any,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: theme.colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant, monospace',
    letterSpacing: -1.2,
  },
  calendarButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  statsCardHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsCardBody: {
    alignItems: 'flex-start',
  },
  monthText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Merchant Copy, monospace',
  },
  totalSpentLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    fontFamily: 'Merchant, monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalSpentAmount: {
    fontSize: 28,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'Merchant Copy, monospace',
    letterSpacing: 0,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F7F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    fontFamily: 'Merchant Copy, monospace',
    outlineStyle: 'none' as any,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
  },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: theme.colors.purple100,
  },
  tabText: {
    fontSize: 15,
    fontFamily: 'Merchant, monospace',
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  tabCount: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: 'Merchant Copy, monospace',
  },
  warningBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE5A3',
  },
  warningText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#856404',
    fontFamily: 'Merchant, monospace',
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 13,
    color: '#856404',
    fontFamily: 'Merchant Copy, monospace',
  },
  scrollView: {
    flex: 1,
    overflow: 'auto' as any,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 150,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  infoText: {
    fontSize: 15,
    color: '#1565C0',
    fontFamily: 'Merchant Copy, monospace',
    lineHeight: 22,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 6,
    fontFamily: 'Merchant, monospace',
    letterSpacing: -0.3,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant, monospace',
    textAlign: 'center',
  },
  // Month Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
  },
  monthPickerHeader: {
    padding: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  monthPickerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant, monospace',
    letterSpacing: -0.3,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingBottom: 20,
  },
  monthGridItem: {
    width: '33.333%',
    aspectRatio: 2,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  monthGridItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  monthGridItemText: {
    fontSize: 18,
    fontWeight: '400',
    color: theme.colors.gray700,
    fontFamily: 'Merchant, monospace',
  },
  monthGridItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  loadingWrapper: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw' as any,
    height: '100vh' as any,
    backgroundColor: theme.colors.background,
    display: 'flex' as any,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingContainer: {
    display: 'flex' as any,
    flexDirection: 'column' as any,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant, monospace',
  },
  // Monthly Transactions View
  monthlyHeader: {
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
  monthlyHeaderTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant, monospace',
  },
  placeholder: {
    width: 40,
  },
  monthlyTotalCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 20,
    alignItems: 'center',
  },
  monthlyTotalLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Merchant, monospace',
  },
  monthlyTotalAmount: {
    fontSize: 36,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'Merchant Copy, monospace',
    letterSpacing: 0,
    marginBottom: 8,
  },
  monthlyTotalCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Merchant, monospace',
  },
  monthlyTransactionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  monthlyTransactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  monthlyTransactionLeft: {
    flex: 1,
    marginRight: 12,
  },
  monthlyTransactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  monthlyTransactionNote: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant, monospace',
  },
  bucketPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bucketPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Merchant, monospace',
  },
  monthlyTransactionDate: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'Merchant, monospace',
  },
  monthlyTransactionAmount: {
    fontSize: 20,
    fontWeight: '500',
    color: '#0A0A0A',
    fontFamily: 'Merchant Copy, monospace',
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
