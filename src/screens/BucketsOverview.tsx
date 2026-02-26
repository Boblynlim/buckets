import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DollarSign, Plus, Droplets, Search } from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BucketCard } from '../components/BucketCard';
import { AddBucket } from './AddBucket';
import type { Bucket } from '../types';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';

type FilterTab = 'all' | 'low';

type BucketsStackParamList = {
  BucketsOverview: undefined;
  BucketDetail: { bucket: Bucket };
};

type NavigationProp = NativeStackNavigationProp<BucketsStackParamList>;

export const BucketsOverview: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get current user and buckets from Convex
  // Current month boundaries for expense filtering — carryoverBalance already
  // accounts for previous months, so spentAmount must only include this month.
  const _now = new Date();
  const currentMonthStart = new Date(_now.getFullYear(), _now.getMonth(), 1).getTime();
  const currentMonthEnd = new Date(_now.getFullYear(), _now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser
      ? { userId: currentUser._id, monthStart: currentMonthStart, monthEnd: currentMonthEnd }
      : 'skip',
  );

  // Initialize demo user if needed
  React.useEffect(() => {
    if (currentUser === null) {
      console.log('No user found, initializing demo user...');
      initDemoUser().catch(err => {
        console.error('Error initializing demo user:', err);
      });
    }
  }, [currentUser, initDemoUser]);

  const onRefresh = async () => {
    setRefreshing(true);
    // useQuery will automatically refetch
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Use real buckets data
  const allBuckets = buckets || [];

  // Show loading state
  if (currentUser === undefined || buckets === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading buckets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabFilteredBuckets =
    activeTab === 'all'
      ? allBuckets
      : allBuckets.filter(bucket => {
          // Calculate percent used - handle rollovers correctly
          const spent = Math.max(
            0,
            (bucket.allocationValue || 0) - (bucket.currentBalance || 0),
          );
          const percentUsed =
            (bucket.allocationValue || 0) > 0
              ? (spent / (bucket.allocationValue || 0)) * 100
              : 0;
          // Only show as low balance if there's actual spending AND it exceeds threshold
          return percentUsed > 0 && percentUsed >= (bucket.alertThreshold || 75);
        });

  const filteredBuckets = searchQuery.trim()
    ? tabFilteredBuckets.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabFilteredBuckets;

  const lowBalanceCount = allBuckets.filter(bucket => {
    // Calculate percent used - handle rollovers correctly
    const spent = Math.max(
      0,
      (bucket.allocationValue || 0) - (bucket.currentBalance || 0),
    );
    const percentUsed =
      (bucket.allocationValue || 0) > 0
        ? (spent / (bucket.allocationValue || 0)) * 100
        : 0;
    // Only count as low balance if there's actual spending AND it exceeds threshold
    return percentUsed > 0 && percentUsed >= (bucket.alertThreshold || 75);
  }).length;

  const totalBalance = allBuckets.reduce(
    (sum, bucket) => sum + (bucket.currentBalance || 0),
    0,
  );

  const handleBucketPress = (bucket: Bucket) => {
    if (navigation && navigation.navigate) {
      navigation.navigate('BucketDetail', { bucket });
    } else {
      // Web version - show alert for now
      alert(
        `Bucket Detail for ${bucket.name}\nBalance: $${(
          bucket.currentBalance || 0
        ).toFixed(2)}\n\n(Full navigation coming soon for web!)`,
      );
    }
  };

  const handleSaveBucket = () => {
    // AddBucket component handles the save via Convex mutation
    // Just close the modal here
    setShowAddBucket(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Large title header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Buckets</Text>
          <View style={styles.headerSpacer} />
        </View>

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
          <TouchableOpacity onPress={() => setActiveTab('all')}>
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

          <TouchableOpacity onPress={() => setActiveTab('low')}>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {filteredBuckets.map(bucket => (
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

      {/* Action Buttons - Two circular floating buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowAddBucket(true)}
        >
          <Plus size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Add Bucket Modal */}
      <AddBucket
        visible={showAddBucket}
        onClose={() => setShowAddBucket(false)}
        onSave={handleSaveBucket}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    marginBottom: 20,
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 48,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
    letterSpacing: -1.2,
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
    fontFamily: getFontFamily('regular'),
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 24,
    paddingBottom: 16,
  },
  tabText: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontFamily: getFontFamily('bold'),
  },
  tabCount: {
    fontSize: 12,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 150,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    fontSize: 20,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    textAlign: 'center',
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    flexDirection: 'column',
    gap: 12,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none' as any,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
});
