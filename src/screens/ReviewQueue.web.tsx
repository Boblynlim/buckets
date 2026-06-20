import React, { useState } from 'react';
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
  const [edits, setEdits] = useState<
    Record<string, { amount: string; note: string; bucketId?: string }>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const getEdit = (row: any) =>
    edits[row._id] ?? {
      amount: String(row.amount ?? ''),
      note: row.merchant ?? '',
      bucketId: undefined as string | undefined,
    };

  const setEdit = (id: string, patch: Partial<{ amount: string; note: string; bucketId?: string }>) =>
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { amount: '', note: '' }), ...patch },
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

      {pending?.map((row: any) => {
        const e = getEdit(row);
        const isBusy = busyId === row._id;
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
              <View style={styles.amountField}>
                <Text style={styles.label}>Amount ({row.currency})</Text>
                <TextInput
                  style={styles.input}
                  value={e.amount}
                  onChangeText={(t) => setEdit(row._id, { amount: t })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Note</Text>
                <TextInput
                  style={styles.input}
                  value={e.note}
                  onChangeText={(t) => setEdit(row._id, { note: t })}
                  placeholder="Merchant / description"
                />
              </View>
            </View>

            <Text style={styles.label}>Bucket</Text>
            <View style={styles.bucketRow}>
              {(buckets ?? []).map((b: any) => {
                const selected = e.bucketId === b._id;
                return (
                  <TouchableOpacity
                    key={b._id}
                    onPress={() => setEdit(row._id, { bucketId: b._id })}
                    style={[
                      styles.bucketChip,
                      selected && styles.bucketChipSelected,
                      selected && b.color ? { backgroundColor: b.color } : null,
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
                style={[
                  styles.confirmBtn,
                  (isBusy || !e.bucketId) && styles.btnDisabled,
                ]}
              >
                <Text style={styles.confirmText}>
                  {isBusy ? 'Saving…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAE3D5' },
  content: { padding: 20, paddingBottom: 120 },
  header: { marginBottom: 16 },
  backBtn: { marginBottom: 8 },
  backText: { color: '#5C8A7A', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#2E3A34' },
  subtitle: { fontSize: 14, color: '#6B7A72', marginTop: 4 },
  card: {
    backgroundColor: '#FFFDF8',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(92,138,122,0.18)',
  },
  cardAttention: {
    borderColor: '#D98A4E',
    borderWidth: 1.5,
  },
  attentionBanner: {
    backgroundColor: 'rgba(217,138,78,0.14)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  attentionText: {
    color: '#B96A2E',
    fontSize: 12,
    fontWeight: '600',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bankBadge: {
    backgroundColor: 'rgba(92,138,122,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bankBadgeText: { color: '#5C8A7A', fontSize: 12, fontWeight: '700' },
  dateText: { color: '#6B7A72', fontSize: 13 },
  fieldRow: { marginBottom: 12 },
  amountField: { flex: 1 },
  label: { fontSize: 12, color: '#6B7A72', marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#F2EEE4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2E3A34',
  },
  bucketRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  bucketChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F2EEE4',
    borderWidth: 1,
    borderColor: 'rgba(92,138,122,0.2)',
  },
  bucketChipSelected: { borderColor: 'transparent' },
  bucketChipText: { color: '#2E3A34', fontSize: 13, fontWeight: '600' },
  bucketChipTextSelected: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  dismissBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  dismissText: { color: '#6B7A72', fontWeight: '600' },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#5C8A7A',
  },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
