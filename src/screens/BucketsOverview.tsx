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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DollarSign, Plus, Droplets } from 'lucide-react-native';
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
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get current user and buckets from Convex
  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
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

  const filteredBuckets =
    activeTab === 'all'
      ? allBuckets
      : allBuckets.filter(bucket => {
          // Calculate percent used - handle rollovers correctly
          const spent = Math.max(
            0,
            bucket.allocationValue - bucket.currentBalance,
          );
          const percentUsed =
            bucket.allocationValue > 0
              ? (spent / bucket.allocationValue) * 100
              : 0;
          return percentUsed >= bucket.alertThreshold;
        });

  const lowBalanceCount = allBuckets.filter(bucket => {
    // Calculate percent used - handle rollovers correctly
    const spent = Math.max(0, bucket.allocationValue - bucket.currentBalance);
    const percentUsed =
      bucket.allocationValue > 0 ? (spent / bucket.allocationValue) * 100 : 0;
    return percentUsed >= bucket.alertThreshold;
  }).length;

  const totalBalance = allBuckets.reduce(
    (sum, bucket) => sum + bucket.currentBalance,
    0,
  );

  const handleBucketPress = (bucket: Bucket) => {
    if (navigation && navigation.navigate) {
      navigation.navigate('BucketDetail', { bucket });
    } else {
      // Web version - show alert for now
      alert(
        `Bucket Detail for ${
          bucket.name
        }\nBalance: $${bucket.currentBalance.toFixed(
          2,
        )}\n\n(Full navigation coming soon for web!)`,
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
  tabsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  tabText: {
    fontSize: 17,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontFamily: getFontFamily('bold'),
  },
  tabCount: {
    fontSize: 17,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
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
    fontFamily: getFontFamily('regular'),
  },
});
