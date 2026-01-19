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
import {useRoute, useNavigation} from '@react-navigation/native';
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

export const BucketDetail: React.FC = () => {
  const route = useRoute<BucketDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const {bucket} = route.params;
  const [refreshing, setRefreshing] = useState(false);

  // Get expenses for this bucket from Convex
  const expenses = useQuery(api.expenses.getByBucket, { bucketId: bucket._id });
  const deleteExpense = useMutation(api.expenses.remove);

  // IMPORTANT: Use spentAmount from backend (derived from transactions)
  // This ensures deletes/edits automatically update the value
  const spent = bucket.spentAmount || 0;
  const totalFunded = bucket.fundedAmount || bucket.allocationValue || 0;
  const remaining = Math.max(0, totalFunded - spent);
  const percentUsed = totalFunded > 0
    ? Math.min(100, (spent / totalFunded) * 100)
    : 0;

  const happinessEmojis = ['😢', '😕', '😐', '🙂', '😄'];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleEditExpense = (expense: Expense) => {
    navigation.navigate('EditExpense', {expense, bucket});
  };

  const handleEditBucket = () => {
    navigation.navigate('EditBucket', {bucket});
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
              await deleteExpense({ expenseId });
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{bucket.name}</Text>
          <Text style={styles.subtitle}>
            ${remaining.toFixed(2)} of $
            {totalFunded.toFixed(2)}
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
          {Math.round(100 - percentUsed)}% remaining
        </Text>
      </View>

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
    fontSize: 20,
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
    fontSize: 20,
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
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
  },
});
