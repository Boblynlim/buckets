import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { DatePicker } from '../components/DatePicker';
import { COLORS, cupSrc, currentMonth, money, moneyExact, useHomeStyles } from './home/homeStyles';

// Add a spend by hand. Same feel as the check-in's "Which cup?" step:
// amount, what it was, when, then tap a cup. Only spendable cups are offered
// (Everyday, For me, Saving up), straight from home.summary.

export type SheetCup = { id: string; name: string; left: number; full: number };

const FAINT = '#A89E92';
const UNDERLINE = 'inset 0 -1px 0 #D9D2C6';
const EASE = 'cubic-bezier(0.16,0.9,0.4,1)';

export function dateLabel(d: Date): string {
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

const parseAmount = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** The spendable cups, in shelf order, with what's left this month. */
export function useSpendableCups(): SheetCup[] | undefined {
  const { user } = useAuth();
  const data = useQuery(api.home.summary, user ? { userId: user._id, month: currentMonth() } : 'skip');
  if (!data) return undefined;
  return data.shelves.flatMap((s) => s.cups.map((c) => ({ id: c.id as string, name: c.name, left: c.left, full: c.full })));
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
);

export const linkStyle: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0,
  minHeight: 44, fontSize: 15, color: COLORS.muted, fontFamily: 'inherit',
};

/** The shared sheet used by Add and Edit. */
export function ExpenseSheet({
  title,
  cups,
  initial,
  saveLabel = 'Save',
  onSave,
  onClose,
  footer,
}: {
  title: string;
  cups: SheetCup[] | undefined;
  initial?: { amount?: string; note?: string; date?: Date; cupId?: string | null };
  saveLabel?: string;
  onSave: (v: { amount: number; note: string; date: Date; cupId: string }) => Promise<void>;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  useHomeStyles();
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState<Date>(initial?.date ?? new Date());
  const [cupId, setCupId] = useState<string | null>(initial?.cupId ?? null);
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial?.amount) amountRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDate) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDate]);

  const value = parseAmount(amount);
  const cup = cups?.find((c) => c.id === cupId);
  const valid = value > 0 && !!cupId;
  const over = cup && value > 0 && value > cup.left ? value - Math.max(0, cup.left) : 0;

  const save = async () => {
    if (!valid || saving || !cupId) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ amount: value, note: note.trim(), date, cupId });
    } catch (e: any) {
      console.error('Failed to save spend:', e);
      setError(e?.message ? String(e.message) : 'Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bk-scrim" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,27,23,0.2)', zIndex: 2000 }} />
      <div
        className="bk-sheet bk-root"
        role="dialog"
        aria-label={title}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, top: 12, zIndex: 2001, maxWidth: 480, margin: '0 auto',
          background: COLORS.wall, borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 12px 0 24px' }}>
          <span style={{ fontSize: 15, color: COLORS.muted }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon />
          </button>
        </div>

        <style>{'.bk-amt::placeholder { color: #A89E92; opacity: 1; }'}</style>
        <div className="bk-scroll" style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as any, padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={{ display: 'flex', alignItems: 'baseline', fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
              <span style={{ color: amount ? COLORS.ink : FAINT, transition: 'color .3s ease' }}>$</span>
              <input
                ref={amountRef}
                className="bk-amt"
                inputMode="decimal"
                aria-label="Amount"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                style={{
                  appearance: 'none', border: 0, background: 'transparent', outline: 'none', padding: 0, minWidth: 0, flex: 1,
                  font: 'inherit', letterSpacing: 'inherit', color: COLORS.ink, caretColor: COLORS.green,
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, color: COLORS.muted }}>What was it?</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. lunch at the hawker"
                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                style={{ appearance: 'none', border: 0, background: 'transparent', fontSize: 17, padding: '8px 0', boxShadow: UNDERLINE, outline: 'none', fontFamily: 'inherit', color: COLORS.ink }}
              />
            </label>

            <button type="button" onClick={() => setShowDate(true)} aria-label={`Date, ${dateLabel(date)}. Change`}
              style={{ ...linkStyle, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, color: COLORS.ink }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.muted} strokeWidth="1.3" strokeLinecap="round">
                <rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
              </svg>
              <span>{dateLabel(date)}</span>
              <span style={{ color: FAINT, fontSize: 13 }}>Change</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: 13, color: COLORS.muted }}>Which cup?</span>
            {!cups ? (
              <div style={{ height: 160 }} />
            ) : cups.length === 0 ? (
              <span style={{ fontSize: 15, color: COLORS.muted }}>No cups yet. Add one in Settings.</span>
            ) : (
              <div role="radiogroup" aria-label="Cup" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 6, columnGap: 4 }}>
                {cups.map((c) => {
                  const on = c.id === cupId;
                  const dim = !!cupId && !on;
                  const low = c.left < 0 || (c.full > 0 && c.left / c.full < 0.25);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${c.name}, ${money(c.left)} left`}
                      className="bk-row"
                      onClick={() => setCupId(on ? null : c.id)}
                      style={{
                        appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: '4px 0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: 84, position: 'relative',
                      }}
                    >
                      <img
                        src={cupSrc(c.name)}
                        alt=""
                        style={{
                          width: 52, height: 52, objectFit: 'contain', objectPosition: 'bottom', mixBlendMode: 'multiply',
                          position: 'relative', top: on ? -4 : 0, opacity: dim ? 0.35 : 1,
                          transition: `top .5s ${EASE}, opacity .4s ease`,
                        }}
                      />
                      <span style={{ fontSize: 12, marginTop: 4, whiteSpace: 'nowrap', color: on ? COLORS.ink : COLORS.muted, fontWeight: on ? 600 : 400, opacity: dim ? 0.6 : 1, transition: 'opacity .4s ease' }}>
                        {c.name}
                      </span>
                      <span style={{ fontSize: 11, color: low ? COLORS.rust : FAINT, opacity: dim ? 0.6 : 1, transition: 'opacity .4s ease' }}>
                        {money(c.left)}
                      </span>
                      <span aria-hidden style={{ width: 4, height: 4, borderRadius: 999, marginTop: 3, background: on ? COLORS.ink : 'transparent', transition: 'background .3s ease' }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {footer}
        </div>

        <div style={{ padding: '12px 24px calc(env(safe-area-inset-bottom, 0px) + 20px)', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: `inset 0 1px 0 ${COLORS.hairline}` }}>
          {error ? (
            <span style={{ fontSize: 13, color: COLORS.rust, textAlign: 'center' }}>{error}</span>
          ) : cup && over > 0 ? (
            <span className="bk-step" style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center' }}>
              {moneyExact(over)} more than {cup.name} has left. It carries into next month.
            </span>
          ) : null}
          <button type="button" className="bk-btn" disabled={!valid || saving} onClick={save}>
            {saving ? 'Saving' : cup && value > 0 ? `${saveLabel} ${moneyExact(value)} to ${cup.name}` : saveLabel}
          </button>
        </div>
      </div>

      <DatePicker visible={showDate} selectedDate={date} onSelectDate={setDate} onClose={() => setShowDate(false)} />
    </>
  );
}

interface AddExpenseProps {
  visible?: boolean;
  onClose?: () => void;
}

export const AddExpense: React.FC<AddExpenseProps> = ({ visible = true, onClose = () => {} }) => {
  const { user } = useAuth();
  const cups = useSpendableCups();
  const createExpense = useMutation(api.expenses.create);

  if (!visible) return null;

  return (
    <ExpenseSheet
      title="Add a spend"
      cups={cups}
      onClose={onClose}
      onSave={async ({ amount, note, date, cupId }) => {
        if (!user) throw new Error('Not signed in.');
        await createExpense({ userId: user._id, bucketId: cupId as any, amount, date: date.getTime(), note });
        onClose();
      }}
    />
  );
};
