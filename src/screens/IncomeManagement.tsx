import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { addMonths, format, isBefore, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { COLORS, SAFE_TOP, money, useHomeStyles } from './home/homeStyles';

// Income for a month: one big number, the entries under it, add / edit /
// remove. Ticking an entry marks it as arrived.

interface IncomeManagementProps {
  visible?: boolean;
  onClose?: () => void;
}

const LABEL: React.CSSProperties = { fontSize: 13, color: COLORS.muted };
const INPUT: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', color: COLORS.ink,
  fontSize: 17, padding: '8px 0', boxShadow: 'inset 0 -1px 0 #D9D2C6', width: '100%', boxSizing: 'border-box',
};
const LINK: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: COLORS.muted, fontSize: 14,
  minHeight: 44, padding: 0, fontFamily: 'inherit',
};
const ICON_BTN: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 44, height: 44,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};
const CSS = `
.bk-income input::placeholder { color: #C9C0B4; }
.bk-income input:focus { box-shadow: inset 0 -1.5px 0 ${COLORS.ink} !important; }
.bk-income .bk-money input:focus { box-shadow: none !important; }
.bk-income .bk-money:focus-within { box-shadow: inset 0 -1.5px 0 ${COLORS.ink} !important; }
.bk-tick { transition: background .3s ease, box-shadow .3s ease; }
`;
let cssInjected = false;

// Whole dollars unless there are cents.
const amt = (n: number) =>
  Number.isInteger(n) ? money(n) : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parse = (s: string) => parseFloat(s.replace(/[^0-9.]/g, ''));

export const IncomeManagement: React.FC<IncomeManagementProps> = ({ visible = true, onClose }) => {
  useHomeStyles();
  if (!cssInjected && typeof document !== 'undefined') {
    cssInjected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { user: currentUser } = useAuth();
  const month = format(selectedMonth, 'yyyy-MM');
  const entries = useQuery(api.monthlyIncome.getByMonth, currentUser ? { userId: currentUser._id, month } : 'skip');
  const seedMonth = useMutation(api.monthlyIncome.seedMonth);
  const addEntry = useMutation(api.monthlyIncome.add);
  const updateEntry = useMutation(api.monthlyIncome.update);
  const removeEntry = useMutation(api.monthlyIncome.remove);
  const toggleConfirm = useMutation(api.monthlyIncome.toggleConfirm);
  const migrateFromLegacy = useMutation(api.monthlyIncome.migrateFromLegacy);
  const recalculateDistribution = useMutation(api.distribution.calculateDistribution);
  const distributionStatus = useQuery(api.distribution.getDistributionStatus, currentUser ? { userId: currentUser._id } : 'skip');

  // One-time move from the old global income table.
  const hasMigrated = useRef(false);
  useEffect(() => {
    if (currentUser && !hasMigrated.current) {
      hasMigrated.current = true;
      migrateFromLegacy({ userId: currentUser._id }).catch(() => {});
    }
  }, [currentUser]);

  // An empty month copies last month's entries (once per month).
  const seededMonths = useRef(new Set<string>());
  useEffect(() => {
    if (entries && entries.length === 0 && currentUser && !seededMonths.current.has(month)) {
      seededMonths.current.add(month);
      seedMonth({ userId: currentUser._id, month });
    }
  }, [entries, currentUser, month]);

  const expected = useMemo(() => (entries ?? []).reduce((s, e) => s + e.amount, 0), [entries]);
  const received = useMemo(() => (entries ?? []).filter((e) => e.isConfirmed).reduce((s, e) => s + e.amount, 0), [entries]);
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());
  const isPast = isBefore(selectedMonth, startOfMonth(new Date()));

  const refill = async () => {
    if (isCurrentMonth && currentUser) await recalculateDistribution({ userId: currentUser._id }).catch(() => {});
  };

  const closeForm = () => {
    setAdding(false);
    setEditingId(null);
    setConfirmRemove(false);
    setAmount('');
    setNote('');
    setBusy(false);
  };

  const startEdit = (e: any) => {
    setAdding(false);
    setConfirmRemove(false);
    setEditingId(e._id);
    setAmount(String(e.amount));
    setNote(e.note || '');
  };

  const startAdd = () => {
    closeForm();
    setAdding(true);
  };

  const valid = parse(amount) > 0;

  const submit = async () => {
    if (!valid || !currentUser || busy) return;
    setBusy(true);
    try {
      if (editingId) {
        await updateEntry({ entryId: editingId as any, amount: parse(amount), note: note.trim() || undefined });
      } else {
        await addEntry({ userId: currentUser._id, month, amount: parse(amount), note: note.trim() || undefined });
      }
      await refill();
      closeForm();
    } catch (err) {
      console.error('Failed to save income:', err);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editingId || busy) return;
    setBusy(true);
    try {
      await removeEntry({ entryId: editingId as any });
      await refill();
      closeForm();
    } catch (err) {
      console.error('Failed to remove income:', err);
      setBusy(false);
    }
  };

  const tick = async (id: string) => {
    try {
      await toggleConfirm({ entryId: id as any });
      await refill();
    } catch (err) {
      console.error('Failed to toggle income:', err);
    }
  };

  const goMonth = (d: Date) => {
    closeForm();
    setSelectedMonth(d);
  };

  if (!visible) return null;

  const list = entries ?? [];
  const status = distributionStatus as any;

  const form = (
    <div className="bk-step" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '20px 0 8px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={LABEL}>Amount</span>
        <span className="bk-money" style={{ display: 'flex', alignItems: 'baseline', gap: 4, boxShadow: 'inset 0 -1px 0 #D9D2C6' }}>
          <span style={{ fontSize: 26, fontWeight: 500, color: '#A89E92' }}>$</span>
          <input inputMode="decimal" autoFocus value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{ ...INPUT, boxShadow: 'none', fontSize: 44, fontWeight: 600, letterSpacing: '-0.04em', padding: '2px 0' }} />
        </span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={LABEL}>What is it?</span>
        <input value={note} placeholder="Salary, freelance, a refund" onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} style={INPUT} />
      </label>
      <button type="button" className="bk-btn" disabled={!valid || busy} onClick={submit}>
        {editingId ? 'Save' : 'Add income'}
      </button>
      <div style={{ display: 'flex', justifyContent: editingId ? 'space-between' : 'center' }}>
        <button type="button" style={LINK} onClick={closeForm}>Cancel</button>
        {editingId && !confirmRemove && (
          <button type="button" style={{ ...LINK, color: COLORS.rust }} onClick={() => setConfirmRemove(true)}>Remove</button>
        )}
        {editingId && confirmRemove && (
          <button type="button" disabled={busy} style={{ ...LINK, color: COLORS.rust, fontWeight: 500 }} onClick={remove}>
            Remove from {format(selectedMonth, 'MMMM')}?
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="bk-root bk-income" role="dialog" aria-label="Income"
      style={{ position: 'fixed', inset: 0, zIndex: 2500, overflowY: 'auto', background: COLORS.wall }}>
      <div className="bk-step" style={{ maxWidth: 440, minHeight: '100%', margin: '0 auto', boxSizing: 'border-box', padding: `calc(${SAFE_TOP} + 12px) 24px 48px`, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, color: COLORS.muted }}>Income</span>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" style={{ ...ICON_BTN, marginRight: -12 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, color: COLORS.muted }}>{format(selectedMonth, isCurrentMonth ? 'MMMM' : 'MMMM yyyy')}</span>
            <span style={{ display: 'flex', marginRight: -14 }}>
              <button type="button" aria-label="Previous month" style={ICON_BTN} onClick={() => goMonth(subMonths(selectedMonth, 1))}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round"><path d="M7.5 3L4.5 6l3 3" /></svg>
              </button>
              <button type="button" aria-label="Next month" style={ICON_BTN} onClick={() => goMonth(addMonths(selectedMonth, 1))}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round"><path d="M4.5 3l3 3-3 3" /></svg>
              </button>
            </span>
          </div>
          <span key={month} className="bk-step" style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {money(expected)}
          </span>
          <span style={{ fontSize: 15, color: COLORS.muted, lineHeight: 1.5 }}>
            {expected === 0
              ? 'Nothing coming in yet.'
              : received >= expected
                ? <span style={{ color: COLORS.green }}>All of it has arrived.</span>
                : received > 0
                  ? `${amt(received)} arrived so far. ${amt(expected - received)} to come.`
                  : isPast ? 'Coming in that month.' : 'Coming in this month.'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {list.map((e) => (
            <div key={e._id} style={{ boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 60 }}>
                <button type="button" onClick={() => tick(e._id)} role="checkbox" aria-checked={!!e.isConfirmed}
                  aria-label={`${e.note || 'Income'} arrived`} style={{ ...ICON_BTN, marginLeft: -10 }}>
                  <span className="bk-tick" style={{
                    width: 22, height: 22, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: e.isConfirmed ? COLORS.green : 'transparent', boxShadow: e.isConfirmed ? 'none' : 'inset 0 0 0 1.5px #D9D2C6',
                  }}>
                    {e.isConfirmed && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.4 2.3 4.6-5" /></svg>
                    )}
                  </span>
                </button>
                <button type="button" className="bk-row" onClick={() => (editingId === e._id ? closeForm() : startEdit(e))}
                  aria-expanded={editingId === e._id}
                  style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', textAlign: 'left', minHeight: 56 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15 }}>{e.note || 'Income'}</span>
                    {e.isConfirmed && e.confirmedAt && (
                      <span style={{ fontSize: 13, color: COLORS.muted }}>
                        Arrived {new Date(e.confirmedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 15, color: e.isConfirmed ? COLORS.ink : COLORS.muted }}>{amt(e.amount)}</span>
                </button>
              </div>
              {editingId === e._id && form}
            </div>
          ))}

          {adding ? form : (
            <button type="button" onClick={startAdd}
              style={{ ...LINK, display: 'flex', alignItems: 'center', gap: 8, minHeight: 56, color: COLORS.ink, fontSize: 15 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
              Add income
            </button>
          )}
        </div>

        {/* How this month's money reached the cups. Tapping refills them. */}
        {isCurrentMonth && status && expected > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'auto' }}>
            <span style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
              {status.totalFunded > 0
                ? `${money(status.totalFunded)} went into your cups.`
                : 'Not in your cups yet.'}
              {status.totalFunded > 0 && status.unallocated > 0 ? ` ${money(status.unallocated)} isn’t in a cup.` : ''}
              {status.isOverPlanned ? <span style={{ color: COLORS.rust }}> Cups ask for {money(status.overPlannedBy)} more than this.</span> : ''}
            </span>
            <button type="button" style={{ ...LINK, alignSelf: 'flex-start', color: COLORS.ink, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#D9D2C6' }}
              onClick={() => currentUser && recalculateDistribution({ userId: currentUser._id }).catch(() => {})}>
              {status.totalFunded > 0 ? 'Fill cups again' : 'Fill my cups'}
            </button>
          </div>
        )}
        {!isCurrentMonth && expected > 0 && (
          <span style={{ fontSize: 13, color: COLORS.muted, marginTop: 'auto' }}>
            {isPast ? 'This went into your cups that month.' : 'Goes into your cups when the month starts.'}
          </span>
        )}
      </div>
    </div>
  );
};
