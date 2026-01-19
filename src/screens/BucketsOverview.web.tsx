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
} from 'react-native';
import { Calendar, Droplets, Check } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BucketCard } from '../components/BucketCard';
import { AddBucket } from './AddBucket';
import { BucketDetail } from './BucketDetail.web';
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
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);

  // Get current user and buckets from Convex
  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);

  // Get buckets for current user
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  // Get distribution status
  const distributionStatus = useQuery(
    api.distribution.getDistributionStatus,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  // Get monthly total spent (source of truth: transactions)
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getTime();
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  const monthlySpending = useQuery(
    api.analytics.getMonthlyTotalSpent,
    currentUser ? {
      userId: currentUser._id,
      monthStart,
      monthEnd,
    } : 'skip',
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

  const filteredBuckets =
    activeTab === 'all'
      ? allBuckets
      : allBuckets.filter((bucket: Bucket) => {
          // Calculate percent used - handle rollovers correctly
          const spent = Math.max(0, bucket.allocationValue - bucket.currentBalance);
          const percentUsed = bucket.allocationValue > 0
            ? (spent / bucket.allocationValue) * 100
            : 0;
          return percentUsed >= bucket.alertThreshold;
        });

  const lowBalanceCount = allBuckets.filter((bucket: Bucket) => {
    // Calculate percent used - handle rollovers correctly
    const spent = Math.max(0, bucket.allocationValue - bucket.currentBalance);
    const percentUsed = bucket.allocationValue > 0
      ? (spent / bucket.allocationValue) * 100
      : 0;
    return percentUsed >= bucket.alertThreshold;
  }).length;

  const totalBalance = allBuckets.reduce(
    (sum: number, bucket: Bucket) => sum + bucket.currentBalance,
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

  // Show bucket detail if a bucket is selected
  if (selectedBucket) {
    return (
      <BucketDetail
        bucket={selectedBucket}
        onBack={() => setSelectedBucket(null)}
        onEditBucket={onEditBucket}
        onEditExpense={onEditExpense}
      />
    );
  }

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
        <View style={styles.statsCard}>
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
        </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    overflow: 'hidden' as any,
    height: '100vh' as any,
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
    fontSize: 40,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'Merchant Copy, monospace',
    letterSpacing: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 0,
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
    paddingBottom: 120,
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
});
