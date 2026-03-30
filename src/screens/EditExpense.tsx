import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { motion } from 'framer-motion';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';
import { getCupForBucketId } from '../constants/bucketIcons';
import type { Expense, Bucket } from '../types';
import { DatePicker } from '../components/DatePicker';
import { Drawer } from '../components/Drawer';

// ── Sound (same pentatonic chime as BucketDetail) ────────────────────────
const CHIME_NOTES = [
  987.77, 1108.73, 1174.66, 1318.51, 1479.98,
  1567.98, 1760.00, 1975.53, 2217.46, 2349.32,
];

const playWorthItSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;
    const chime = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const g = ctx.createGain();
      const hg = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      harmonic.type = 'sine';
      harmonic.frequency.value = freq * 2.02;
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(vol * 0.3, t + start + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      hg.gain.setValueAtTime(vol * 0.12, t + start);
      hg.gain.exponentialRampToValueAtTime(0.001, t + start + dur * 0.6);
      osc.connect(g).connect(ctx.destination);
      harmonic.connect(hg).connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + start + dur);
      harmonic.start(t + start);
      harmonic.stop(t + start + dur);
    };
    const shuffled = [...CHIME_NOTES].sort(() => Math.random() - 0.5);
    chime(shuffled[0], 0, 0.4 + Math.random() * 0.2, 0.09);
    chime(shuffled[1], 0.05 + Math.random() * 0.06, 0.35 + Math.random() * 0.15, 0.06);
  } catch (_) {}
};

// ── Confetti ─────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#c4d4bc', '#b5c9ad', '#a8bca0', '#d0d8c6', '#B8986A', '#C2BDB0'];
interface ConfettiState { id: number; x: number; y: number; }

const ConfettiParticle: React.FC<{
  cx: number; cy: number; delay: number; color: string; size: number; dx: number; dy: number;
}> = ({ cx, cy, delay, color, size, dx, dy }) => (
  <motion.div
    style={{
      position: 'fixed', width: size, height: size,
      borderRadius: Math.random() > 0.5 ? '50%' : 2,
      backgroundColor: color, left: cx, top: cy,
      pointerEvents: 'none' as any, zIndex: 9999,
    }}
    initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
    animate={{ x: dx, y: dy, opacity: 0, scale: 0.2, rotate: Math.random() * 540 - 270 }}
    transition={{ duration: 0.55 + Math.random() * 0.25, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
  />
);

const ButtonConfetti: React.FC<{ bursts: ConfettiState[] }> = ({ bursts }) => {
  if (bursts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' as any, zIndex: 9999 }}>
      {bursts.map(burst =>
        Array.from({ length: 10 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.6;
          const dist = 30 + Math.random() * 40;
          return (
            <ConfettiParticle
              key={`${burst.id}-${i}`}
              cx={burst.x} cy={burst.y}
              dx={Math.cos(angle) * dist} dy={Math.sin(angle) * dist - 20}
              delay={Math.random() * 0.06}
              color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
              size={4 + Math.random() * 3}
            />
          );
        })
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────

type EditExpenseRouteProp = RouteProp<{ EditExpense: { expense: Expense; bucket: Bucket } }, 'EditExpense'>;

interface EditExpenseProps {
  visible?: boolean;
  expense?: Expense;
  bucket?: Bucket;
  onClose?: () => void;
}

export const EditExpense: React.FC<EditExpenseProps> = (props) => {
  let route: any = null;
  let navigation: any = null;
  try {
    const { useRoute, useNavigation } = require('@react-navigation/native');
    route = useRoute() as EditExpenseRouteProp;
    navigation = useNavigation();
  } catch (error) {}

  const expense = props.expense || route?.params?.expense;
  const bucket = props.bucket || route?.params?.bucket;
  const visible = props.visible !== undefined ? props.visible : true;
  const onClose = props.onClose || (() => navigation?.goBack());

  if (!expense || !bucket) return null;

  const [amount, setAmount] = useState((expense._id as any) === 'new' ? '' : expense.amount.toString());
  const [note, setNote] = useState(expense.note);
  const [worthIt, setWorthIt] = useState(expense.worthIt ?? false);
  const [isNecessary, setIsNecessary] = useState(expense.isNecessary ?? false);
  const [date, setDate] = useState(new Date(expense.date));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBucketPicker, setShowBucketPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confettiBursts, setConfettiBursts] = useState<ConfettiState[]>([]);
  const burstIdRef = useRef(0);

  const { user: currentUser } = useAuth();
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const createExpense = useMutation(api.expenses.create);
  const updateExpense = useMutation(api.expenses.update);
  const removeExpense = useMutation(api.expenses.remove);
  const isNewExpense = (expense._id as any) === 'new';

  const allBuckets = buckets || [];
  const [selectedBucket, setSelectedBucket] = useState(bucket);

  const getAvailableBalance = (b: any) => {
    if (!b) return 0;
    if (b.bucketMode === 'spend') {
      return (b.fundedAmount || 0) + (b.carryoverBalance || 0) - (b.spentAmount || 0);
    }
    return b.currentBalance || 0;
  };

  const handleWorthItPress = useCallback((e: any) => {
    if (worthIt) { setWorthIt(false); return; }
    setWorthIt(true);
    setIsNecessary(false);
    playWorthItSound();
    const rect = e?.currentTarget?.getBoundingClientRect?.();
    if (rect) {
      const id = ++burstIdRef.current;
      setConfettiBursts(prev => [...prev, { id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
      setTimeout(() => setConfettiBursts(prev => prev.filter(b => b.id !== id)), 1000);
    }
  }, [worthIt]);

  const isValid = amount && parseFloat(amount) > 0;

  const handleSave = async () => {
    if (isSaving) return;
    if (!isValid || !currentUser) { alert('Please enter a valid amount'); return; }

    try {
      setIsSaving(true);
      const newAmount = parseFloat(amount);

      if (isNewExpense) {
        await createExpense({
          userId: currentUser._id,
          bucketId: selectedBucket._id as any,
          amount: newAmount,
          date: date.getTime(),
          note: note.trim(),
          worthIt: isNecessary ? false : worthIt,
        });
      } else {
        await updateExpense({
          expenseId: expense._id as any,
          bucketId: selectedBucket._id as any,
          amount: newAmount,
          date: date.getTime(),
          note: note.trim(),
          worthIt: isNecessary ? false : worthIt,
          isNecessary,
        });
      }
      setIsSaving(false);
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Failed to save expense:', error);
      alert(error.message || 'Failed to save expense.');
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await removeExpense({ expenseId: expense._id as any });
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Failed to delete expense:', error);
      alert(error.message || 'Failed to delete expense.');
    }
  };

  const content = (
    <View style={styles.container}>
      <ButtonConfetti bursts={confettiBursts} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isNewExpense ? 'Add Expense' : 'Edit Expense'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={!isValid || isSaving}>
            <Text style={[styles.saveButton, (!isValid || isSaving) && styles.saveButtonDisabled]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date chip */}
        <View style={styles.dateChipRow}>
          <Pressable style={styles.dateChip} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateChipText}>
              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </Pressable>
        </View>

        {/* Hero Amount */}
        <View style={styles.amountHero}>
          <Text style={styles.amountCurrency}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="rgba(61,50,41,0.15)"
            textAlign="center"
          />
        </View>

        {/* Bucket Selector — tap to open grid */}
        <Pressable
          style={styles.bucketSelector}
          onPress={() => setShowBucketPicker(!showBucketPicker)}
        >
          {selectedBucket ? (
            <>
              <Image
                source={getCupForBucketId(selectedBucket._id, selectedBucket.icon)}
                style={styles.bucketSelectorImage}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.bucketSelectorName}>{selectedBucket.name}</Text>
                <Text style={styles.bucketSelectorBalance}>
                  ${getAvailableBalance(selectedBucket).toFixed(2)} available
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.bucketSelectorPlaceholder}>Select a bucket</Text>
          )}
        </Pressable>

        {/* Bucket Grid Picker */}
        {showBucketPicker && (
          <View style={styles.bucketGrid}>
            {allBuckets.map((b: any) => {
              const isSelected = selectedBucket?._id === b._id;
              return (
                <TouchableOpacity
                  key={b._id}
                  style={[styles.bucketGridItem, isSelected && styles.bucketGridItemSelected]}
                  onPress={() => { setSelectedBucket(b); setShowBucketPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={getCupForBucketId(b._id, b.icon)}
                    style={styles.bucketGridImage}
                    resizeMode="contain"
                  />
                  <Text style={[styles.bucketGridName, isSelected && styles.bucketGridNameSelected]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.bucketGridBalance}>
                    ${getAvailableBalance(b).toFixed(0)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Note */}
        <View style={styles.noteSection}>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="what did you buy?"
            placeholderTextColor="rgba(61,50,41,0.25)"
          />
        </View>

        {/* Worth It / Necessary — with sound + confetti */}
        <View style={styles.worthItSection}>
          <View style={styles.worthItRow}>
            <TouchableOpacity
              style={[styles.worthItBtn, !worthIt && !isNecessary && styles.worthItBtnNotWorth]}
              onPress={() => { setWorthIt(false); setIsNecessary(false); }}
            >
              <Text style={[styles.worthItBtnText, !worthIt && !isNecessary && styles.worthItBtnTextNotWorth]}>
                NOT WORTH IT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.worthItBtn, worthIt && styles.worthItBtnWorth]}
              onPress={handleWorthItPress}
            >
              <Text style={[styles.worthItBtnText, worthIt && styles.worthItBtnTextWorth]}>
                WORTH IT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.worthItBtn, isNecessary && styles.worthItBtnNecessary]}
              onPress={() => { setIsNecessary(true); setWorthIt(false); }}
            >
              <Text style={[styles.worthItBtnText, isNecessary && styles.worthItBtnTextNecessary]}>
                NECESSARY
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Button */}
        {!isNewExpense && (
          <View style={styles.deleteSection}>
            <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
              <Text style={styles.deleteButtonText}>Delete Expense</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Delete Confirmation */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Expense?</Text>
            <Text style={styles.modalMessage}>
              Delete this ${expense.amount.toFixed(2)} expense? The amount will be refunded to the bucket.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={confirmDelete}>
                <Text style={styles.modalButtonTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DatePicker
        visible={showDatePicker}
        selectedDate={date}
        onSelectDate={setDate}
        onClose={() => setShowDatePicker(false)}
      />
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
    backgroundColor: '#EAE3D5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: 'Merchant',
  },
  saveButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: 'Merchant',
    fontWeight: '500',
  },
  saveButtonDisabled: {
    color: '#B5AFA5',
  },

  // Date chip
  dateChipRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dateChip: {
    backgroundColor: 'rgba(61,50,41,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateChipText: {
    fontSize: 15,
    fontFamily: 'Merchant Copy',
    color: '#877E6F',
  },

  // Hero amount
  amountHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  amountCurrency: {
    fontSize: 32,
    fontFamily: 'Merchant Copy',
    color: 'rgba(61,50,41,0.3)',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: 'Merchant Copy',
    color: '#1A1A1A',
    letterSpacing: -2,
    minWidth: 120,
    paddingVertical: 0,
  },

  // Bucket selector
  bucketSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 8,
    paddingVertical: 12,
    gap: 12,
  },
  bucketSelectorImage: {
    width: 44,
    height: 44,
  },
  bucketSelectorName: {
    fontSize: 20,
    fontFamily: 'Merchant',
    color: '#1A1A1A',
  },
  bucketSelectorBalance: {
    fontSize: 16,
    fontFamily: 'Merchant Copy',
    color: '#8ac0ae',
    marginTop: 2,
  },
  bucketSelectorPlaceholder: {
    fontSize: 20,
    fontFamily: 'Merchant',
    color: 'rgba(61,50,41,0.25)',
  },

  // Bucket grid picker
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  bucketGridItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    width: '23%' as any,
    opacity: 0.6,
  },
  bucketGridItemSelected: {
    opacity: 1,
    backgroundColor: 'rgba(160,208,192,0.15)',
  },
  bucketGridImage: {
    width: 32,
    height: 32,
    marginBottom: 4,
  },
  bucketGridName: {
    fontSize: 12,
    fontFamily: 'Merchant',
    color: '#877E6F',
    textAlign: 'center',
  },
  bucketGridNameSelected: {
    color: '#245045',
    fontWeight: '500',
  },
  bucketGridBalance: {
    fontSize: 12,
    fontFamily: 'Merchant Copy',
    color: '#8ac0ae',
    marginTop: 1,
  },

  // Note
  noteSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  noteInput: {
    fontSize: 20,
    fontFamily: 'Merchant',
    color: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61,50,41,0.1)',
    paddingVertical: 12,
    textAlign: 'center',
  },

  // Worth it
  worthItSection: {
    paddingHorizontal: 24,
  },
  worthItRow: {
    flexDirection: 'row',
    gap: 8,
  },
  worthItBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(61,50,41,0.1)',
    alignItems: 'center',
  },
  worthItBtnNotWorth: {
    backgroundColor: 'rgba(212,184,154,0.3)',
    borderColor: '#c9a882',
  },
  worthItBtnWorth: {
    backgroundColor: '#a0d0c0',
    borderColor: '#8ac4b2',
  },
  worthItBtnNecessary: {
    backgroundColor: 'rgba(61,50,41,0.06)',
    borderColor: 'rgba(61,50,41,0.15)',
  },
  worthItBtnText: {
    fontSize: 12,
    fontFamily: 'Merchant',
    color: 'rgba(61,50,41,0.3)',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  worthItBtnTextNotWorth: {
    color: '#a08060',
  },
  worthItBtnTextWorth: {
    color: '#245045',
  },
  worthItBtnTextNecessary: {
    color: 'rgba(61,50,41,0.4)',
  },

  // Delete
  deleteSection: {
    alignItems: 'center',
    marginTop: 32,
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textOnPrimary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.border,
  },
  modalButtonDelete: {
    backgroundColor: theme.colors.danger,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.text,
  },
  modalButtonTextDelete: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textOnPrimary,
  },
});
