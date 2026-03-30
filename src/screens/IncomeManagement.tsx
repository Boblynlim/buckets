import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import {Check, Plus, Trash2, ChevronLeft, ChevronRight} from 'lucide-react-native';
import {useQuery, useMutation} from 'convex/react';
import {api} from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import {theme} from '../theme';
import {Drawer} from '../components/Drawer';
import {PotteryLoader} from '../components/PotteryLoader';
import {format, addMonths, subMonths, startOfMonth, isSameMonth} from 'date-fns';

interface IncomeManagementProps {
  visible?: boolean;
  onClose?: () => void;
}

const formatMonth = (date: Date) => format(date, 'yyyy-MM');

export const IncomeManagement: React.FC<IncomeManagementProps> = ({
  visible = true,
  onClose,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [showAddSource, setShowAddSource] = useState(false);
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [newSourceAmount, setNewSourceAmount] = useState('');
  const [newSourceNote, setNewSourceNote] = useState('');
  const [adHocAmount, setAdHocAmount] = useState('');
  const [adHocNote, setAdHocNote] = useState('');

  const { user: currentUser } = useAuth();
  const incomeEntries = useQuery(
    api.income.getByUser,
    currentUser ? {userId: currentUser._id} : 'skip',
  );
  // Track receipts in local state until incomeReceipts table is available
  // TODO: Replace with useQuery(api.incomeReceipts.getAll) after dev server restart
  const [localReceipts, setLocalReceipts] = useState<Array<{
    _id: string;
    sourceId?: string;
    amount: number;
    month: string;
    note?: string;
    receivedAt: number;
  }>>([]);
  const monthReceipts = React.useMemo(() => {
    const m = formatMonth(selectedMonth);
    return localReceipts.filter(r => r.month === m);
  }, [localReceipts, selectedMonth]);
  const addIncome = useMutation(api.income.add);
  const removeIncome = useMutation(api.income.remove);
  const recalculateDistribution = useMutation(api.distribution.calculateDistribution);

  const recurringSources = useMemo(() => {
    if (!incomeEntries) return [];
    return incomeEntries.filter(i => i.isRecurring);
  }, [incomeEntries]);

  const expectedTotal = useMemo(() => {
    return recurringSources.reduce((sum, s) => sum + s.amount, 0);
  }, [recurringSources]);

  const receivedTotal = useMemo(() => {
    if (!monthReceipts) return 0;
    return monthReceipts.reduce((sum, r) => sum + r.amount, 0);
  }, [monthReceipts]);

  const adHocReceipts = useMemo(() => {
    if (!monthReceipts) return [];
    return monthReceipts.filter(r => !r.sourceId);
  }, [monthReceipts]);

  // Check which sources have been confirmed this month
  const confirmedSourceIds = useMemo(() => {
    if (!monthReceipts) return new Set<string>();
    return new Set(monthReceipts.filter(r => r.sourceId).map(r => r.sourceId!));
  }, [monthReceipts]);

  const progressPercent = expectedTotal > 0
    ? Math.min(100, (receivedTotal / expectedTotal) * 100)
    : 0;

  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  const handleConfirmSource = (sourceId: string, amount: number, note?: string) => {
    setLocalReceipts(prev => [...prev, {
      _id: `local_${Date.now()}`,
      sourceId,
      amount,
      month: formatMonth(selectedMonth),
      note,
      receivedAt: Date.now(),
    }]);
  };

  const handleUnconfirmSource = (sourceId: string) => {
    setLocalReceipts(prev => prev.filter(r => r.sourceId !== sourceId || r.month !== formatMonth(selectedMonth)));
  };

  const handleAddAdHoc = () => {
    const amt = parseFloat(adHocAmount);
    if (!amt || amt <= 0) return;
    setLocalReceipts(prev => [...prev, {
      _id: `local_${Date.now()}`,
      amount: amt,
      month: formatMonth(selectedMonth),
      note: adHocNote || undefined,
      receivedAt: Date.now(),
    }]);
    setAdHocAmount('');
    setAdHocNote('');
    setShowAdHoc(false);
  };

  const handleAddSource = async () => {
    const amt = parseFloat(newSourceAmount);
    if (!amt || amt <= 0 || !currentUser) return;
    try {
      await addIncome({
        userId: currentUser._id,
        amount: amt,
        date: Date.now(),
        note: newSourceNote || undefined,
        isRecurring: true,
      });
      setNewSourceAmount('');
      setNewSourceNote('');
      setShowAddSource(false);
    } catch (err: any) {
      console.error('Failed to add source:', err);
      if (Platform.OS === 'web') alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteSource = async (incomeId: string) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Remove this income source?')
      : true; // native would use Alert
    if (!confirm) return;
    try {
      await removeIncome({incomeId: incomeId as any});
      if (currentUser) {
        await recalculateDistribution({userId: currentUser._id}).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to delete source:', err);
    }
  };

  const handleRemoveAdHoc = (receiptId: string) => {
    setLocalReceipts(prev => prev.filter(r => r._id !== receiptId));
  };

  if (currentUser === undefined || incomeEntries === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <PotteryLoader />
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
            <Text style={styles.closeButton}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Income</Text>
          <View style={{width: 40}} />
        </View>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <ChevronLeft size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{format(selectedMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity
            onPress={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <ChevronRight size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusAmounts}>
            <View style={styles.statusCol}>
              <Text style={styles.statusCaption}>received</Text>
              <Text style={styles.statusValue}>${receivedTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={[styles.statusCol, {alignItems: 'flex-end'}]}>
              <Text style={styles.statusCaption}>expected</Text>
              <Text style={[styles.statusValue, {color: theme.colors.textSecondary}]}>
                ${expectedTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              {
                width: `${progressPercent}%` as any,
                backgroundColor: receivedTotal >= expectedTotal ? theme.colors.success : theme.colors.primary,
              },
            ]} />
          </View>
          {receivedTotal >= expectedTotal && expectedTotal > 0 && (
            <Text style={styles.statusNote}>All income received</Text>
          )}
          {receivedTotal < expectedTotal && expectedTotal > 0 && (
            <Text style={styles.statusNote}>
              ${(expectedTotal - receivedTotal).toFixed(2)} remaining
            </Text>
          )}
        </View>

        {/* Income Sources */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Income Sources</Text>
            <TouchableOpacity onPress={() => setShowAddSource(true)}>
              <Plus size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {recurringSources.length === 0 && (
            <TouchableOpacity
              style={styles.emptySourceCard}
              onPress={() => setShowAddSource(true)}>
              <Text style={styles.emptySourceText}>
                Add your first income source
              </Text>
              <Text style={styles.emptySourceSubtext}>
                e.g., Salary, Freelance, Side gig
              </Text>
            </TouchableOpacity>
          )}

          {recurringSources.map((source, index) => {
            const isConfirmed = confirmedSourceIds.has(source._id);
            const receipt = monthReceipts?.find(r => r.sourceId === source._id);
            return (
              <View
                key={source._id}
                style={[
                  styles.sourceRow,
                  index < recurringSources.length - 1 && styles.sourceRowBorder,
                ]}>
                <TouchableOpacity
                  style={[styles.checkCircle, isConfirmed && styles.checkCircleActive]}
                  onPress={() =>
                    isConfirmed
                      ? handleUnconfirmSource(source._id)
                      : handleConfirmSource(source._id, source.amount, source.note)
                  }>
                  {isConfirmed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </TouchableOpacity>
                <View style={styles.sourceInfo}>
                  <Text style={[styles.sourceName, isConfirmed && styles.sourceNameConfirmed]}>
                    {source.note || 'Income'}
                  </Text>
                  <Text style={styles.sourceAmount}>
                    ${source.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                  </Text>
                  {isConfirmed && receipt && (
                    <Text style={styles.sourceConfirmedDate}>
                      Received {new Date(receipt.receivedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteSource(source._id)}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Trash2 size={16} color={theme.colors.textTertiary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Ad-hoc / Extra Income */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Extra Income</Text>
            <TouchableOpacity onPress={() => setShowAdHoc(true)}>
              <Plus size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {adHocReceipts.length === 0 && !showAdHoc && (
            <Text style={styles.adHocEmpty}>
              Bonuses, side gigs, refunds — add them here
            </Text>
          )}

          {adHocReceipts.map((receipt, index) => (
            <View
              key={receipt._id}
              style={[
                styles.adHocRow,
                index < adHocReceipts.length - 1 && styles.sourceRowBorder,
              ]}>
              <View style={{flex: 1}}>
                <Text style={styles.sourceName}>{receipt.note || 'Extra income'}</Text>
                <Text style={styles.sourceAmount}>
                  ${receipt.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveAdHoc(receipt._id)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Trash2 size={16} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}

          {showAdHoc && (
            <View style={styles.inlineForm}>
              <View style={styles.inlineFormRow}>
                <View style={[styles.amountContainer, {flex: 1}]}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={adHocAmount}
                    onChangeText={setAdHocAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textTertiary}
                    autoFocus
                  />
                </View>
              </View>
              <TextInput
                style={styles.noteInput}
                value={adHocNote}
                onChangeText={setAdHocNote}
                placeholder="What's this from?"
                placeholderTextColor={theme.colors.textTertiary}
              />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => {setShowAdHoc(false); setAdHocAmount(''); setAdHocNote('');}}>
                  <Text style={styles.inlineCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineSaveBtn, (!adHocAmount || parseFloat(adHocAmount) <= 0) && {opacity: 0.4}]}
                  onPress={handleAddAdHoc}>
                  <Text style={styles.inlineSaveText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{height: 40}} />
      </ScrollView>

      {/* Add Source Modal */}
      <Modal visible={showAddSource} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Income Source</Text>
            <Text style={styles.modalSubtitle}>
              This will be expected every month
            </Text>

            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={newSourceAmount}
                onChangeText={setNewSourceAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textTertiary}
                autoFocus
              />
            </View>

            <TextInput
              style={[styles.noteInput, {marginTop: 10}]}
              value={newSourceNote}
              onChangeText={setNewSourceNote}
              placeholder="e.g., Salary, Freelance"
              placeholderTextColor={theme.colors.textTertiary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {setShowAddSource(false); setNewSourceAmount(''); setNewSourceNote('');}}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, (!newSourceAmount || parseFloat(newSourceAmount) <= 0) && {opacity: 0.4}]}
                onPress={handleAddSource}>
                <Text style={styles.modalSaveText}>Add Source</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  if (onClose) {
    return (
      <Drawer visible={visible} onClose={onClose} fullScreen>
        {content}
      </Drawer>
    );
  }

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.text,
  },
  closeButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: 'Merchant',
  },

  // Month selector
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  monthLabel: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
  },

  // Status card
  statusCard: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  statusAmounts: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  statusCol: {
    flex: 1,
  },
  statusDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  statusCaption: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 24,
    fontFamily: 'Merchant Copy',
    color: theme.colors.text,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusNote: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    marginTop: 8,
  },

  // Sections
  section: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Source rows
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sourceRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkCircleActive: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    fontSize: 17,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 2,
  },
  sourceNameConfirmed: {
    color: theme.colors.textSecondary,
  },
  sourceAmount: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: theme.colors.text,
  },
  sourceConfirmedDate: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.success,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },

  // Empty source
  emptySourceCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptySourceText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptySourceSubtext: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
  },

  // Ad-hoc
  adHocEmpty: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
  },
  adHocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  // Inline form
  inlineForm: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  inlineFormRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  inlineCancel: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
  },
  inlineSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  inlineSaveText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#FFFFFF',
  },

  // Shared form elements
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    color: theme.colors.text,
    fontFamily: 'Merchant Copy',
    paddingVertical: 12,
  },
  noteInput: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: 'Merchant',
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalSaveText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#FFFFFF',
  },
});
