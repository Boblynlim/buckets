import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { Bucket } from '../types';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import { getCupForBucketId } from '../constants/bucketIcons';

interface BucketCardProps {
  bucket: Bucket;
  onPress?: () => void;
}

export const BucketCard: React.FC<BucketCardProps> = ({ bucket, onPress }) => {
  // Calculate values based on bucket mode
  const isSpendBucket = bucket.bucketMode === 'spend' || !bucket.bucketMode; // Default to spend for legacy
  const isSaveBucket = bucket.bucketMode === 'save';
  const isRecurringBucket = bucket.bucketMode === 'recurring';

  let spent = 0;
  let total = 0;
  let available = 0;
  let percentUsed = 0;

  if (isSpendBucket) {
    spent = bucket.spentAmount || 0;
    const funded = bucket.fundedAmount || bucket.allocationValue || 0;
    const carryover = bucket.carryoverBalance || 0;
    total = funded + carryover;
    available = total - spent; // Can be negative if overspent
    percentUsed = total > 0 ? (spent / total) * 100 : 0;
  } else if (isSaveBucket) {
    available = bucket.currentBalance || 0;
    total = bucket.targetAmount || 0;
    percentUsed = total > 0 ? (available / total) * 100 : 0;
  } else if (isRecurringBucket) {
    // For recurring buckets, show total paid this month
    spent = bucket.spentAmount || 0;
    total = bucket.fundedAmount || bucket.allocationValue || 0;
    available = 0; // No available balance for recurring
    percentUsed = 100; // Always fully "paid"
  }

  const isLowBalance = percentUsed >= bucket.alertThreshold;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardContainer}>
        <View style={styles.cardContent}>
          {/* Cup image */}
          <Image
            source={getCupForBucketId(bucket._id, bucket.icon)}
            style={styles.cupImage}
            resizeMode="contain"
          />

          {/* Bucket Info */}
          <View style={styles.info}>
            <Text style={styles.bucketName}>{bucket.name}</Text>

            {/* Amount Info - Different for spend vs save */}
            {isSpendBucket && (
              <>
                <Text style={styles.amountText}>
                  <Text style={styles.currentAmount}>
                    ${available.toFixed(2)}
                  </Text>
                  <Text style={styles.amountLabel}> left of </Text>
                  <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
                </Text>

                {/* Show carryover breakdown if there is a carryover */}
                {bucket.carryoverBalance !== undefined && bucket.carryoverBalance !== 0 && (
                  <Text style={styles.carryoverHint}>
                    {bucket.carryoverBalance > 0 ? '+' : ''}${bucket.carryoverBalance.toFixed(2)} from last month
                  </Text>
                )}

                {/* Progress bar - shows usage */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(percentUsed, 100)}%`,
                          backgroundColor: isLowBalance
                            ? theme.colors.danger
                            : bucket.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              </>
            )}

            {isSaveBucket && (
              <>
                <Text style={styles.amountText}>
                  <Text style={styles.currentAmount}>
                    ${available.toFixed(2)}
                  </Text>
                  <Text style={styles.amountLabel}> saved of </Text>
                  <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
                </Text>

                {/* Progress bar - shows progress toward goal */}
                <View style={styles.progressContainer}>
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
                </View>
              </>
            )}

            {isRecurringBucket && (
              <>
                <Text style={styles.amountText}>
                  <Text style={styles.currentAmount}>
                    ${total.toFixed(2)}
                  </Text>
                  <Text style={styles.amountLabel}> allocated this month</Text>
                </Text>

                {spent > 0 && (
                  <Text style={styles.carryoverHint}>
                    ${spent.toFixed(2)} paid via expenses
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Chevron */}
          <View style={styles.chevronContainer}>
            <ChevronRight
              size={24}
              color={theme.colors.textSecondary}
              strokeWidth={2}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  cardContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    overflow: 'visible',
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  cupImage: {
    width: 64,
    height: 64,
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  bucketName: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  amountText: {
    marginBottom: 10,
    lineHeight: 24,
  },
  currentAmount: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: theme.colors.primary,
    letterSpacing: 0,
    fontWeight: '500',
  },
  amountLabel: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: theme.colors.textSecondary,
    letterSpacing: 0,
  },
  carryoverHint: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginTop: 0,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: theme.colors.purple100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  chevronContainer: {
    marginLeft: 12,
  },
});
