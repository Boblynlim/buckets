import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { BucketDetail } from './BucketDetail';
import type { Bucket, Expense } from '../types';
import { format } from 'date-fns';
import { theme } from '../theme';

import { getCupForBucketId, registerCupAssignments } from '../constants/bucketIcons';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PotteryLoader } from '../components/PotteryLoader';
import { computeBucketHealth, getBucketsNeedingAttention, healthColors, type BucketHealth, dismissInsight, isInsightDismissed } from '../utils/bucketHealth';

interface BucketsOverviewProps {
  onEditBucket?: (bucket: Bucket, suggestedAmount?: number) => void;
  onEditExpense?: (expense: Expense, bucket: Bucket) => void;
}

// Generate 12 months for the current year
const generateMonths = () => {
  const months = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let i = 0; i < 12; i++) {
    months.push(new Date(currentYear, i, 1));
  }
  return months;
};

// Helper: get available balance for a bucket
const getAvailableBalance = (bucket: Bucket): number => {
  if (bucket.bucketMode === 'save') {
    return bucket.currentBalance || 0;
  }
  const funded = bucket.fundedAmount || 0;
  const carryover = bucket.carryoverBalance || 0;
  const spent = bucket.spentAmount || 0;
  return funded + carryover - spent;
};

// Helper: get total allocation for a bucket
const getAllocation = (bucket: Bucket): number => {
  if (bucket.bucketMode === 'save') {
    return bucket.targetAmount || 0;
  }
  return (bucket.fundedAmount || 0) + (bucket.carryoverBalance || 0);
};

// Helper: get rollover amount (carryover that exceeds funded amount)
const getRolloverBadge = (bucket: Bucket): number | null => {
  if (bucket.bucketMode === 'save') return null;
  const carryover = bucket.carryoverBalance || 0;
  return carryover > 0 ? carryover : null;
};

// Helper: get opacity based on remaining balance (1.0 = full, 0.3 = empty)
// Only applies to spend/budget buckets — bills (recurring) and savings always full opacity
const getCupOpacity = (bucket: Bucket): number => {
  if (bucket.bucketMode === 'recurring' || bucket.bucketMode === 'save') return 1.0;
  const available = getAvailableBalance(bucket);
  const allocation = getAllocation(bucket);
  if (allocation <= 0) return 0.5;
  const ratio = Math.max(0, Math.min(1, available / allocation));
  return 0.45 + ratio * 0.55; // Range: 0.45 to 1.0
};

// Cup component for a single bucket — with wobble on tap + staggered entrance
const CupItem: React.FC<{
  bucket: Bucket;
  onPress: () => void;
  index?: number;
  health?: BucketHealth;
}> = ({ bucket, onPress, index = 0, health }) => {
  const available = getAvailableBalance(bucket);
  const allocation = getAllocation(bucket);
  const rollover = getRolloverBadge(bucket);
  const opacity = getCupOpacity(bucket);

  return (
    <motion.div
      style={{
        width: '33.333%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 4,
        paddingRight: 4,
        cursor: 'pointer',
      }}
      // Staggered entrance — rise up from shelf
      initial={{ opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.06,
        duration: 0.45,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      // Wobble on tap — like tapping a real ceramic cup
      whileTap={{
        rotate: [0, -3, 3, -1.5, 0],
        scale: 0.95,
        transition: { duration: 0.4, ease: 'easeInOut' },
      }}
      whileHover={{
        y: -3,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      onClick={onPress}
    >
      <View style={cupStyles.imageWrapper}>
        <Image
          source={getCupForBucketId(bucket._id, bucket.icon)}
          style={[cupStyles.image, { opacity }]}
          resizeMode="contain"
        />
        {rollover && (
          <View style={cupStyles.rolloverBadge}>
            <Text style={cupStyles.rolloverText}>+${rollover.toFixed(0)}</Text>
          </View>
        )}
        {health && health.status !== 'healthy' && (
          <View style={[cupStyles.healthDot, { backgroundColor: healthColors[health.status] }]} />
        )}
      </View>
      <Text style={cupStyles.name} numberOfLines={1}>
        {bucket.name}
      </Text>
      <Text style={cupStyles.balance}>
        ${available.toFixed(0)} left of ${allocation.toFixed(0)}
      </Text>
    </motion.div>
  );
};

const cupStyles = StyleSheet.create({
  container: {
    width: '33.333%' as any,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  imageWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  image: {
    width: 72,
    height: 72,
  },
  rolloverBadge: {
    position: 'absolute',
    top: 1,
    right: -8,
    backgroundColor: '#5C4438',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 14,
    transform: [{ rotate: '12deg' }],
    zIndex: 2,
  },
  rolloverText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Merchant Copy',
  },
  healthDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#EAE3D5',
    zIndex: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant',
    textAlign: 'center',
    marginBottom: 3,
  },
  balance: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy',
    textAlign: 'center',
  },
});

// Shelf component — wooden shelf with cups sitting on it
const ShelfGroup: React.FC<{
  groupName: string;
  buckets: Bucket[];
  onBucketPress: (bucket: Bucket) => void;
  startIndex?: number;
  healthMap?: Map<string, BucketHealth>;
}> = ({ groupName, buckets, onBucketPress, startIndex = 0, healthMap }) => {
  const sorted = [...buckets].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ marginBottom: 6, position: 'relative' }}>
      {/* Group label */}
      <div style={{
        fontFamily: 'Merchant',
        fontSize: 14,
        color: '#8B7E6E',
        fontStyle: 'italic',
        marginLeft: 14,
        marginTop: 14,
        marginBottom: 8,
        letterSpacing: 0.3,
      }}>
        {groupName}
      </div>

      {/* Cups row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        position: 'relative',
        paddingBottom: 0,
        zIndex: 2,
      }}>
        {sorted.map((bucket, i) => (
          <CupItem
            key={bucket._id}
            bucket={bucket}
            onPress={() => onBucketPress(bucket)}
            index={startIndex + i}
            health={healthMap?.get(bucket._id)}
          />
        ))}
      </div>

      {/* Wooden shelf plank */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: -2 }}>
        {/* Main plank — warm teak/amber tone */}
        <div style={{
          height: 8,
          background: 'linear-gradient(180deg, #C4906A 0%, #B07D58 40%, #A57250 70%, #96684A 100%)',
          borderRadius: 2,
          marginLeft: 4,
          marginRight: 4,
          boxShadow: '0 2px 4px rgba(120, 70, 30, 0.2), inset 0 1px 0 rgba(220, 180, 140, 0.35)',
        }} />
        {/* Shelf edge / lip */}
        <div style={{
          height: 3,
          background: 'linear-gradient(180deg, #96684A 0%, #845C42 100%)',
          borderRadius: '0 0 2px 2px',
          marginLeft: 4,
          marginRight: 4,
          boxShadow: '0 3px 6px rgba(100, 55, 20, 0.18)',
        }} />
        {/* Wood grain texture overlay */}
        <svg width="100%" height="11" viewBox="0 0 400 11" preserveAspectRatio="none" style={{
          position: 'absolute',
          top: 0,
          left: 4,
          right: 4,
          width: 'calc(100% - 8px)',
          pointerEvents: 'none',
          opacity: 0.15,
        }}>
          <defs>
            <filter id="woodGrain">
              <feTurbulence type="fractalNoise" baseFrequency="0.04 0.3" numOctaves="4" seed="3" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="400" height="11" filter="url(#woodGrain)" />
        </svg>
      </div>
    </div>
  );
};

export const BucketsOverview: React.FC<BucketsOverviewProps> = ({
  onEditBucket,
  onEditExpense,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [showMonthlyTransactions, setShowMonthlyTransactions] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [confirmAdjust, setConfirmAdjust] = useState<string | null>(null); // bucket._id being confirmed
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  const updateBucket = useMutation(api.buckets.update);

  // Current month boundaries
  const _now = new Date();
  const currentMonthStart = new Date(
    _now.getFullYear(),
    _now.getMonth(),
    1,
  ).getTime();
  const currentMonthEnd = new Date(
    _now.getFullYear(),
    _now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  ).getTime();

  const { user: currentUser } = useAuth();

  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser
      ? {
          userId: currentUser._id,
          monthStart: currentMonthStart,
          monthEnd: currentMonthEnd,
        }
      : 'skip',
  );

  const groups = useQuery(
    api.groups.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  const distributionStatus = useQuery(
    api.distribution.getDistributionStatus,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  // Selected month analytics
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
    currentUser ? { userId: currentUser._id, monthStart, monthEnd } : 'skip',
  );

  const allExpenses = useQuery(
    api.expenses.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  const months = generateMonths();
  const allBuckets = buckets || [];
  const allGroups = groups || [];

  // Register cup assignments so all 15 designs are used before repeating
  const bucketIds = React.useMemo(() => allBuckets.map((b: Bucket) => b._id), [allBuckets]);
  registerCupAssignments(bucketIds);
  const totalSpent = monthlySpending?.totalSpent || 0;

  // Bucket health computation
  const expensesList = (allExpenses || []) as Expense[];
  const healthMap = React.useMemo(() => {
    const map = new Map<string, BucketHealth>();
    for (const b of allBuckets) {
      map.set(b._id, computeBucketHealth(b, expensesList));
    }
    return map;
  }, [allBuckets, expensesList]);

  const attentionItemsAll = React.useMemo(
    () => getBucketsNeedingAttention(allBuckets, expensesList),
    [allBuckets, expensesList],
  );

  const attentionItems = React.useMemo(
    () => attentionItemsAll.filter(({ bucket, health }) =>
      !isInsightDismissed(bucket._id, health) && !dismissedInsights.has(`${bucket._id}:${health.status}:${health.reason}`)
    ),
    [attentionItemsAll, dismissedInsights],
  );

  // Filter by search
  const filteredBuckets = searchQuery.trim()
    ? allBuckets.filter((b: Bucket) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allBuckets;

  // Organize into groups and ungrouped
  const groupMap = new Map<string, { name: string; buckets: Bucket[] }>();
  const ungroupedBuckets: Bucket[] = [];

  for (const group of allGroups) {
    groupMap.set(group._id, { name: group.name, buckets: [] });
  }

  for (const bucket of filteredBuckets) {
    if (bucket.groupId && groupMap.has(bucket.groupId)) {
      groupMap.get(bucket.groupId)!.buckets.push(bucket);
    } else {
      ungroupedBuckets.push(bucket);
    }
  }

  // Sort: groups alphabetically, ungrouped buckets alphabetically
  const sortedGroups = [...groupMap.entries()]
    .filter(([_, g]) => g.buckets.length > 0)
    .sort(([_, a], [__, b]) => a.name.localeCompare(b.name));
  const sortedUngrouped = [...ungroupedBuckets].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const handleBucketPress = (bucket: Bucket) => setSelectedBucket(bucket);

  // Refs for swipe handler (closure-safe)
  const activePageRef = React.useRef(activePage);
  activePageRef.current = activePage;
  const attentionCountRef = React.useRef(attentionItems.length);
  attentionCountRef.current = attentionItems.length;
  const setActivePageRef = React.useRef(setActivePage);
  setActivePageRef.current = setActivePage;

  // Loading — pottery wheel animation
  if (currentUser === undefined || buckets === undefined) {
    return (
      <View style={styles.loadingWrapper}>
        <PotteryLoader />
      </View>
    );
  }

  // Bucket detail modal
  const bucketDetailModal = selectedBucket && (
    <BucketDetail
      visible={!!selectedBucket}
      bucket={selectedBucket}
      onBack={() => setSelectedBucket(null)}
      onEditBucket={onEditBucket}
      onEditExpense={onEditExpense}
      onAddExpense={bucket => {
        if (onEditExpense) {
          const newExpense = {
            _id: 'new' as any,
            _creationTime: Date.now(),
            userId: bucket.userId,
            bucketId: bucket._id,
            amount: 0,
            note: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            date: Date.now(),
            worthIt: false,
          } as Expense;
          onEditExpense(newExpense, bucket);
        }
      }}
    />
  );

  // Monthly transactions modal
  const monthlyTransactionsModal =
    showMonthlyTransactions &&
    allExpenses &&
    (() => {
      const monthlyExpenses = allExpenses.filter(expense => {
        const d = new Date(expense.date);
        return (
          d.getMonth() === selectedMonth.getMonth() &&
          d.getFullYear() === selectedMonth.getFullYear()
        );
      });
      monthlyExpenses.sort((a, b) => b.date - a.date);
      const bucketMap = new Map(allBuckets.map(b => [b._id, b]));

      return (
        <Modal
          visible={showMonthlyTransactions}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowMonthlyTransactions(false)}
        >
          <View style={styles.container}>
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
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.monthlyTotalCard}>
              <Text style={styles.monthlyTotalLabel}>TOTAL SPENT</Text>
              <Text style={styles.monthlyTotalAmount}>
                ${totalSpent.toFixed(2)}
              </Text>
              <Text style={styles.monthlyTotalCount}>
                {monthlyExpenses.length} transaction
                {monthlyExpenses.length === 1 ? '' : 's'}
              </Text>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
            >
              {monthlyExpenses.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No transactions yet</Text>
                </View>
              ) : (
                <View style={styles.transactionsList}>
                  {monthlyExpenses.map(expense => {
                    const bucket = bucketMap.get(expense.bucketId);
                    return (
                      <TouchableOpacity
                        key={expense._id}
                        style={styles.transactionItem}
                        onPress={() => {
                          if (onEditExpense && bucket)
                            onEditExpense(expense, bucket);
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={styles.transactionNote}>
                            {expense.note || 'Expense'}
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 4,
                            }}
                          >
                            {bucket && (
                              <Text style={styles.transactionBucket}>
                                {bucket.name}
                              </Text>
                            )}
                            <Text style={styles.transactionDate}>
                              {format(new Date(expense.date), 'MMM d')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.transactionAmount}>
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header — ceramic glaze surface with drip edge */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Celadon glaze — extends behind safe area with copper rim at top */}
        <div style={{
          background: `
            radial-gradient(ellipse at 30% 30%, rgba(190, 205, 170, 0.45) 0%, transparent 55%),
            radial-gradient(ellipse at 70% 25%, rgba(175, 190, 155, 0.35) 0%, transparent 50%),
            radial-gradient(ellipse at 85% 65%, rgba(160, 145, 115, 0.3) 0%, transparent 45%),
            radial-gradient(ellipse at 15% 75%, rgba(150, 160, 130, 0.25) 0%, transparent 50%),
            linear-gradient(180deg, #7E8E6C 0%, #889878 35%, #8B9B7A 65%, #889575 100%)
          `,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 16,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 30px rgba(255, 255, 255, 0.3), inset -8px -10px 24px rgba(0, 0, 0, 0.12), inset 6px 4px 18px rgba(255, 255, 255, 0.15)',
          filter: 'saturate(0.95) brightness(1.05) contrast(1.08)',
        } as any}>
          {/* Copper rim — thin line at top edge */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #8B5E3C, #A0704A, #7A5035, #A0704A, #8B5E3C)',
            zIndex: 3,
          }} />
          {/* Glaze texture — grain and copper specks */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" fill="none">
              <defs>
                <filter id="glazeNoise">
                  <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
                  <feColorMatrix type="saturate" values="0" />
                  <feBlend in="SourceGraphic" mode="overlay" />
                </filter>
              </defs>
              <rect width="400" height="200" filter="url(#glazeNoise)" opacity="0.1" />
              {/* Copper/iron oxide specks */}
              <circle cx="45" cy="28" r="2.2" fill="#B87333" opacity="0.55" />
              <circle cx="120" cy="15" r="1.6" fill="#C68E5B" opacity="0.5" />
              <circle cx="200" cy="42" r="2.4" fill="#B87333" opacity="0.45" />
              <circle cx="310" cy="22" r="1.8" fill="#A0704A" opacity="0.55" />
              <circle cx="370" cy="55" r="1.6" fill="#C68E5B" opacity="0.5" />
              <circle cx="80" cy="70" r="2" fill="#B87333" opacity="0.45" />
              <circle cx="260" cy="65" r="2.2" fill="#A0704A" opacity="0.5" />
              <circle cx="155" cy="90" r="1.8" fill="#C68E5B" opacity="0.55" />
              <circle cx="340" cy="95" r="1.5" fill="#B87333" opacity="0.45" />
              <circle cx="30" cy="110" r="2" fill="#A0704A" opacity="0.5" />
              <circle cx="190" cy="120" r="1.6" fill="#C68E5B" opacity="0.55" />
              <circle cx="290" cy="130" r="1.8" fill="#B87333" opacity="0.45" />
              <circle cx="95" cy="145" r="1.4" fill="#A0704A" opacity="0.5" />
              <circle cx="380" cy="140" r="2" fill="#C68E5B" opacity="0.55" />
              <circle cx="230" cy="155" r="1.7" fill="#B87333" opacity="0.45" />
            </svg>
          </div>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowMonthPicker(true)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 }}>
              <Text style={styles.monthLabel}>{format(selectedMonth, 'MMMM')}</Text>
              <ChevronDown size={14} color="rgba(250, 248, 244, 0.6)" strokeWidth={2} style={{ marginTop: 2 }} />
            </TouchableOpacity>

            {/* Hero numbers */}
            <TouchableOpacity onPress={() => setShowMonthlyTransactions(true)} activeOpacity={0.7}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statCaption}>spent</Text>
                  <AnimatedNumber
                    value={totalSpent}
                    style={{
                      fontSize: 28,
                      fontWeight: '400',
                      color: 'rgba(250, 248, 244, 0.95)',
                      fontFamily: 'Merchant Copy',
                      letterSpacing: -0.5,
                    }}
                  />
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statCaption}>free</Text>
                  <AnimatedNumber
                    value={distributionStatus?.unallocated ?? 0}
                    style={{
                      fontSize: 28,
                      fontWeight: '400',
                      color: distributionStatus && distributionStatus.unallocated < 0
                        ? '#E8A09A'
                        : 'rgba(250, 248, 244, 0.95)',
                      fontFamily: 'Merchant Copy',
                      letterSpacing: -0.5,
                    }}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {/* Over-planned warning */}
            {distributionStatus && distributionStatus.isOverPlanned && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  Over-planned by ${distributionStatus.overPlannedBy.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Search */}
            <View style={styles.searchContainer}>
              <Search size={15} color="rgba(250, 248, 244, 0.4)" strokeWidth={1.5} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search buckets..."
                placeholderTextColor="rgba(250, 248, 244, 0.35)"
              />
            </View>
          </View>
        </div>

        {/* Glaze drip — overlaps into header to ensure seamless join */}
        <svg width="100%" height="52" viewBox="0 0 400 52" preserveAspectRatio="none" fill="none" style={{ display: 'block', marginTop: -6, position: 'relative', zIndex: 1 }}>
          <defs>
            <linearGradient id="dripGlaze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#889575" />
              <stop offset="18%" stopColor="#95A085" />
              <stop offset="35%" stopColor="#ADB5A0" />
              <stop offset="55%" stopColor="#C8C4B5" />
              <stop offset="75%" stopColor="#DDD8CC" />
              <stop offset="100%" stopColor="#EAE3D5" />
            </linearGradient>
            <filter id="dripGrain">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" seed="5" />
              <feColorMatrix type="saturate" values="0" />
              <feBlend in="SourceGraphic" mode="overlay" />
            </filter>
            <clipPath id="dripClip">
              <path d={`M0 0 L400 0
                L400 8
                C388 8.5, 376 9, 368 8.5
                C355 8, 345 10, 336 14
                C330 18, 326 22, 322 27
                C318 32, 314 34, 310 30
                C304 22, 294 14, 280 10
                C268 8.5, 258 9, 250 9.5
                C240 10, 234 11, 228 9.5
                C220 8, 212 9.5, 206 13
                C200 18, 196 24, 192 30
                C188 36, 184 40, 180 38
                C174 30, 168 20, 155 13
                C142 8.5, 132 10, 124 14
                C118 18, 114 17, 108 13
                C100 9, 88 8, 74 9
                C62 10, 54 14, 48 20
                C42 26, 38 25, 32 20
                C26 13, 16 8.5, 6 9
                C2 9, 0 8.5, 0 8 Z`} />
            </clipPath>
          </defs>
          {/* Solid bridge — matches header bottom to cover any seam */}
          <rect x="0" y="0" width="400" height="10" fill="#889575" />
          {/* Drip fill */}
          <path d={`M0 0 L400 0
            L400 8
            C388 8.5, 376 9, 368 8.5
            C355 8, 345 10, 336 14
            C330 18, 326 22, 322 27
            C318 32, 314 34, 310 30
            C304 22, 294 14, 280 10
            C268 8.5, 258 9, 250 9.5
            C240 10, 234 11, 228 9.5
            C220 8, 212 9.5, 206 13
            C200 18, 196 24, 192 30
            C188 36, 184 40, 180 38
            C174 30, 168 20, 155 13
            C142 8.5, 132 10, 124 14
            C118 18, 114 17, 108 13
            C100 9, 88 8, 74 9
            C62 10, 54 14, 48 20
            C42 26, 38 25, 32 20
            C26 13, 16 8.5, 6 9
            C2 9, 0 8.5, 0 8 Z`} fill="url(#dripGlaze)" />
          {/* Grain texture clipped to drip shape */}
          <rect width="400" height="52" clipPath="url(#dripClip)" filter="url(#dripGrain)" opacity="0.06" />
          {/* Copper-rust edge on the drip contour */}
          <path d={`M400 8
            C388 8.5, 376 9, 368 8.5
            C355 8, 345 10, 336 14
            C330 18, 326 22, 322 27
            C318 32, 314 34, 310 30
            C304 22, 294 14, 280 10
            C268 8.5, 258 9, 250 9.5
            C240 10, 234 11, 228 9.5
            C220 8, 212 9.5, 206 13
            C200 18, 196 24, 192 30
            C188 36, 184 40, 180 38
            C174 30, 168 20, 155 13
            C142 8.5, 132 10, 124 14
            C118 18, 114 17, 108 13
            C100 9, 88 8, 74 9
            C62 10, 54 14, 48 20
            C42 26, 38 25, 32 20
            C26 13, 16 8.5, 6 9
            C2 9, 0 8.5, 0 8`} fill="none" stroke="#A0704A" strokeWidth="1.8" strokeOpacity="0.5" />
          <path d={`M400 8
            C388 8.5, 376 9, 368 8.5
            C355 8, 345 10, 336 14
            C330 18, 326 22, 322 27
            C318 32, 314 34, 310 30
            C304 22, 294 14, 280 10
            C268 8.5, 258 9, 250 9.5
            C240 10, 234 11, 228 9.5
            C220 8, 212 9.5, 206 13
            C200 18, 196 24, 192 30
            C188 36, 184 40, 180 38
            C174 30, 168 20, 155 13
            C142 8.5, 132 10, 124 14
            C118 18, 114 17, 108 13
            C100 9, 88 8, 74 9
            C62 10, 54 14, 48 20
            C42 26, 38 25, 32 20
            C26 13, 16 8.5, 6 9
            C2 9, 0 8.5, 0 8`} fill="none" stroke="#C68E5B" strokeWidth="0.6" strokeOpacity="0.25" />
        </svg>
      </div>

      {/* Page indicator dots — only show when there are attention items */}
      {attentionItems.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          paddingTop: 10,
          paddingBottom: 4,
        }}>
          {[0, 1].map(i => (
            <div
              key={i}
              onClick={() => setActivePage(i)}
              style={{
                width: activePage === i ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: activePage === i ? '#8B7E6E' : '#D1CABB',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Swipeable pages container */}
      <div
        ref={(el: any) => {
          if (!el || el._swipeAttached) return;
          el._swipeAttached = true;
          let startX = 0;
          let startY = 0;
          let decided = false;
          let isHorizontal = false;

          el.addEventListener('touchstart', (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            decided = false;
            isHorizontal = false;
          }, { passive: true });

          el.addEventListener('touchmove', (e: TouchEvent) => {
            if (decided) return;
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx < 8 && absDy < 8) return;
            decided = true;
            isHorizontal = absDx > absDy * 2;
          }, { passive: true });

          el.addEventListener('touchend', (e: TouchEvent) => {
            if (!isHorizontal) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (dx < -50 && attentionCountRef.current > 0) {
              setActivePageRef.current(1);
            } else if (dx > 50) {
              setActivePageRef.current(0);
            }
          }, { passive: true });
        }}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '200%',
          }}
          animate={{ x: activePage === 0 ? '0%' : '-50%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Page 1: Cups overview */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' } as any}>
            <div style={{ paddingTop: 8, paddingBottom: 150, paddingLeft: 12, paddingRight: 12 }}>
              {/* Info if no buckets funded */}
              {allBuckets.length > 0 &&
                allBuckets.every((b: Bucket) => {
                  if (b.bucketMode === 'spend')
                    return (b.fundedAmount || 0) - (b.spentAmount || 0) === 0;
                  return (b.currentBalance || 0) === 0;
                }) && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      Your buckets aren't funded yet. Go to Settings → Set Income to
                      add your monthly income.
                    </Text>
                  </View>
                )}

              {/* Groups as shelves */}
              {sortedGroups.map(([groupId, group], gi) => (
                <ShelfGroup
                  key={groupId}
                  groupName={group.name}
                  buckets={group.buckets}
                  onBucketPress={handleBucketPress}
                  startIndex={gi * 10}
                  healthMap={healthMap}
                />
              ))}

              {/* Ungrouped cups — free-standing on surface */}
              {sortedUngrouped.length > 0 && (
                <View style={styles.ungroupedGrid}>
                  {sortedUngrouped.map((bucket, i) => (
                    <CupItem
                      key={bucket._id}
                      bucket={bucket}
                      onPress={() => handleBucketPress(bucket)}
                      index={sortedGroups.length * 10 + i}
                      health={healthMap.get(bucket._id)}
                    />
                  ))}
                </View>
              )}

              {filteredBuckets.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No buckets yet</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Create a bucket to start tracking your spending
                  </Text>
                </View>
              )}
            </div>
          </div>

          {/* Page 2: Needs Attention */}
          <div style={{ position: 'absolute', top: 0, left: '50%', width: '50%', height: '100%', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' } as any}>
            <div style={{ paddingTop: 16, paddingBottom: 150, paddingLeft: 16, paddingRight: 16 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 16,
              }}>
                <Text style={{
                  fontSize: 20,
                  fontFamily: 'Merchant',
                  color: theme.colors.text,
                  fontWeight: '500',
                }}>Needs Attention</Text>
                {attentionItems.length > 0 && (
                  <Text style={{
                    fontSize: 14,
                    fontFamily: 'Merchant',
                    color: theme.colors.textTertiary,
                  }}>
                    {attentionItems.length} bucket{attentionItems.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>

              {attentionItems.map(({ bucket, health }) => {
                // Build contextual detail with actual numbers
                const allocation = health.allocation || 0;
                const avgSpend = health.avgMonthlySpend || 0;
                let contextLine = health.detail;
                if (allocation > 0 && avgSpend > 0) {
                  contextLine = `$${Math.round(avgSpend)}/mo spent · $${allocation}/mo allocated`;
                }

                const isConfirming = confirmAdjust === bucket._id;
                const hasAdjust = health.suggestedAmount !== undefined;
                const freed = hasAdjust && health.allocation
                  ? Math.round((health.allocation || 0) - (health.suggestedAmount || 0))
                  : 0;

                const handleAdjust = async () => {
                  if (!hasAdjust) return;
                  try {
                    await updateBucket({
                      bucketId: bucket._id as any,
                      name: bucket.name,
                      bucketMode: bucket.bucketMode || 'spend',
                      alertThreshold: bucket.alertThreshold,
                      color: bucket.color,
                      allocationType: bucket.allocationType || 'amount',
                      plannedAmount: health.suggestedAmount,
                    });
                    setConfirmAdjust(null);
                    // Auto-dismiss this insight after successful adjust
                    dismissInsight(bucket._id, health);
                    setDismissedInsights(prev => new Set([...prev, `${bucket._id}:${health.status}:${health.reason}`]));
                  } catch (err: any) {
                    alert(err.message || 'Failed to update');
                  }
                };

                return (
                  <TouchableOpacity
                    key={bucket._id}
                    style={{
                      backgroundColor: theme.colors.cardBackground,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}
                    onPress={() => handleBucketPress(bucket)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: healthColors[health.status],
                      }} />
                      <Text style={{
                        fontSize: 17,
                        fontFamily: 'Merchant',
                        color: theme.colors.text,
                        fontWeight: '500',
                        flex: 1,
                      }}>{bucket.name}</Text>
                      <Text style={{
                        fontSize: 13,
                        fontFamily: 'Merchant',
                        color: healthColors[health.status],
                        textTransform: 'capitalize' as any,
                      }}>{health.status}</Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          dismissInsight(bucket._id, health);
                          setDismissedInsights(prev => new Set([...prev, `${bucket._id}:${health.status}:${health.reason}`]));
                        }}
                        style={{ padding: 4, marginLeft: -4 }}
                        activeOpacity={0.5}
                      >
                        <Text style={{ fontSize: 16, color: theme.colors.textTertiary }}>×</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Merchant Copy',
                      color: theme.colors.textTertiary,
                      marginBottom: 4,
                    }}>{contextLine}</Text>
                    <Text style={{
                      fontSize: 15,
                      fontFamily: 'Merchant',
                      color: theme.colors.textSecondary,
                      lineHeight: 21,
                      marginBottom: (health.suggestion || hasAdjust) ? 8 : 0,
                    }}>{health.reason}</Text>

                    {/* One-tap adjust */}
                    {hasAdjust && !isConfirming && (
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); setConfirmAdjust(bucket._id); }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          alignSelf: 'flex-start',
                          backgroundColor: `${healthColors[health.status]}15`,
                          borderRadius: 16,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          gap: 6,
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontFamily: 'Merchant',
                          color: healthColors[health.status],
                          fontWeight: '500',
                        }}>
                          {health.suggestedAmount === 0
                            ? 'Remove allocation'
                            : `Adjust to $${health.suggestedAmount}/mo`}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Confirm step */}
                    {isConfirming && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 2,
                      }}>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); handleAdjust(); }}
                          style={{
                            backgroundColor: theme.colors.primary,
                            borderRadius: 12,
                            paddingVertical: 6,
                            paddingHorizontal: 14,
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{
                            fontSize: 14,
                            fontFamily: 'Merchant',
                            color: theme.colors.background,
                            fontWeight: '500',
                          }}>
                            {health.suggestedAmount === 0
                              ? 'Set to $0'
                              : `Set to $${health.suggestedAmount}/mo`}
                            {freed > 0 ? ` · free $${freed}` : ''}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); setConfirmAdjust(null); }}
                          activeOpacity={0.7}
                        >
                          <Text style={{
                            fontSize: 14,
                            fontFamily: 'Merchant',
                            color: theme.colors.textTertiary,
                          }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {attentionItems.length === 0 && (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 18,
                    fontFamily: 'Merchant',
                    fontStyle: 'italic',
                    color: theme.colors.textTertiary,
                  }}>All buckets are healthy</Text>
                </View>
              )}
            </div>
          </div>
        </motion.div>
      </div>

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

      {monthlyTransactionsModal}
      {bucketDetailModal}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    maxHeight: '100vh' as any,
    minHeight: '100vh' as any,
  },
  header: {
  },
  monthLabel: {
    fontSize: 22,
    color: 'rgba(250, 248, 244, 0.9)',
    fontFamily: 'Merchant',
    fontWeight: '500',
  },

  // Stats — hero numbers
  statsRow: {
    flexDirection: 'row',
    gap: 36,
    marginBottom: 20,
  },
  statItem: {
  },
  statCaption: {
    fontSize: 13,
    color: 'rgba(250, 248, 244, 0.5)',
    fontFamily: 'Merchant Copy',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as any,
    marginBottom: 6,
  },
  statAmount: {
    fontSize: 28,
    fontWeight: '400',
    color: 'rgba(250, 248, 244, 0.95)',
    fontFamily: 'Merchant Copy',
    letterSpacing: -0.5,
  },

  // Warning
  warningBanner: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 15,
    color: 'rgba(250, 248, 244, 0.7)',
    fontFamily: 'Merchant Copy',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(250, 248, 244, 0.9)',
    fontFamily: 'Merchant Copy',
    outlineStyle: 'none' as any,
  },

  // Cup grid
  ungroupedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },

  // Scroll
  scrollView: {
    flex: 1,
    overflow: 'auto' as any,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 150,
    paddingHorizontal: 12,
  },

  // Info
  infoBox: {
    backgroundColor: theme.colors.linen,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy',
    lineHeight: 20,
  },

  // Empty
  emptyState: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant',
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy',
    textAlign: 'center',
  },

  // Month Picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(59, 49, 40, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerContainer: {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: 20,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  monthPickerHeader: {
    padding: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  monthPickerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingBottom: 20,
  },
  monthGridItem: {
    width: '33.333%' as any,
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
    color: theme.colors.text,
    fontFamily: 'Merchant',
  },
  monthGridItemTextSelected: {
    color: theme.colors.textOnPrimary,
    fontWeight: '500',
  },

  // Monthly transactions
  monthlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.text,
  },
  monthlyHeaderTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant',
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
    fontSize: 14,
    color: 'rgba(250, 248, 244, 0.6)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Merchant Copy',
  },
  monthlyTotalAmount: {
    fontSize: 26,
    fontWeight: '400',
    color: theme.colors.textOnPrimary,
    fontFamily: 'Merchant Copy',
    marginBottom: 6,
  },
  monthlyTotalCount: {
    fontSize: 15,
    color: 'rgba(250, 248, 244, 0.6)',
    fontFamily: 'Merchant Copy',
  },
  transactionsList: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  transactionNote: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant',
  },
  transactionBucket: {
    fontSize: 14,
    color: theme.colors.clay,
    fontFamily: 'Merchant Copy',
  },
  transactionDate: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    fontFamily: 'Merchant Copy',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant Copy',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant',
  },

  // Loading
  loadingWrapper: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw' as any,
    height: '100vh' as any,
    backgroundColor: 'transparent',
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
    fontSize: 17,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant',
  },
});
