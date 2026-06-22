import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';
import { type } from '../theme/fonts';

type Props = {
  onBack?: () => void;
};

const BANK_LABELS: Record<string, string> = {
  dbs: 'DBS / POSB',
  ocbc: 'OCBC',
  hsbc: 'HSBC',
  amex: 'Amex',
  unknown: 'Unrecognised',
};

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// "2026-06" → "June 2026". Used as the month-section header.
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return key;
  }
}

// Calendar-month key ("YYYY-MM") for a timestamp, local time — matches how the
// rest of the app buckets months.
function monthKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type RowEdit = {
  amount: string;
  note: string;
  bucketId?: string;
  worthIt: boolean;
  isNecessary: boolean;
};

export function ReviewQueue({ onBack }: Props) {
  const { user: currentUser } = useAuth();
  const userId = currentUser?._id;

  const pending = useQuery(
    api.pendingTransactions.listPending,
    userId ? { userId } : 'skip'
  );
  const buckets = useQuery(
    api.buckets.getByUser,
    userId ? { userId } : 'skip'
  );
  const confirm = useMutation(api.pendingTransactions.confirm);
  const dismiss = useMutation(api.pendingTransactions.dismiss);

  // Per-row editable state, keyed by pending id.
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Which month sections are collapsed, keyed by "YYYY-MM".
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group pending rows into month sections, newest month first. Within a month
  // we keep the queue's ordering (needs-attention rows first, then newest), so
  // the items that need fixing still float to the top of their month.
  const monthGroups = useMemo(() => {
    if (!pending) return [];
    const map = new Map<string, any[]>();
    for (const row of pending) {
      const key = monthKeyOf(row.date);
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return [...map.keys()]
      .sort((a, b) => (a < b ? 1 : -1)) // newest month first
      .map((key) => {
        const rows = map.get(key)!.slice().sort((a, b) => {
          if (a.needsAttention !== b.needsAttention) {
            return a.needsAttention ? -1 : 1;
          }
          return b.date - a.date;
        });
        const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
        const currency = rows[0]?.currency ?? '';
        return { key, rows, total, currency };
      });
  }, [pending]);

  const toggleMonth = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const defaultsFor = (row: any): RowEdit => ({
    amount: String(row.amount ?? ''),
    note: row.merchant ?? '',
    bucketId: undefined,
    worthIt: false,
    isNecessary: false,
  });

  const getEdit = (row: any): RowEdit => edits[row._id] ?? defaultsFor(row);

  // Seed the fallback from the row's own values, not empty strings — otherwise
  // the first interaction on a card (e.g. tapping a bucket pill before editing
  // amount/note) would wipe the pre-filled amount and merchant.
  const setEdit = (row: any, patch: Partial<RowEdit>) =>
    setEdits((prev) => ({
      ...prev,
      [row._id]: { ...(prev[row._id] ?? defaultsFor(row)), ...patch },
    }));

  const handleConfirm = async (row: any) => {
    const e = getEdit(row);
    if (!e.bucketId) return;
    const amount = parseFloat(e.amount);
    if (!isFinite(amount) || amount <= 0) return;
    setBusyId(row._id);
    try {
      await confirm({
        pendingId: row._id,
        bucketId: e.bucketId as any,
        amount,
        note: e.note.trim() || undefined,
        worthIt: e.worthIt,
        isNecessary: e.isNecessary,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (row: any) => {
    setBusyId(row._id);
    try {
      await dismiss({ pendingId: row._id });
    } finally {
      setBusyId(null);
    }
  };

  const renderCard = (row: any) => {
    const e = getEdit(row);
    const isBusy = busyId === row._id;
    const notWorth = !e.worthIt && !e.isNecessary;
    return (
          <View
            key={row._id}
            style={[styles.card, row.needsAttention && styles.cardAttention]}
          >
            {row.needsAttention && (
              <View style={styles.attentionBanner}>
                <Text style={styles.attentionText}>
                  ⚠ Couldn’t fully read this one — check the amount and details
                </Text>
              </View>
            )}
            <View style={styles.cardTop}>
              <View style={styles.bankBadge}>
                <Text style={styles.bankBadgeText}>
                  {BANK_LABELS[row.bank] ?? row.bank}
                </Text>
              </View>
              <Text style={styles.dateText}>
                {formatDate(row.date)}
                {row.last4 ? `  ·  ····${row.last4}` : ''}
              </Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.label}>Amount ({row.currency})</Text>
              <TextInput
                style={styles.input}
                value={e.amount}
                onChangeText={(t) => setEdit(row, { amount: t })}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.label}>Note</Text>
              <TextInput
                style={styles.input}
                value={e.note}
                onChangeText={(t) => setEdit(row, { note: t })}
                placeholder="Merchant / description"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>

            <Text style={styles.label}>Bucket</Text>
            <View style={styles.bucketRow}>
              {(buckets ?? []).map((b: any) => {
                const selected = e.bucketId === b._id;
                return (
                  <TouchableOpacity
                    key={b._id}
                    onPress={() => setEdit(row, { bucketId: b._id })}
                    style={[
                      styles.bucketChip,
                      selected && styles.bucketChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bucketChipText,
                        selected && styles.bucketChipTextSelected,
                      ]}
                    >
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Worth It / Necessary — mirrors the Add Expense flow */}
            <View style={styles.worthItRow}>
              <TouchableOpacity
                style={[styles.worthItBtn, notWorth && styles.worthItBtnNotWorth]}
                onPress={() => setEdit(row, { worthIt: false, isNecessary: false })}
              >
                <Text style={[styles.worthItBtnText, notWorth && styles.worthItBtnTextNotWorth]}>
                  NOT WORTH IT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.worthItBtn, e.worthIt && styles.worthItBtnWorth]}
                onPress={() => setEdit(row, { worthIt: true, isNecessary: false })}
              >
                <Text style={[styles.worthItBtnText, e.worthIt && styles.worthItBtnTextWorth]}>
                  WORTH IT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.worthItBtn, e.isNecessary && styles.worthItBtnNecessary]}
                onPress={() => setEdit(row, { isNecessary: true, worthIt: false })}
              >
                <Text style={[styles.worthItBtnText, e.isNecessary && styles.worthItBtnTextNecessary]}>
                  NECESSARY
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => handleDismiss(row)}
                disabled={isBusy}
                style={[styles.dismissBtn, isBusy && styles.btnDisabled]}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleConfirm(row)}
                disabled={isBusy || !e.bucketId}
                style={[styles.confirmBtn, (isBusy || !e.bucketId) && styles.btnDisabled]}
              >
                <Text style={styles.confirmText}>
                  {isBusy ? 'Saving…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Review queue</Text>
        <Text style={styles.subtitle}>
          {pending === undefined
            ? 'Loading…'
            : pending.length === 0
            ? 'Nothing to review — imported transactions will appear here.'
            : `${pending.length} transaction${pending.length === 1 ? '' : 's'} to confirm`}
        </Text>
      </View>

      {monthGroups.map((group) => {
        const isCollapsed = collapsed[group.key];
        return (
          <View key={group.key} style={styles.monthSection}>
            <TouchableOpacity
              style={styles.monthHeader}
              onPress={() => toggleMonth(group.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.monthChevron}>{isCollapsed ? '▸' : '▾'}</Text>
              <Text style={styles.monthTitle}>{monthLabel(group.key)}</Text>
              <Text style={styles.monthMeta}>
                {group.rows.length} · {group.currency} {group.total.toFixed(2)}
              </Text>
            </TouchableOpacity>
            {!isCollapsed && group.rows.map((row: any) => renderCard(row))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Transparent so the app's textured wallpaper (set on <body>) shows through,
  // matching every other screen. A solid fill here painted over the texture and
  // made the page look flat/different from the rest of the app — and showed as
  // a two-tone "block" where the fill ended above the wallpaper.
  //
  // maxHeight: 100vh + overflow: auto are required for the ScrollView to
  // actually scroll on react-native-web. Without a bounded height it grows to
  // fit every card and the ancestor clips the overflow, leaving you stuck on
  // the first cards. Mirrors BucketsOverview.web's working pattern.
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    maxHeight: '100vh' as any,
    overflow: 'auto' as any,
  },
  content: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 120 },
  header: { marginBottom: 20 },
  monthSection: { marginBottom: 8 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 6,
  },
  monthChevron: {
    ...type.caption,
    color: theme.colors.textSecondary,
    width: 14,
  },
  monthTitle: {
    ...type.eyebrow,
    color: theme.colors.text,
    flex: 1,
  },
  monthMeta: {
    ...type.caption,
    color: theme.colors.textSecondary,
  },
  backBtn: { marginBottom: 10 },
  backText: { ...type.button, color: theme.colors.primary },
  title: {
    ...type.screenTitle,
    color: theme.colors.text,
  },
  subtitle: {
    ...type.caption,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardAttention: {
    borderColor: theme.colors.honeyed,
    borderWidth: 1.5,
  },
  attentionBanner: {
    backgroundColor: 'rgba(184,152,106,0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  attentionText: {
    color: theme.colors.honeyed,
    fontSize: 12,
    fontFamily: 'Merchant Copy',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  bankBadge: {
    backgroundColor: 'rgba(92,138,122,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  bankBadgeText: {
    ...type.eyebrow,
    color: theme.colors.primary,
  },
  dateText: { ...type.caption, color: theme.colors.textSecondary },
  fieldRow: { marginBottom: 14 },
  label: {
    ...type.label,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    ...type.body,
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
  },
  bucketRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  bucketChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(61,50,41,0.12)',
  },
  bucketChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  bucketChipText: {
    ...type.button,
    color: theme.colors.textSecondary,
  },
  bucketChipTextSelected: { color: theme.colors.textOnPrimary },
  worthItRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
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
    ...type.button,
    color: 'rgba(61,50,41,0.3)',
  },
  worthItBtnTextNotWorth: { color: '#a08060' },
  worthItBtnTextWorth: { color: '#245045' },
  worthItBtnTextNecessary: { color: 'rgba(61,50,41,0.4)' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  dismissBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(61,50,41,0.12)',
  },
  dismissText: { ...type.button, color: theme.colors.textSecondary },
  confirmBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
  },
  confirmText: { ...type.button, color: '#FFFFFF' },
  btnDisabled: { opacity: 0.45 },
});
