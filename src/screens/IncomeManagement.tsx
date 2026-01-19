import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import {useQuery, useMutation} from 'convex/react';
import {api} from '../../convex/_generated/api';
import {theme} from '../theme';
import {getFontFamily} from '../theme/fonts';

interface IncomeManagementProps {
  visible?: boolean;
  onClose?: () => void;
}

export const IncomeManagement: React.FC<IncomeManagementProps> = ({
  visible = true,
  onClose,
}) => {
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const [note, setNote] = useState('');

  // Get current user and buckets
  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const addIncome = useMutation(api.income.add);

  // Initialize demo user if needed
  React.useEffect(() => {
    if (currentUser === null) {
      console.log('No user found, initializing...');
      initDemoUser().catch(err => {
        console.error('Error initializing demo user:', err);
      });
    }
  }, [currentUser, initDemoUser]);

  const allBuckets = buckets || [];
  const incomeAmount = parseFloat(amount) || 0;

  // Calculate distribution preview
  const calculateDistribution = () => {
    if (incomeAmount <= 0 || allBuckets.length === 0) return [];

    let remainingAmount = incomeAmount;
    const distribution: Array<{name: string; color: string; amount: number; percentage: number}> = [];

    // First, handle percentage-based allocations
    for (const bucket of allBuckets) {
      if (bucket.allocationType === 'percentage') {
        const allocation = (incomeAmount * bucket.allocationValue) / 100;
        distribution.push({
          name: bucket.name,
          color: bucket.color,
          amount: allocation,
          percentage: bucket.allocationValue,
        });
        remainingAmount -= allocation;
      }
    }

    // Then, handle fixed amount allocations
    for (const bucket of allBuckets) {
      if (bucket.allocationType === 'amount') {
        const allocation = Math.min(bucket.allocationValue, remainingAmount);
        distribution.push({
          name: bucket.name,
          color: bucket.color,
          amount: allocation,
          percentage: (allocation / incomeAmount) * 100,
        });
        remainingAmount -= allocation;
      }
    }

    return distribution;
  };

  const distribution = calculateDistribution();
  const totalDistributed = distribution.reduce((sum, d) => sum + d.amount, 0);
  const isValid = amount && parseFloat(amount) > 0;

  const handleSave = async () => {
    if (!isValid || !currentUser) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await addIncome({
        userId: currentUser._id,
        amount: incomeAmount,
        date: Date.now(),
        note: note || undefined,
        isRecurring,
      });

      alert(`Successfully added ${isRecurring ? 'recurring ' : ''}income of $${incomeAmount.toFixed(2)}!\n\nDistributed to ${distribution.length} buckets.`);

      // Close modal or navigate back
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to add income:', error);
      alert(error.message || 'Failed to add income. Please try again.');
    }
  };

  // Show loading state
  if (currentUser === undefined || buckets === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const content = (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Income</Text>
          <TouchableOpacity onPress={handleSave} disabled={!isValid}>
            <Text style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
        </View>

        {/* Note Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Note (Optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="e.g., Monthly salary"
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Recurring Toggle */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Recurring Income</Text>
              <Text style={styles.switchSubtext}>Monthly automatic entry</Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={isRecurring ? '#FFFFFF' : theme.colors.textTertiary}
            />
          </View>
        </View>

        {/* Distribution Preview */}
        {incomeAmount > 0 && allBuckets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Distribution Preview</Text>
            <View style={styles.distributionContainer}>
              {distribution.map((item, index) => (
                <View key={index} style={styles.distributionRow}>
                  <View style={styles.distributionLeft}>
                    <View style={[styles.bucketDot, {backgroundColor: item.color}]} />
                    <Text style={styles.distributionName}>{item.name}</Text>
                  </View>
                  <Text style={styles.distributionAmount}>
                    ${item.amount.toFixed(2)}
                  </Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.distributionRow}>
                <Text style={styles.totalLabel}>Total Distributed</Text>
                <Text style={styles.totalAmount}>${totalDistributed.toFixed(2)}</Text>
              </View>

              {totalDistributed < incomeAmount && (
                <View style={styles.remainingBox}>
                  <Text style={styles.remainingText}>
                    ${(incomeAmount - totalDistributed).toFixed(2)} remaining (not allocated)
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Empty State */}
        {allBuckets.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No buckets yet!</Text>
            <Text style={styles.emptySubtext}>
              Create buckets first to see how income will be distributed.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );

  // If visible prop is provided (web), wrap in Modal
  if (onClose) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}>
        {content}
      </Modal>
    );
  }

  // Otherwise return content directly (native navigation)
  return content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  cancelButton: {
    fontSize: 14,
    color: theme.colors.primary,
    fontFamily: getFontFamily('regular'),
  },
  saveButton: {
    fontSize: 14,
    color: theme.colors.primary,
    fontFamily: getFontFamily('bold'),
  },
  saveButtonDisabled: {
    color: theme.colors.textTertiary,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: 20,
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '400',
    color: theme.colors.text,
    fontFamily: 'Merchant Copy, monospace',
    paddingVertical: 12,
    minHeight: 20,
  },
  noteInput: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
    marginBottom: 4,
  },
  switchSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
  },
  distributionContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 12,
  },
  distributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  distributionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bucketDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  distributionName: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
  },
  distributionAmount: {
    fontSize: 20,
    color: theme.colors.text,
    fontFamily: 'Merchant Copy, monospace',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: getFontFamily('bold'),
  },
  totalAmount: {
    fontSize: 20,
    color: theme.colors.primary,
    fontFamily: 'Merchant Copy, monospace',
  },
  remainingBox: {
    backgroundColor: theme.colors.purple100,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  remainingText: {
    fontSize: 20,
    color: theme.colors.primary,
    fontFamily: 'Merchant Copy, monospace',
    textAlign: 'center',
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    textAlign: 'center',
  },
});
