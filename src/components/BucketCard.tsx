import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import {ChevronRight} from 'lucide-react-native';
import type {Bucket} from '../types';
import {theme} from '../theme';
import {getFontFamily} from '../theme/fonts';
import {BUCKET_ICON_IMAGES, type BucketIcon} from '../constants/bucketIcons';

interface BucketCardProps {
  bucket: Bucket;
  onPress?: () => void;
}

export const BucketCard: React.FC<BucketCardProps> = ({bucket, onPress}) => {
  // Calculate values based on bucket mode
  const isSpendBucket = bucket.bucketMode === 'spend' || !bucket.bucketMode; // Default to spend for legacy
  const isSaveBucket = bucket.bucketMode === 'save';

  let spent = 0;
  let total = 0;
  let available = 0;
  let percentUsed = 0;

  if (isSpendBucket) {
    spent = bucket.spentAmount || 0;
    total = bucket.fundedAmount || bucket.allocationValue || 0;
    available = Math.max(0, total - spent);
    percentUsed = total > 0 ? (spent / total) * 100 : 0;
  } else if (isSaveBucket) {
    available = bucket.currentBalance || 0;
    total = bucket.targetAmount || 0;
    percentUsed = total > 0 ? (available / total) * 100 : 0;
  }

  const isLowBalance = percentUsed >= bucket.alertThreshold;

  // Default to 'octopus' if icon is not set (for backward compatibility)
  const iconName = (bucket.icon || 'octopus') as BucketIcon;

  return (
    <Pressable
      style={({pressed}) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}>
      <View style={styles.cardContainer}>
        <View style={styles.cardContent}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Image
              source={BUCKET_ICON_IMAGES[iconName]}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>

          {/* Bucket Info */}
          <View style={styles.info}>
            <Text style={styles.bucketName}>{bucket.name}</Text>

            {/* Amount Info - Different for spend vs save */}
            {isSpendBucket && (
              <>
                <Text style={styles.amountText}>
                  <Text style={styles.currentAmount}>${available.toFixed(2)}</Text>
                  <Text style={styles.amountLabel}> left of </Text>
                  <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
                </Text>

                {/* Progress bar - shows usage */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(percentUsed, 100)}%`,
                          backgroundColor: isLowBalance ? theme.colors.danger : bucket.color,
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
                  <Text style={styles.currentAmount}>${available.toFixed(2)}</Text>
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
          </View>

          {/* Chevron */}
          <View style={styles.chevronContainer}>
            <ChevronRight size={24} color={theme.colors.textSecondary} strokeWidth={2} />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{scale: 0.985}],
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
  iconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconImage: {
    width: 64,
    height: 64,
  },
  info: {
    flex: 1,
  },
  bucketName: {
    fontSize: 17,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  amountText: {
    marginBottom: 12,
    lineHeight: 28,
  },
  currentAmount: {
    fontSize: 24,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.primary,
    letterSpacing: 0,
  },
  amountLabel: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.textSecondary,
    letterSpacing: 0,
  },
  progressContainer: {
    marginTop: 4,
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
