import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Trash2, ChevronRight } from 'lucide-react-native';
import type { Report } from '../types';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = -80;

interface SwipeableReportProps {
  report: Report;
  onPress: () => void;
  onDelete: () => void;
}

export const SwipeableReport: React.FC<SwipeableReportProps> = ({
  report,
  onPress,
  onDelete,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal swipes
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        translateX.setOffset(lastOffset.current);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping left (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        } else if (lastOffset.current < 0) {
          // Allow swiping right to close if already open
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        const currentValue = gestureState.dx + lastOffset.current;

        if (currentValue < SWIPE_THRESHOLD) {
          // Swipe to reveal delete button
          Animated.spring(translateX, {
            toValue: SWIPE_THRESHOLD,
            useNativeDriver: true,
            friction: 8,
          }).start();
          lastOffset.current = SWIPE_THRESHOLD;
        } else {
          // Snap back to closed position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
          lastOffset.current = 0;
        }
      },
    })
  ).current;

  const handleDelete = () => {
    // Animate out before deleting
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  };

  return (
    <View style={styles.container}>
      {/* Delete Button (Hidden Behind) */}
      <View style={styles.deleteContainer}>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={20} color="#FFF" strokeWidth={2} />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      {/* Report Card (Swipeable) */}
      <Animated.View
        style={[
          styles.reportCard,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}>
        <Pressable style={styles.reportContent} onPress={onPress}>
          <View style={styles.reportCardHeader}>
            <Text style={styles.reportCardTitle}>
              {new Date(report.periodStart).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}{' '}
              -{' '}
              {new Date(report.periodEnd).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <ChevronRight size={20} color={theme.colors.textSecondary} strokeWidth={2} />
          </View>

          <Text style={styles.reportCardSummary} numberOfLines={2}>
            {report.vibeCheck || report.summary || 'No summary available'}
          </Text>

          {/* Only show stats for old format reports */}
          {report.spendingAnalysis && report.happinessAnalysis && report.insights && (
            <View style={styles.reportCardStats}>
              <View style={styles.reportCardStat}>
                <Text style={styles.reportCardStatLabel}>Spent</Text>
                <Text style={styles.reportCardStatValue}>
                  ${report.spendingAnalysis.totalSpent.toFixed(0)}
                </Text>
              </View>
              <View style={styles.reportCardStat}>
                <Text style={styles.reportCardStatLabel}>Happiness</Text>
                <Text style={styles.reportCardStatValue}>
                  {report.happinessAnalysis.averageHappiness.toFixed(1)}/5
                </Text>
              </View>
              <View style={styles.reportCardStat}>
                <Text style={styles.reportCardStatLabel}>Insights</Text>
                <Text style={styles.reportCardStatValue}>
                  {report.insights.length}
                </Text>
              </View>
            </View>
          )}

          {/* Show wins count for new format reports */}
          {report.wins && report.wins.length > 0 && !report.spendingAnalysis && (
            <View style={styles.reportCardStats}>
              <View style={styles.reportCardStat}>
                <Text style={styles.reportCardStatLabel}>Wins</Text>
                <Text style={styles.reportCardStatValue}>
                  {report.wins.length}
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    position: 'relative',
  },
  deleteContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 100,
  },
  deleteButton: {
    backgroundColor: theme.colors.danger,
    height: '100%',
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    gap: 4,
  },
  deleteText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Merchant',
  },
  reportCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reportContent: {
    padding: 20,
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportCardTitle: {
    fontSize: 20,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: theme.colors.text,
  },
  reportCardSummary: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  reportCardStats: {
    flexDirection: 'row',
    gap: 20,
  },
  reportCardStat: {
    flex: 1,
  },
  reportCardStatLabel: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportCardStatValue: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    fontWeight: '500',
    color: theme.colors.text,
  },
});
