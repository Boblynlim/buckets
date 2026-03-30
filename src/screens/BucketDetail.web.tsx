import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2 } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { formatDistanceToNow } from 'date-fns';
import type { Bucket, Expense } from '../types';
import { getCupForBucketId } from '../constants/bucketIcons';

import { PotteryLoader } from '../components/PotteryLoader';
import { theme } from '../theme';
import { computeBucketHealth, healthColors, dismissInsight, isInsightDismissed } from '../utils/bucketHealth';

// ── Sound helper ──────────────────────────────────────────────
// Pentatonic scale frequencies — always harmonious, no bad combos
const CHIME_NOTES = [
  987.77,  // B5
  1108.73, // C#6
  1174.66, // D6
  1318.51, // E6
  1479.98, // F#6
  1567.98, // G6
  1760.00, // A6
  1975.53, // B6
  2217.46, // C#7
  2349.32, // D7
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
      harmonic.frequency.value = freq * 2.02; // slightly detuned octave shimmer

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

    // Pick 2 random notes — quick and snappy
    const shuffled = [...CHIME_NOTES].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 2);

    chime(picked[0], 0, 0.4 + Math.random() * 0.2, 0.09);
    chime(picked[1], 0.05 + Math.random() * 0.06, 0.35 + Math.random() * 0.15, 0.06);
  } catch (_) {}
};

const playNotWorthItSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;

    const tone = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = 'triangle'; // softer, muted timbre
      osc.frequency.setValueAtTime(freq, t + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + start + dur); // slide down

      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);

      osc.connect(g).connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + start + dur);
    };

    // Two descending notes — soft "boop boop"
    tone(520, 0, 0.25, 0.08);
    tone(380, 0.08, 0.3, 0.06);
  } catch (_) {}
};

// ── Confetti particles (portal to body, positioned at button) ──
const CONFETTI_COLORS = ['#c4d4bc', '#b5c9ad', '#a8bca0', '#d0d8c6', '#B8986A', '#C2BDB0'];

interface ConfettiState {
  id: number;
  x: number;
  y: number;
}

const ConfettiParticle: React.FC<{
  cx: number; cy: number; delay: number; color: string; size: number;
  dx: number; dy: number;
}> = ({ cx, cy, delay, color, size, dx, dy }) => (
  <motion.div
    style={{
      position: 'fixed',
      width: size,
      height: size,
      borderRadius: Math.random() > 0.5 ? '50%' : 2,
      backgroundColor: color,
      left: cx,
      top: cy,
      pointerEvents: 'none' as any,
      zIndex: 9999,
    }}
    initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
    animate={{
      x: dx,
      y: dy,
      opacity: 0,
      scale: 0.2,
      rotate: Math.random() * 540 - 270,
    }}
    transition={{
      duration: 0.55 + Math.random() * 0.25,
      delay,
      ease: [0.25, 0.46, 0.45, 0.94],
    }}
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
              cx={burst.x}
              cy={burst.y}
              dx={Math.cos(angle) * dist}
              dy={Math.sin(angle) * dist - 20}
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

interface BucketDetailProps {
  visible: boolean;
  bucket: Bucket;
  onBack: () => void;
  onEditBucket?: (bucket: Bucket, suggestedAmount?: number) => void;
  onEditExpense?: (expense: Expense, bucket: Bucket) => void;
  onAddExpense?: (bucket: Bucket) => void;
}

export const BucketDetail: React.FC<BucketDetailProps> = ({
  visible,
  bucket,
  onBack,
  onEditBucket,
  onEditExpense,
  onAddExpense,
}) => {
  const [dismissedKey, setDismissedKey] = React.useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  // Collapse progress: 0 = expanded, 1 = fully collapsed
  const collapse = Math.min(1, scrollY / 120);
  const isSaveBucket = bucket.bucketMode === 'save';

  const expenses = useQuery(api.expenses.getByBucket, { bucketId: bucket._id as any });

  let displayLabel = '';
  let displayAmount = 0;
  let displaySubtext = '';
  let allocationText = '';

  if (isSaveBucket) {
    const currentBalance = bucket.currentBalance || 0;
    const targetAmount = bucket.targetAmount || 0;
    displayLabel = 'CURRENT SAVINGS';
    displayAmount = currentBalance;
    displaySubtext = `$${currentBalance.toFixed(2)} saved of $${targetAmount.toFixed(2)}`;

    if (bucket.contributionType !== 'none') {
      const contribution = bucket.contributionType === 'amount'
        ? `$${(bucket.contributionAmount || 0).toFixed(2)}`
        : `${(bucket.contributionPercent || 0)}% of income`;
      allocationText = `Monthly contribution: ${contribution}`;
    }
  } else {
    // Derive totalSpent from the reactive expenses query, filtered to current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const totalSpent = (expenses || [])
      .filter(e => e.date >= monthStart && e.date <= monthEnd)
      .reduce((sum, e) => sum + e.amount, 0);
    const allocated = bucket.fundedAmount || 0;
    const carryover = bucket.carryoverBalance || 0;
    const totalAvailable = allocated + carryover;
    const remaining = totalAvailable - totalSpent;

    displayLabel = 'TOTAL SPENT';
    displayAmount = totalSpent;
    displaySubtext = `$${remaining.toFixed(2)} remaining of $${totalAvailable.toFixed(2)}`;
    allocationText = `Allocated this month: $${allocated.toFixed(2)}`;
  }
  const toggleWorthItMutation = useMutation(api.expenses.toggleWorthIt);
  const markNoteAsNecessaryMutation = useMutation(api.expenses.markNoteAsNecessary);
  const markNecessaryMutation = useMutation(api.expenses.markNecessary);
  const [confettiBursts, setConfettiBursts] = React.useState<ConfettiState[]>([]);
  const confettiIdRef = useRef(0);

  // Necessary confirmation popup
  const [necessaryPopup, setNecessaryPopup] = React.useState<{
    expense: any;
    matchCount: number;
  } | null>(null);

  // Optimistic local overrides — instantly reflect toggled state before server responds
  const [optimisticToggles, setOptimisticToggles] = React.useState<Record<string, boolean>>({});
  const [optimisticNecessary, setOptimisticNecessary] = React.useState<Record<string, boolean>>({});

  // Clear optimistic state when server data updates
  const prevExpensesRef = useRef(expenses);
  React.useEffect(() => {
    if (expenses !== prevExpensesRef.current && expenses !== undefined) {
      prevExpensesRef.current = expenses;
      setOptimisticToggles({});
      setOptimisticNecessary({});
    }
  }, [expenses]);

  const expensesList = (expenses || []).map(e => ({
    ...e,
    worthIt: e._id in optimisticToggles ? optimisticToggles[e._id] : e.worthIt,
    isNecessary: e._id in optimisticNecessary ? optimisticNecessary[e._id] : (e as any).isNecessary,
  }));

  // Tug-of-war only counts non-necessary expenses
  const discretionary = expensesList.filter(e => !e.isNecessary);
  const worthItExpenses = discretionary.filter(e => e.worthIt);
  const notWorthItExpenses = discretionary.filter(e => !e.worthIt);
  const worthItTotal = worthItExpenses.reduce((sum, e) => sum + e.amount, 0);
  const notWorthItTotal = notWorthItExpenses.reduce((sum, e) => sum + e.amount, 0);
  const necessaryTotal = expensesList.filter(e => e.isNecessary).reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = worthItTotal + notWorthItTotal;
  const worthItPct = grandTotal > 0 ? Math.round((worthItTotal / grandTotal) * 100) : 0;
  const notWorthItPct = grandTotal > 0 ? 100 - worthItPct : 0;

  const handleToggleWorthIt = useCallback((expense: (typeof expensesList)[0], e: React.MouseEvent) => {
    if (expense.isNecessary) return; // Can't toggle worth-it on necessary expenses
    const willBeWorthIt = !expense.worthIt;

    // Optimistic update — bar + pill update instantly
    setOptimisticToggles(prev => ({ ...prev, [expense._id]: willBeWorthIt }));

    // Fire mutation (server catches up)
    toggleWorthItMutation({ expenseId: expense._id as any });

    if (willBeWorthIt) {
      playWorthItSound();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const burst: ConfettiState = {
        id: ++confettiIdRef.current,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      setConfettiBursts(prev => [...prev, burst]);
      setTimeout(() => {
        setConfettiBursts(prev => prev.filter(b => b.id !== burst.id));
      }, 1000);
    } else {
      playNotWorthItSound();
    }
  }, [toggleWorthItMutation]);

  // Long-press handler for marking necessary
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePillPointerDown = useCallback((expense: (typeof expensesList)[0]) => {
    longPressTimerRef.current = setTimeout(() => {
      // Count how many expenses share this note
      const normalizedNote = expense.note.toLowerCase().trim();
      const matchCount = (expenses || []).filter(
        (e: any) => e.note.toLowerCase().trim() === normalizedNote
      ).length;

      if (expense.isNecessary) {
        // Undo necessary — just mark this note as not necessary
        const optimisticIds = (expenses || []).filter(
          (e: any) => e.note.toLowerCase().trim() === normalizedNote
        ).map((e: any) => e._id);
        optimisticIds.forEach((id: string) => {
          setOptimisticNecessary(prev => ({ ...prev, [id]: false }));
        });
        markNoteAsNecessaryMutation({
          userId: expense.userId as any,
          note: expense.note,
          isNecessary: false,
        });
      } else {
        // Show confirmation popup
        setNecessaryPopup({ expense, matchCount });
      }
    }, 500);
  }, [expenses, markNoteAsNecessaryMutation]);

  const handlePillPointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleConfirmNecessary = useCallback((applyToAll: boolean) => {
    if (!necessaryPopup) return;
    const { expense } = necessaryPopup;

    if (applyToAll) {
      // Optimistically mark all matching expenses
      const normalizedNote = expense.note.toLowerCase().trim();
      const matchingIds = (expenses || []).filter(
        (e: any) => e.note.toLowerCase().trim() === normalizedNote
      ).map((e: any) => e._id);
      matchingIds.forEach((id: string) => {
        setOptimisticNecessary(prev => ({ ...prev, [id]: true }));
      });
      markNoteAsNecessaryMutation({
        userId: expense.userId as any,
        note: expense.note,
        isNecessary: true,
      });
    } else {
      // Just this one
      setOptimisticNecessary(prev => ({ ...prev, [expense._id]: true }));
      markNecessaryMutation({
        expenseId: expense._id as any,
        isNecessary: true,
      });
    }
    setNecessaryPopup(null);
  }, [necessaryPopup, expenses, markNoteAsNecessaryMutation, markNecessaryMutation]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onBack}
    >
    <motion.div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#EAE3D5',
      }}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <div style={{ paddingTop: 'env(safe-area-inset-top, 0px)' } as any}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bucket Detail</Text>
        {onEditBucket ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEditBucket(bucket)}
          >
            <Edit2 size={20} color="#5C8A7A" strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
      </div>{/* end header safe area */}

      {/* Collapsible Bucket Info */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: collapse > 0.5 ? 10 : 8 * (1 - collapse),
        paddingBottom: collapse > 0.5 ? 10 : 12 * (1 - collapse),
        overflow: 'hidden',
        transition: 'padding 0.05s ease-out',
      }}>
        {/* Row layout when collapsed, column when expanded */}
        <div style={{
          display: 'flex',
          flexDirection: collapse > 0.5 ? 'row' : 'column',
          alignItems: 'center',
          gap: collapse > 0.5 ? 12 : 0,
          width: '100%',
          justifyContent: 'center',
        }}>
          <Image
            source={getCupForBucketId(bucket._id, bucket.icon)}
            style={{
              width: 72 - (collapse * 24),
              height: 72 - (collapse * 24),
              marginBottom: collapse > 0.5 ? 0 : 8 * (1 - collapse),
            }}
            resizeMode="contain"
          />
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: collapse > 0.5 ? 'flex-start' : 'center',
          }}>
            <Text style={{
              fontSize: 22 - (collapse * 4),
              fontWeight: '500' as any,
              color: '#3D3229',
              fontFamily: 'Merchant',
              letterSpacing: -0.5,
            }}>{bucket.name}</Text>
            {collapse > 0.3 && (
              <Text style={{
                fontSize: 16,
                fontWeight: '400' as any,
                color: '#1a3a2e',
                fontFamily: 'Merchant Copy',
                opacity: collapse,
              }}>${displayAmount.toFixed(2)} <Text style={{ fontSize: 13, color: 'rgba(20,50,40,0.5)' }}>{displayLabel.toLowerCase()}</Text></Text>
            )}
          </div>
        </div>

        {/* Spent card — fades out as you scroll */}
        <div style={{
          maxHeight: collapse > 0.8 ? 0 : 200,
          opacity: 1 - (collapse * 1.5),
          overflow: 'hidden',
          transition: 'max-height 0.15s ease-out, opacity 0.1s ease-out',
          width: '100%',
          marginTop: collapse > 0.8 ? 0 : 14 * (1 - collapse),
        }}>
        <div style={{
          borderRadius: 16,
          padding: '16px 24px',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#cdd5c4',
          boxShadow: 'inset 0 0 30px rgba(255,255,255,0.35), inset -3px -5px 14px rgba(40,50,20,0.05), 0 2px 8px rgba(100,100,80,0.06)',
        } as any}>
          {/* Glaze layers — warm sage celadon pooling */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: [
              /* sage pooling at center-bottom */
              'radial-gradient(ellipse at 45% 60%, rgba(138,154,120,0.3) 0%, rgba(138,154,120,0.12) 25%, transparent 55%)',
              /* warm green upper-left */
              'radial-gradient(ellipse at 25% 30%, rgba(142,160,128,0.2) 0%, transparent 45%)',
              /* subtle pooling upper-right */
              'radial-gradient(ellipse at 75% 35%, rgba(148,165,132,0.18) 0%, transparent 40%)',
              /* stoneware warmth at bottom */
              'radial-gradient(ellipse at 50% 110%, rgba(215,208,195,0.4) 0%, transparent 50%)',
              /* base warm sage gradient */
              'linear-gradient(180deg, #bccdb4 0%, #c2d0ba 25%, #c8d4c0 50%, #ccd6c4 75%, #d0d8c6 100%)',
            ].join(', '),
            borderRadius: 16,
          }} />
          {/* Noise texture overlay */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: "url('/noise.png')",
            backgroundSize: '150px 150px',
            backgroundRepeat: 'repeat',
            opacity: 0.35,
            mixBlendMode: 'overlay' as any,
            borderRadius: 16,
            pointerEvents: 'none',
          }} />
          {/* SVG grain + iron speckles */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" fill="none">
              <defs>
                <filter id="detailGlaze">
                  <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="5" stitchTiles="stitch" seed="3" />
                  <feColorMatrix type="saturate" values="0" />
                  <feBlend in="SourceGraphic" mode="overlay" />
                </filter>
              </defs>
              <rect width="400" height="160" filter="url(#detailGlaze)" opacity="0.15" />
              {/* Iron speckles — dark flecks like kiln marks */}
              <circle cx="28" cy="18" r="1.5" fill="#3c230f" opacity="0.45" />
              <circle cx="95" cy="12" r="1" fill="#4a2818" opacity="0.35" />
              <circle cx="175" cy="28" r="1.8" fill="#3c230f" opacity="0.4" />
              <circle cx="260" cy="8" r="1.2" fill="#4a2818" opacity="0.3" />
              <circle cx="340" cy="22" r="1.4" fill="#3c230f" opacity="0.45" />
              <circle cx="55" cy="55" r="1.1" fill="#4a2818" opacity="0.35" />
              <circle cx="150" cy="70" r="1.6" fill="#3c230f" opacity="0.3" />
              <circle cx="230" cy="48" r="1" fill="#4a2818" opacity="0.4" />
              <circle cx="310" cy="65" r="1.3" fill="#3c230f" opacity="0.35" />
              <circle cx="380" cy="42" r="1.1" fill="#4a2818" opacity="0.3" />
              <circle cx="42" cy="100" r="1.4" fill="#3c230f" opacity="0.4" />
              <circle cx="120" cy="115" r="1" fill="#4a2818" opacity="0.35" />
              <circle cx="200" cy="95" r="1.5" fill="#3c230f" opacity="0.3" />
              <circle cx="285" cy="120" r="1.2" fill="#4a2818" opacity="0.4" />
              <circle cx="365" cy="105" r="1" fill="#3c230f" opacity="0.35" />
              <circle cx="70" cy="140" r="1.3" fill="#4a2818" opacity="0.3" />
              <circle cx="160" cy="145" r="1.1" fill="#3c230f" opacity="0.4" />
              <circle cx="330" cy="140" r="1.4" fill="#4a2818" opacity="0.35" />
            </svg>
          </div>
          {/* Copper rim line */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent 5%, rgba(160,112,74,0.3) 25%, rgba(184,134,90,0.2) 50%, rgba(160,112,74,0.3) 75%, transparent 95%)',
            borderRadius: '16px 16px 0 0',
          }} />
          {/* Glaze shimmer — slow highlight sweep */}
          <motion.div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.18) 55%, transparent 70%)',
              borderRadius: 16,
              pointerEvents: 'none' as any,
            }}
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 3.5,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatDelay: 6,
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Text style={styles.spentLabel}>{displayLabel}</Text>
            <Text style={styles.spentAmount}>{'$'}{displayAmount.toFixed(2)}</Text>
            <Text style={styles.remainingText}>{displaySubtext}</Text>
            {allocationText ? (
              <Text style={styles.allocationText}>{allocationText}</Text>
            ) : null}
          </div>
        </div>
        </div>{/* end spent card fade wrapper */}
      </div>{/* end collapsible bucket info */}

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          WebkitOverflowScrolling: 'touch',
        } as any}
        onScroll={(e: any) => {
          setScrollY(e.currentTarget.scrollTop);
        }}
      >
      <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)' } as any}>

      {/* Health suggestion pill */}
      {(() => {
        const health = computeBucketHealth(bucket, expensesList as Expense[]);
        if (health.status === 'healthy') return null;
        if (isInsightDismissed(bucket._id, health) || dismissedKey === `${bucket._id}:${health.status}:${health.reason}`) return null;
        const color = healthColors[health.status];
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginHorizontal: 20 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
                backgroundColor: `${color}15`,
                borderRadius: 20,
                paddingVertical: 10,
                paddingLeft: 16,
                paddingRight: 14,
                gap: 8,
                borderWidth: 1,
                borderColor: `${color}30`,
              }}
              onPress={() => {
                if (onEditBucket) onEditBucket(bucket, health.suggestedAmount);
              }}
              activeOpacity={0.7}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, flexShrink: 0 }} />
              <Text style={{
                fontSize: 15,
                fontFamily: 'Merchant',
                color: '#3D3229',
                flex: 1,
              }}>
                {health.suggestion || health.detail}
              </Text>
              <Text style={{
                fontSize: 14,
                fontFamily: 'Merchant',
                fontWeight: '600',
                color,
                flexShrink: 0,
              }}>
                Adjust
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                dismissInsight(bucket._id, health);
                setDismissedKey(`${bucket._id}:${health.status}:${health.reason}`);
              }}
              style={{ padding: 6 }}
              activeOpacity={0.5}
            >
              <Text style={{ fontSize: 18, color: theme.colors.textTertiary }}>×</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Tug-of-War Bar — minimal, rounded, lava lamp liquid */}
      {expensesList.length > 0 && (
        <div style={{
          marginLeft: 20, marginRight: 20, marginBottom: 16,
        } as any}>
          {/* Bar track — rounded pill */}
          <div style={{
            position: 'relative',
            height: 16,
            borderRadius: 8,
            overflow: 'hidden',
            background: 'rgba(61,50,41,0.06)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'row',
            gap: (notWorthItPct === 0 || worthItPct === 0) ? 0 : 2,
          }}>
            {/* Not-worth-it side — warm terracotta clay */}
            <motion.div
              style={{
                height: '100%',
                borderRadius: worthItPct === 0 ? '8px' : '8px 3px 3px 8px',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(212,184,154,0.45) 0%, rgba(201,168,130,0.4) 50%, rgba(193,160,122,0.35) 100%)',
                boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.25)',
              }}
              animate={{ flex: notWorthItPct === 0 ? 0 : Math.max(notWorthItPct, 3) }}
              transition={{ type: 'spring', stiffness: 100, damping: 16, mass: 1 }}
            >
              {/* Lava lamp blob — morphing warm highlight */}
              <motion.div
                style={{
                  position: 'absolute',
                  width: '140%',
                  height: '200%',
                  top: '-50%',
                  left: '-20%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255,220,180,0.2) 0%, rgba(200,160,120,0.08) 40%, transparent 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  filter: 'blur(5px)',
                }}
                animate={{
                  x: ['0%', '15%', '-10%', '5%', '0%'],
                  y: ['0%', '-8%', '12%', '-5%', '0%'],
                  scaleX: [1, 1.15, 0.9, 1.1, 1],
                  scaleY: [1, 0.85, 1.2, 0.95, 1],
                }}
                transition={{
                  duration: 6,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatType: 'mirror',
                }}
              />
              {/* Glass highlight */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)',
                borderRadius: '8px 3px 0 0',
                pointerEvents: 'none',
              }} />
            </motion.div>

            {/* Worth-it side — celadon with lava lamp blob */}
            <motion.div
              style={{
                height: '100%',
                borderRadius: notWorthItPct === 0 ? '8px' : '3px 8px 8px 3px',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #a8d4c4 0%, #96c9b8 50%, #8ac0ae 100%)',
                boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), 0 0 8px rgba(130,200,180,0.25)',
              }}
              animate={{ flex: worthItPct === 0 ? 0 : Math.max(worthItPct, 3) }}
              transition={{ type: 'spring', stiffness: 100, damping: 16, mass: 1 }}
            >
              {/* Lava lamp blob — morphing celadon highlight */}
              <motion.div
                style={{
                  position: 'absolute',
                  width: '140%',
                  height: '200%',
                  top: '-50%',
                  left: '-20%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.35) 0%, rgba(140,210,190,0.2) 40%, transparent 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  filter: 'blur(6px)',
                }}
                animate={{
                  x: ['0%', '-12%', '18%', '-5%', '0%'],
                  y: ['0%', '10%', '-8%', '6%', '0%'],
                  scaleX: [1, 0.88, 1.18, 0.95, 1],
                  scaleY: [1, 1.15, 0.85, 1.08, 1],
                }}
                transition={{
                  duration: 7,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatType: 'mirror',
                }}
              />
              {/* Glass highlight */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
                borderRadius: '3px 8px 0 0',
                pointerEvents: 'none',
              }} />
              {/* Bottom pooling glow */}
              <motion.div
                style={{
                  position: 'absolute',
                  bottom: '-20%',
                  left: '15%',
                  right: '15%',
                  height: '60%',
                  background: 'radial-gradient(ellipse at 50% 80%, rgba(80,160,140,0.2) 0%, transparent 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  filter: 'blur(3px)',
                }}
                animate={{
                  scaleX: [1, 1.2, 0.9, 1],
                  x: ['0%', '8%', '-5%', '0%'],
                }}
                transition={{
                  duration: 5,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatType: 'mirror',
                }}
              />
            </motion.div>
          </div>

          {/* Percentages + counts below bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginTop: 8, paddingLeft: 2, paddingRight: 2,
          } as any}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 } as any}>
              <motion.span
                key={`nw-${notWorthItPct}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                style={{
                  fontSize: 17, fontFamily: 'Merchant Copy',
                  color: 'rgba(140,90,50,0.6)', fontWeight: '600',
                }}
              >
                {notWorthItPct}%
              </motion.span>
              <span style={{
                fontSize: 14, fontFamily: 'Merchant',
                color: 'rgba(140,90,50,0.4)',
              }}>
                ${notWorthItTotal.toFixed(2)} not worth it
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 } as any}>
              <motion.span
                key={`w-${worthItPct}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                style={{
                  fontSize: 17, fontFamily: 'Merchant Copy',
                  color: 'rgba(36,80,69,0.6)', fontWeight: '600',
                }}
              >
                {worthItPct}%
              </motion.span>
              <span style={{
                fontSize: 14, fontFamily: 'Merchant',
                color: 'rgba(36,80,69,0.4)',
              }}>
                ${worthItTotal.toFixed(2)} worth it
              </span>
            </div>
          </div>
          {/* Necessary total */}
          {necessaryTotal > 0 && (
            <div style={{
              textAlign: 'center' as any,
              marginTop: 6,
            }}>
              <span style={{
                fontSize: 14, fontFamily: 'Merchant',
                color: 'rgba(61,50,41,0.35)',
              }}>
                ${necessaryTotal.toFixed(2)} in necessary expenses
              </span>
            </div>
          )}
        </div>
      )}

      {/* Transactions Header */}
      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsTitle}>Transactions</Text>
        {onAddExpense && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAddExpense(bucket)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

        {expenses === undefined ? (
          <PotteryLoader message="Loading expenses..." />
        ) : expenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No expenses yet</Text>
            <Text style={styles.emptySubtext}>
              Start tracking expenses in this bucket
            </Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {expensesList.map((expense, i) => (
              <motion.div
                key={expense._id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.15 + i * 0.04,
                  duration: 0.3,
                  ease: 'easeOut',
                }}
              >
              <TouchableOpacity
                style={styles.transactionItem}
                onPress={() =>
                  onEditExpense && onEditExpense(expense, bucket)
                }
              >
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionName}>
                    {expense.note || 'Expense'}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDistanceToNow(new Date(expense.createdAt), {
                      addSuffix: true,
                    })}
                  </Text>
                </View>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 } as any}>
                  <Text style={styles.transactionAmount}>
                    ${expense.amount.toFixed(2)}
                  </Text>
                  <motion.button
                    onClick={(e: any) => {
                      e.stopPropagation?.();
                      if (!expense.isNecessary) {
                        handleToggleWorthIt(expense, e);
                      }
                    }}
                    onPointerDown={(e: any) => {
                      e.stopPropagation?.();
                      handlePillPointerDown(expense);
                    }}
                    onPointerUp={handlePillPointerUp}
                    onPointerLeave={handlePillPointerUp}
                    style={{
                      paddingTop: 5, paddingBottom: 5,
                      paddingLeft: 14, paddingRight: 14,
                      borderRadius: 12,
                      backgroundColor: expense.isNecessary
                        ? 'rgba(61,50,41,0.06)'
                        : expense.worthIt ? '#a0d0c0' : 'transparent',
                      border: `1.5px solid ${
                        expense.isNecessary
                          ? 'rgba(61,50,41,0.15)'
                          : expense.worthIt ? '#8ac4b2' : '#c9a882'
                      }`,
                      boxShadow: expense.worthIt && !expense.isNecessary
                        ? 'inset 0 1px 2px rgba(255,255,255,0.4), 0 0 6px rgba(130,200,180,0.2)'
                        : 'none',
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: 'Merchant',
                      fontSize: 13,
                      fontWeight: '600',
                      letterSpacing: 0.8,
                      color: expense.isNecessary
                        ? 'rgba(61,50,41,0.4)'
                        : expense.worthIt ? '#245045' : '#a08060',
                      position: 'relative',
                      overflow: 'visible',
                    }}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    {expense.isNecessary ? 'NECESSARY' : expense.worthIt ? 'WORTH IT' : 'WORTH IT?'}
                  </motion.button>
                </div>
              </TouchableOpacity>
              </motion.div>
            ))}
          </View>
        )}
      </div>{/* end scroll padding */}
      </div>{/* end scrollable content */}
      {/* Confetti particles */}
      <ButtonConfetti bursts={confettiBursts} />

      {/* Necessary confirmation popup */}
      <AnimatePresence>
        {necessaryPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
            onClick={() => setNecessaryPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e: any) => e.stopPropagation()}
              style={{
                backgroundColor: '#F5F0E7',
                borderRadius: 16,
                padding: '24px',
                maxWidth: 320,
                width: '85%',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                textAlign: 'center' as any,
              } as any}
            >
              <div style={{
                fontSize: 16, fontFamily: 'Merchant',
                color: '#3D3229', marginBottom: 8, fontWeight: '500',
              }}>
                Mark as necessary?
              </div>
              <div style={{
                fontSize: 14, fontFamily: 'Merchant',
                color: '#7A6E62', marginBottom: 20, lineHeight: '1.5',
              }}>
                {necessaryPopup.matchCount > 1
                  ? `Found ${necessaryPopup.matchCount} "${necessaryPopup.expense.note}" expenses. Mark all as necessary?`
                  : `Mark "${necessaryPopup.expense.note}" as necessary?`
                }
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
              } as any}>
                {necessaryPopup.matchCount > 1 && (
                  <motion.button
                    onClick={() => handleConfirmNecessary(true)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      backgroundColor: 'rgba(61,50,41,0.08)',
                      border: '1.5px solid rgba(61,50,41,0.15)',
                      cursor: 'pointer',
                      fontFamily: 'Merchant',
                      fontSize: 14, fontWeight: '600',
                      color: '#3D3229',
                      outline: 'none',
                    }}
                  >
                    Yes, all {necessaryPopup.matchCount} expenses
                  </motion.button>
                )}
                <motion.button
                  onClick={() => handleConfirmNecessary(false)}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    backgroundColor: 'transparent',
                    border: '1.5px solid rgba(61,50,41,0.12)',
                    cursor: 'pointer',
                    fontFamily: 'Merchant',
                    fontSize: 14, fontWeight: '500',
                    color: '#7A6E62',
                    outline: 'none',
                  }}
                >
                  Just this one
                </motion.button>
                <motion.button
                  onClick={() => setNecessaryPopup(null)}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Merchant',
                    fontSize: 13,
                    color: '#A89E92',
                    outline: 'none',
                  }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE3D5',
    width: '100%' as any,
    height: '100%' as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8C8',
    flexShrink: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#3D3229',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: '#3D3229',
    fontFamily: 'Merchant',
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  bucketInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  cupImage: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  bucketName: {
    fontSize: 22,
    fontWeight: '500',
    color: '#3D3229',
    marginBottom: 14,
    fontFamily: 'Merchant',
    letterSpacing: -0.5,
  },
  spentLabel: {
    fontSize: 13,
    color: 'rgba(20, 50, 40, 0.5)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: 'Merchant',
  },
  spentAmount: {
    fontSize: 30,
    fontWeight: '400',
    color: '#1a3a2e',
    fontFamily: 'Merchant Copy',
    letterSpacing: -1,
    marginBottom: 8,
  },
  remainingText: {
    fontSize: 16,
    color: 'rgba(20, 50, 40, 0.6)',
    fontFamily: 'Merchant Copy',
  },
  allocationText: {
    fontSize: 14,
    color: 'rgba(20, 50, 40, 0.4)',
    fontFamily: 'Merchant',
    marginTop: 8,
    fontStyle: 'italic',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexShrink: 0,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3D3229',
    fontFamily: 'Merchant',
    letterSpacing: -0.3,
  },
  addButton: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5C8A7A',
    fontFamily: 'Merchant',
  },
  transactionsList: {
    backgroundColor: '#F5F0E7',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0D8C8',
    marginHorizontal: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8C8',
  },
  transactionLeft: {
    flex: 1,
    marginRight: 12,
  },
  transactionName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#3D3229',
    marginBottom: 3,
    fontFamily: 'Merchant',
  },
  transactionDate: {
    fontSize: 14,
    color: '#7A6E62',
    fontFamily: 'Merchant',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '500',
    color: '#3D3229',
    fontFamily: 'Merchant Copy',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#3D3229',
    fontFamily: 'Merchant',
  },
  emptySubtext: {
    fontSize: 17,
    color: '#7A6E62',
    fontFamily: 'Merchant',
    textAlign: 'center',
  },
});
