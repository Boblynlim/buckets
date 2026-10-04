import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import type { Expense, Bucket } from '../types';
import { COLORS, money } from './home/homeStyles';
import { ExpenseSheet, linkStyle, useSpendableCups } from './AddExpense';

// Edit one spend: amount, note, date, move it to another cup, or delete it.
// Same sheet as Add a spend.

interface EditExpenseProps {
  visible?: boolean;
  expense?: Expense;
  bucket?: Bucket;
  onClose?: () => void;
}

export const EditExpense: React.FC<EditExpenseProps> = (props) => {
  // Native navigator fallback (RootNavigator passes these as route params).
  let route: any = null;
  let navigation: any = null;
  try {
    const { useRoute, useNavigation } = require('@react-navigation/native');
    route = useRoute();
    navigation = useNavigation();
  } catch (_) {}

  const expense: Expense | undefined = props.expense || route?.params?.expense;
  const bucket: Bucket | undefined = props.bucket || route?.params?.bucket;
  const visible = props.visible !== undefined ? props.visible : true;
  const onClose = props.onClose || (() => navigation?.goBack());

  const { user } = useAuth();
  const spendable = useSpendableCups();
  const createExpense = useMutation(api.expenses.create);
  const updateExpense = useMutation(api.expenses.update);
  const removeExpense = useMutation(api.expenses.remove);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!visible || !expense || !bucket) return null;

  const isNew = (expense._id as any) === 'new';
  // If the spend sits in a cup that isn't spendable (e.g. a save goal), keep
  // it in the list so it stays selected.
  const cups =
    spendable && !spendable.some((c) => c.id === bucket._id)
      ? [{ id: bucket._id, name: bucket.name, left: 0, full: 0 }, ...spendable]
      : spendable;

  const remove = async () => {
    setDeleting(true);
    try {
      await removeExpense({ expenseId: expense._id as any });
      onClose();
    } catch (e: any) {
      console.error('Failed to delete spend:', e);
      setDeleting(false);
      setConfirming(false);
    }
  };

  const footer = isNew ? null : confirming ? (
    <div className="bk-step" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0 0', boxShadow: `inset 0 1px 0 ${COLORS.hairline}` }}>
      <span style={{ fontSize: 15, lineHeight: 1.45 }}>
        Delete this {money(expense.amount)} spend? It goes back into {bucket.name}.
      </span>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button type="button" onClick={remove} disabled={deleting}
          style={{ appearance: 'none', border: 0, cursor: 'pointer', background: COLORS.rust, color: '#FFFFFF', fontFamily: 'inherit', fontSize: 15, fontWeight: 500, height: 44, padding: '0 20px', borderRadius: 999, opacity: deleting ? 0.5 : 1 }}>
          {deleting ? 'Deleting' : 'Delete'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} style={linkStyle}>Keep it</button>
      </div>
    </div>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} style={{ ...linkStyle, alignSelf: 'flex-start', color: COLORS.rust }}>
      Delete this spend
    </button>
  );

  return (
    <ExpenseSheet
      title={isNew ? 'Add a spend' : 'Edit spend'}
      cups={cups}
      initial={{
        // toFixed(2) keeps the cents ("1.80", not "1.8").
        amount: isNew ? '' : expense.amount.toFixed(2),
        note: expense.note ?? '',
        date: new Date(expense.date),
        cupId: bucket._id,
      }}
      onClose={onClose}
      footer={footer}
      onSave={async ({ amount, note, date, cupId }) => {
        if (isNew) {
          if (!user) throw new Error('Not signed in.');
          await createExpense({ userId: user._id, bucketId: cupId as any, amount, date: date.getTime(), note });
        } else {
          await updateExpense({ expenseId: expense._id as any, bucketId: cupId as any, amount, date: date.getTime(), note });
        }
        onClose();
      }}
    />
  );
};
