import React, {useState, useMemo, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import {Check, Plus, Trash2, ChevronLeft, ChevronRight, Pencil, ArrowDownToLine} from 'lucide-react-native';
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  const { user: currentUser } = useAuth();
  const month = formatMonth(selectedMonth);

  // Per-month income entries
  const entries = useQuery(
    api.monthlyIncome.getByMonth,
    currentUser ? {userId: currentUser._id, month} : 'skip',
  );
  const seedMonth = useMutation(api.monthlyIncome.seedMonth);
  const addEntry = useMutation(api.monthlyIncome.add);
  const updateEntry = useMutation(api.monthlyIncome.update);
  const removeEntry = useMutation(api.monthlyIncome.remove);
  const toggleConfirm = useMutation(api.monthlyIncome.toggleConfirm);
  const migrateFromLegacy = useMutation(api.monthlyIncome.migrateFromLegacy);
  const recalculateDistribution = useMutation(api.distribution.calculateDistribution);

  const distributionStatus = useQuery(
    api.distribution.getDistributionStatus,
    currentUser ? {userId: currentUser._id} : 'skip',
  );

  // One-time migration from old global income table
  const hasMigrated = useRef(false);
  useEffect(() => {
    if (currentUser && !hasMigrated.current) {
      hasMigrated.current = true;
      migrateFromLegacy({userId: currentUser._id}).catch(() => {});
    }
  }, [currentUser]);

  // Auto-seed month from previous month if empty (only once per month)
  const seededMonths = useRef(new Set<string>());
  useEffect(() => {
    if (entries && entries.length === 0 && currentUser && !seededMonths.current.has(month)) {
      seededMonths.current.add(month);
      seedMonth({userId: currentUser._id, month});
    }
  }, [entries, currentUser, month]);

  const expectedTotal = useMemo(() => {
    if (!entries) return 0;
    return entries.reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const receivedTotal = useMemo(() => {
    if (!entries) return 0;
    return entries.filter(e => e.isConfirmed).reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const progressPercent = expectedTotal > 0
    ? Math.min(100, (receivedTotal / expectedTotal) * 100)
    : 0;

  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  const handleAdd = async () => {
    const amt = parseFloat(newAmount);
    if (!amt || amt <= 0 || !currentUser) return;
    try {
      await addEntry({
        userId: currentUser._id,
        month,
        amount: amt,
        note: newNote || undefined,
      });
      // Recalculate if current month
      if (isCurrentMonth) {
        await recalculateDistribution({userId: currentUser._id}).catch(() => {});
      }
      setNewAmount('');
      setNewNote('');
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Failed to add income:', err);
    }
  };

  const handleDelete = async (entryId: string) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Remove this income for this month?')
      : true;
    if (!confirm) return;
    try {
      await removeEntry({entryId: entryId as any});
      if (isCurrentMonth && currentUser) {
        await recalculateDistribution({userId: currentUser._id}).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to remove income:', err);
    }
  };

  const handleToggleConfirm = async (entryId: string) => {
    try {
      await toggleConfirm({entryId: entryId as any});
      // Recalculate distribution when confirming income for current month
      if (isCurrentMonth && currentUser) {
        await recalculateDistribution({userId: currentUser._id}).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to toggle confirm:', err);
    }
  };

  const handleRecalculate = async () => {
    if (!currentUser) return;
    try {
      await recalculateDistribution({userId: currentUser._id});
    } catch (err: any) {
      console.error('Failed to recalculate:', err);
    }
  };

  const startEdit = (entry: any) => {
    setEditingId(entry._id);
    setEditAmount(String(entry.amount));
    setEditNote(entry.note || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) return;
    try {
      await updateEntry({
        entryId: editingId as any,
        amount: amt,
        note: editNote || undefined,
      });
      if (isCurrentMonth && currentUser) {
        await recalculateDistribution({userId: currentUser._id}).catch(() => {});
      }
      setEditingId(null);
    } catch (err: any) {
      console.error('Failed to update income:', err);
    }
  };

  // Only show full-page loader on initial auth load, not when switching months
  if (currentUser === undefined) {
    return (
      <View style={styles.container}>
        <PotteryLoader />
      </View>
    );
  }

  // Use empty array while loading a new month's data (prevents drawer re-layout)
  const displayEntries = entries ?? [];

  const content = (
    <View style={styles.container}>
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
                backgroundColor: receivedTotal >= expectedTotal && expectedTotal > 0
                  ? theme.colors.success : theme.colors.primary,
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

        {/* Allocation Status — only show for current month */}
        {isCurrentMonth && distributionStatus && (
          <TouchableOpacity
            style={styles.allocationBadge}
            onPress={handleRecalculate}
            activeOpacity={0.7}>
            <View style={[
              styles.allocationIcon,
              {backgroundColor: distributionStatus.totalFunded > 0 ? theme.colors.success : theme.colors.primary},
            ]}>
              <ArrowDownToLine size={14} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View style={{flex: 1}}>
              {distributionStatus.totalFunded > 0 ? (
                <>
                  <Text style={styles.allocationTitle}>Allocated to cups</Text>
                  <Text style={styles.allocationDetail}>
                    ${distributionStatus.totalFunded.toFixed(2)} distributed across your cups
                    {distributionStatus.unallocated > 0
                      ? ` · $${distributionStatus.unallocated.toFixed(2)} unallocated`
                      : ''}
                    {distributionStatus.isOverPlanned
                      ? ` · over-planned by $${distributionStatus.overPlannedBy.toFixed(2)}`
                      : ''}
                  </Text>
                  <Text style={styles.allocationHint}>Tap to recalculate</Text>
                </>
              ) : expectedTotal > 0 ? (
                <>
                  <Text style={styles.allocationTitle}>Not yet allocated</Text>
                  <Text style={styles.allocationDetail}>
                    ${expectedTotal.toFixed(2)} ready to distribute
                  </Text>
                  <Text style={styles.allocationHint}>Tap to allocate to cups</Text>
                </>
              ) : (
                <>
                  <Text style={styles.allocationTitle}>No income to allocate</Text>
                  <Text style={styles.allocationDetail}>Add income above first</Text>
                </>
              )}
            </View>
            {distributionStatus.totalFunded > 0 && (
              <View style={styles.allocationCheck}>
                <Check size={16} color={theme.colors.success} strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Income Entries for this month */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>{format(selectedMonth, 'MMMM')} Income</Text>
            <TouchableOpacity onPress={() => setShowAddForm(true)}>
              <Plus size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {displayEntries.length === 0 && !showAddForm && (
            <TouchableOpacity
              style={styles.emptyCard}
              onPress={() => setShowAddForm(true)}>
              <Text style={styles.emptyText}>
                Add your income for this month
              </Text>
              <Text style={styles.emptySubtext}>
                e.g., Salary, Freelance, Side gig
              </Text>
            </TouchableOpacity>
          )}

          {displayEntries.map((entry, index) => (
            <View
              key={entry._id}
              style={[
                styles.entryRow,
                index < displayEntries.length - 1 && styles.entryRowBorder,
              ]}>
              {/* Confirm checkbox */}
              <TouchableOpacity
                style={[styles.checkCircle, entry.isConfirmed && styles.checkCircleActive]}
                onPress={() => handleToggleConfirm(entry._id)}>
                {entry.isConfirmed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
              </TouchableOpacity>

              <View style={styles.entryInfo}>
                <Text style={[styles.entryName, entry.isConfirmed && styles.entryNameConfirmed]}>
                  {entry.note || 'Income'}
                </Text>
                <Text style={styles.entryAmount}>
                  ${entry.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                </Text>
                {entry.isConfirmed && entry.confirmedAt && (
                  <Text style={styles.confirmedDate}>
                    Received {new Date(entry.confirmedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>

              {/* Edit button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => startEdit(entry)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Pencil size={15} color={theme.colors.textTertiary} />
              </TouchableOpacity>

              {/* Delete button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDelete(entry._id)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Trash2 size={15} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Inline add form */}
          {showAddForm && (
            <View style={styles.inlineForm}>
              <View style={styles.inlineFormRow}>
                <View style={[styles.amountContainer, {flex: 1}]}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={newAmount}
                    onChangeText={setNewAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textTertiary}
                    autoFocus
                  />
                </View>
              </View>
              <TextInput
                style={styles.noteInput}
                value={newNote}
                onChangeText={setNewNote}
                placeholder="e.g., Salary, Freelance"
                placeholderTextColor={theme.colors.textTertiary}
              />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => {setShowAddForm(false); setNewAmount(''); setNewNote('');}}>
                  <Text style={styles.inlineCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineSaveBtn, (!newAmount || parseFloat(newAmount) <= 0) && {opacity: 0.4}]}
                  onPress={handleAdd}>
                  <Text style={styles.inlineSaveText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{height: 40}} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editingId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Income</Text>

            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textTertiary}
                autoFocus
              />
            </View>

            <TextInput
              style={[styles.noteInput, {marginTop: 10}]}
              value={editNote}
              onChangeText={setEditNote}
              placeholder="e.g., Salary, Freelance"
              placeholderTextColor={theme.colors.textTertiary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingId(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, (!editAmount || parseFloat(editAmount) <= 0) && {opacity: 0.4}]}
                onPress={handleSaveEdit}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
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

  // Allocation badge
  allocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  allocationIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allocationTitle: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 2,
  },
  allocationDetail: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
  },
  allocationHint: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.primary,
    marginTop: 4,
  },
  allocationCheck: {
    marginLeft: 4,
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

  // Entry rows
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  entryRowBorder: {
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
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 17,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 2,
  },
  entryNameConfirmed: {
    color: theme.colors.textSecondary,
  },
  entryAmount: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: theme.colors.text,
  },
  confirmedDate: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.success,
    marginTop: 2,
  },
  actionBtn: {
    padding: 8,
  },

  // Empty state
  emptyCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
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
    marginBottom: 14,
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
