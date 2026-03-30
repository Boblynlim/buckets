import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';
import { getCupForBucketId } from '../constants/bucketIcons';
import { PotteryLoader } from '../components/PotteryLoader';
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

interface AddExpenseProps {
  visible?: boolean;
  onClose?: () => void;
}

export const AddExpense: React.FC<AddExpenseProps> = ({
  visible = true,
  onClose = () => {},
}) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [worthIt, setWorthIt] = useState(false);
  const [isNecessary, setIsNecessary] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showBucketPicker, setShowBucketPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confettiBursts, setConfettiBursts] = useState<ConfettiState[]>([]);
  const burstIdRef = useRef(0);

  const _now = new Date();
  const currentMonthStart = new Date(_now.getFullYear(), _now.getMonth(), 1).getTime();
  const currentMonthEnd = new Date(_now.getFullYear(), _now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  const { user: currentUser } = useAuth();
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser
      ? { userId: currentUser._id, monthStart: currentMonthStart, monthEnd: currentMonthEnd }
      : 'skip',
  );
  const createExpense = useMutation(api.expenses.create);
  const necessaryNotes = useQuery(
    api.expenses.getNecessaryNotes,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  const allBuckets = buckets || [];
  const [selectedBucket, setSelectedBucket] = useState(allBuckets[0]);

  React.useEffect(() => {
    if (allBuckets.length > 0 && !selectedBucket) {
      setSelectedBucket(allBuckets[0]);
    }
    if (selectedBucket && allBuckets.length > 0) {
      const updatedBucket = allBuckets.find((b: any) => b._id === selectedBucket._id);
      if (updatedBucket && updatedBucket.currentBalance !== selectedBucket.currentBalance) {
        setSelectedBucket(updatedBucket);
      }
    }
  }, [allBuckets]);

  // Auto-detect necessary based on remembered notes
  React.useEffect(() => {
    if (necessaryNotes && note.trim()) {
      const normalized = note.toLowerCase().trim();
      const isMatch = necessaryNotes.some((n: any) => n.note === normalized);
      setIsNecessary(isMatch);
      if (isMatch) setWorthIt(false);
    }
  }, [note, necessaryNotes]);

  const getAvailableBalance = (bucket: any) => {
    if (!bucket) return 0;
    if (bucket.bucketMode === 'spend') {
      return (bucket.fundedAmount || 0) + (bucket.carryoverBalance || 0) - (bucket.spentAmount || 0);
    }
    return bucket.currentBalance || 0;
  };

  const handleWorthItPress = useCallback((e: any) => {
    if (worthIt) {
      // Already worth it — toggle off
      setWorthIt(false);
      return;
    }
    setWorthIt(true);
    setIsNecessary(false);
    playWorthItSound();

    // Confetti from button position
    const rect = e?.currentTarget?.getBoundingClientRect?.();
    if (rect) {
      const id = ++burstIdRef.current;
      setConfettiBursts(prev => [...prev, { id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
      setTimeout(() => setConfettiBursts(prev => prev.filter(b => b.id !== id)), 1000);
    }
  }, [worthIt]);

  const handleSave = async () => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      if (currentUser === undefined) { setIsSaving(false); return; }
      if (!selectedBucket) { alert('Please select a bucket'); setIsSaving(false); return; }
      if (!amount || parseFloat(amount) <= 0) { alert('Please enter a valid amount'); setIsSaving(false); return; }

      await createExpense({
        userId: currentUser._id,
        bucketId: selectedBucket._id,
        amount: parseFloat(amount),
        date: date.getTime(),
        note,
        worthIt,
      });

      setAmount('');
      setNote('');
      setWorthIt(false);
      setIsNecessary(false);
      setDate(new Date());
      setIsSaving(false);
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Failed to create expense:', error);
      alert(error.message || 'Failed to add expense.');
      setIsSaving(false);
    }
  };

  const amountValue = parseFloat(amount) || 0;
  const availableBalance = selectedBucket ? getAvailableBalance(selectedBucket) : 0;
  const hasInsufficientBalance = selectedBucket && amountValue > availableBalance;
  const isValid = amount && amountValue > 0 && selectedBucket;

  if (currentUser === undefined || buckets === undefined) {
    return (
      <View style={styles.container}>
        <PotteryLoader message="Loading..." />
      </View>
    );
  }

  if (allBuckets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No buckets yet!</Text>
          <Text style={styles.emptySubtext}>Create a bucket first to track expenses.</Text>
        </View>
      </View>
    );
  }

  return (
    <Drawer visible={visible} onClose={onClose} fullScreen>
      <View style={styles.container}>
        <ButtonConfetti bursts={confettiBursts} />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Add Expense</Text>
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
                    ${availableBalance.toFixed(2)} available
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
              {allBuckets.map((bucket: any) => {
                const isSelected = selectedBucket?._id === bucket._id;
                return (
                  <TouchableOpacity
                    key={bucket._id}
                    style={[styles.bucketGridItem, isSelected && styles.bucketGridItemSelected]}
                    onPress={() => { setSelectedBucket(bucket); setShowBucketPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={getCupForBucketId(bucket._id, bucket.icon)}
                      style={styles.bucketGridImage}
                      resizeMode="contain"
                    />
                    <Text style={[styles.bucketGridName, isSelected && styles.bucketGridNameSelected]} numberOfLines={1}>
                      {bucket.name}
                    </Text>
                    <Text style={styles.bucketGridBalance}>
                      ${getAvailableBalance(bucket).toFixed(0)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Overspending info */}
          {hasInsufficientBalance && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {availableBalance === 0 && selectedBucket.bucketMode === 'spend'
                  ? 'This bucket isn\'t funded yet. Debt will carry forward.'
                  : `Overspending by $${(amountValue - availableBalance).toFixed(2)}. Debt rolls over.`}
              </Text>
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

          <View style={{ height: 60 }} />
        </ScrollView>

        <DatePicker
          visible={showDatePicker}
          selectedDate={date}
          onSelectDate={setDate}
          onClose={() => setShowDatePicker(false)}
        />
      </View>
    </Drawer>
  );
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

  // Info box
  infoBox: {
    backgroundColor: 'rgba(61,50,41,0.04)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    color: '#877E6F',
    fontFamily: 'Merchant',
    lineHeight: 20,
    textAlign: 'center',
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

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#3D3229',
    fontFamily: 'Merchant',
  },
  emptySubtext: {
    fontSize: 18,
    color: '#8A8478',
    fontFamily: 'Merchant',
    textAlign: 'center',
  },
});
