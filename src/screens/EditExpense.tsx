import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import type { Expense, Bucket } from '../types';
import { COLORS, money, moneyExact } from './home/homeStyles';
import { ExpenseSheet, linkStyle, useSpendableCups } from './AddExpense';

// Edit one spend: amount, note, date, move it to another cup, mark it paid
// back (a friend repaid you, or a refund), or delete it. Same sheet as Add a
// spend.

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
  const [payingBack, setPayingBack] = useState(false);
  const [backAmount, setBackAmount] = useState('');

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

  // Paid back / refunded: all of it takes the spend off the cup; part of it
  // lowers the spend and notes who paid what back.
  const back = Math.round((parseFloat(backAmount.replace(/[^0-9.]/g, '')) || 0) * 100) / 100;
  const full = back >= expense.amount - 0.004;
  const applyBack = async () => {
    if (back <= 0 || deleting) return;
    setDeleting(true);
    try {
      if (full) {
        await removeExpense({ expenseId: expense._id as any });
      } else {
        const left = Math.round((expense.amount - back) * 100) / 100;
        const note = `${expense.note ?? ''} (paid back ${moneyExact(back)})`.trim();
        await updateExpense({ expenseId: expense._id as any, amount: left, note });
      }
      onClose();
    } catch (e: any) {
      console.error('Failed to mark paid back:', e);
      setDeleting(false);
    }
  };

  const footer = isNew ? null : payingBack ? (
    <div className="bk-step" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0 0', boxShadow: `inset 0 1px 0 ${COLORS.hairline}` }}>
      <span style={{ fontSize: 15, lineHeight: 1.45 }}>How much came back? A friend paying you back, or a refund.</span>
      <label style={{ display: 'flex', alignItems: 'baseline', gap: 2, fontSize: 22, fontWeight: 600, boxShadow: `inset 0 -1px 0 #D9D2C6`, padding: '6px 0' }}>
        <span>$</span>
        <input
          inputMode="decimal"
          aria-label="Amount paid back"
          value={backAmount}
          onChange={(e) => setBackAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') applyBack(); }}
          style={{ appearance: 'none', border: 0, background: 'transparent', outline: 'none', padding: 0, minWidth: 0, flex: 1, font: 'inherit', color: COLORS.ink }}
        />
        {!full && (
          <button type="button" onClick={() => setBackAmount(expense.amount.toFixed(2))} style={{ ...linkStyle, minHeight: 32, fontSize: 13, fontWeight: 400 }}>
            All of it
          </button>
        )}
      </label>
      <span style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.45 }}>
        {back <= 0
          ? ' '
          : full
            ? `Paid back in full. The spend comes off ${bucket.name}.`
            : `${moneyExact(Math.round((expense.amount - back) * 100) / 100)} stays in ${bucket.name}.`}
      </span>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button type="button" onClick={applyBack} disabled={back <= 0 || deleting}
          style={{ appearance: 'none', border: 0, cursor: 'pointer', background: COLORS.green, color: '#FFFFFF', fontFamily: 'inherit', fontSize: 15, fontWeight: 500, height: 44, padding: '0 20px', borderRadius: 999, opacity: back <= 0 || deleting ? 0.5 : 1 }}>
          {deleting ? 'Saving' : full ? 'Paid back in full' : back > 0 ? `Take ${moneyExact(back)} off` : 'Take it off'}
        </button>
        <button type="button" onClick={() => setPayingBack(false)} style={linkStyle}>Cancel</button>
      </div>
    </div>
  ) : confirming ? (
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
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <button type="button" onClick={() => { setBackAmount(expense.amount.toFixed(2)); setPayingBack(true); }} style={{ ...linkStyle, color: COLORS.ink }}>
        Got it back?
      </button>
      <button type="button" onClick={() => setConfirming(true)} style={{ ...linkStyle, color: COLORS.rust }}>
        Delete this spend
      </button>
    </div>
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
