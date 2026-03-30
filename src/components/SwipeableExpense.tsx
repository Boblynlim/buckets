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
import { Trash2 } from 'lucide-react-native';
import type { Expense } from '../types';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = -80;

interface SwipeableExpenseProps {
  expense: Expense;
  onPress: () => void;
  onDelete: () => void;
  onToggleWorthIt?: () => void;
  formatDate: (timestamp: number) => string;
  happinessEmojis?: string[];
}

export const SwipeableExpense: React.FC<SwipeableExpenseProps> = ({
  expense,
  onPress,
  onDelete,
  onToggleWorthIt,
  formatDate,
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

      {/* Expense Card (Swipeable) */}
      <Animated.View
        style={[
          styles.expenseCard,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}>
        <Pressable style={styles.expenseContent} onPress={onPress}>
          <View style={styles.expenseMain}>
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseNote}>{expense.note}</Text>
              <View style={styles.expenseMetadata}>
                <Text style={styles.expenseDate}>{formatDate(expense.date)}</Text>
                {expense.category && (
                  <>
                    <Text style={styles.metadataSeparator}>•</Text>
                    <Text style={styles.expenseCategory}>{expense.category}</Text>
                  </>
                )}
              </View>
            </View>
            <View style={styles.expenseRight}>
              <Text style={styles.expenseAmount}>-${expense.amount.toFixed(2)}</Text>
              <Pressable
                style={[
                  styles.worthItPill,
                  (expense.worthIt) && styles.worthItPillActive,
                ]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onToggleWorthIt?.();
                }}
              >
                <Text style={[
                  styles.worthItPillText,
                  (expense.worthIt) && styles.worthItPillTextActive,
                ]}>
                  {expense.worthIt ? 'WORTH IT' : 'WORTH IT?'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
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
    borderRadius: 12,
    gap: 4,
  },
  deleteText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Merchant',
  },
  expenseCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  expenseContent: {
    padding: 16,
  },
  expenseMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseLeft: {
    flex: 1,
    marginRight: 16,
  },
  expenseNote: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 4,
  },
  expenseMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expenseDate: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
  },
  metadataSeparator: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  expenseCategory: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.primary,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 20,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 6,
  },
  worthItPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.sageMuted,
  },
  worthItPillActive: {
    backgroundColor: '#b5c9ad',
    borderColor: '#b5c9ad',
  },
  worthItPillText: {
    fontSize: 12,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  worthItPillTextActive: {
    color: '#3a5434',
  },
});
