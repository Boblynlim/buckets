import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { isPaymentCompany } from '../../convex/lib/merchantKey';
import { COLORS, cupSrc, currentMonth, money, useHomeStyles } from './home/homeStyles';

// Bank transactions waiting for a cup. Same feel as the check-in's
// "Which cup?" step: one card open at a time, tap a cup to file it. Filing a
// merchant teaches the app; "Not spending" teaches it to leave that one out.

type Props = { onBack?: () => void };

const BANK_LABELS: Record<string, string> = { dbs: 'DBS', ocbc: 'OCBC', hsbc: 'HSBC', amex: 'Amex' };

const H1: React.CSSProperties = { fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 };
const PLAIN_BTN: React.CSSProperties = { appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' };
const INPUT: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', fontSize: 17, padding: '8px 0',
  boxShadow: 'inset 0 -1px 0 #D9D2C6', outline: 'none', fontFamily: 'inherit', color: COLORS.ink, width: '100%',
};

function whenLabel(row: any): string {
  const d = new Date(row.date);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
  const bank = BANK_LABELS[row.bank] ?? (row.bank && row.bank !== 'unknown' ? String(row.bank).toUpperCase() : '');
  return [day, time, bank, row.last4 ? `card ${row.last4}` : ''].filter(Boolean).join(' · ');
}

function monthHeading(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function ReviewQueue({ onBack }: Props) {
  useHomeStyles();
  const { user } = useAuth();
  const userId = user?._id;

  const pending = useQuery(api.pendingTransactions.listPending, userId ? { userId } : 'skip') as any[] | undefined;
  const summary = useQuery(api.home.summary, userId ? { userId, month: currentMonth() } : 'skip');
  const confirm = useMutation(api.pendingTransactions.confirm);
  const dismiss = useMutation(api.pendingTransactions.dismiss);
  const notSpending = useMutation(api.merchantRules.markNotSpending);

  const cups = useMemo(() => summary?.shelves.flatMap((s: any) => s.cups) ?? [], [summary]);

  // Rows that need fixing first, then newest. Month headings only when the
  // queue spans more than one month.
  const rows = useMemo(() => {
    const list = (pending ?? []).slice();
    list.sort((a, b) => (a.needsAttention !== b.needsAttention ? (a.needsAttention ? -1 : 1) : b.date - a.date));
    return list;
  }, [pending]);
  const multiMonth = new Set(rows.map((r) => monthHeading(r.date))).size > 1;
  const byMonth = useMemo(() => {
    if (!multiMonth) return [{ label: '', rows }];
    const map = new Map<string, any[]>();
    for (const r of rows.slice().sort((a, b) => b.date - a.date)) {
      const k = monthHeading(r.date);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([label, rs]) => ({
      label,
      rows: rs.sort((a, b) => (a.needsAttention !== b.needsAttention ? (a.needsAttention ? -1 : 1) : b.date - a.date)),
    }));
  }, [rows, multiMonth]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Record<string, true>>({});
  const [toast, setToast] = useState('');
  const visible = rows.filter((r) => !leaving[r._id]);
  const activeId = openId && visible.some((r) => r._id === openId) ? openId : visible[0]?._id ?? null;

  // Fade the card out, then write. The live query drops the row when done.
  const finish = async (row: any, write: () => Promise<unknown>, message: string) => {
    setLeaving((l) => ({ ...l, [row._id]: true }));
    setOpenId(null);
    try {
      await write();
      setToast(message);
    } catch {
      setLeaving((l) => {
        const { [row._id]: _, ...rest } = l;
        return rest;
      });
      setToast('That did not save. Try again.');
    }
  };

  const fileTo = (row: any, cup: any, memo: string, amount?: number) =>
    finish(
      row,
      () => confirm({ pendingId: row._id, bucketId: cup.id, note: memo.trim() || undefined, amount }),
      isPaymentCompany(row.merchant)
        ? `Filed to ${cup.name}. ${row.merchant} is a payment company many shops use, so I will keep asking.`
        : `Filed to ${cup.name}. Next time ${row.merchant ?? 'this'} files itself.`
    );

  const leaveOut = (row: any) =>
    finish(row, () => notSpending({ pendingId: row._id }), `Got it. ${row.merchant ?? 'That'} stays out of your cups.`);

  const removeOne = (row: any) => finish(row, () => dismiss({ pendingId: row._id }), 'Removed. Nothing learned.');

  const count = visible.length;

  return (
    <div className="bk-root bk-scroll" style={{ height: '100vh', overflowY: 'auto', scrollbarWidth: 'none' as any }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '20px 24px 140px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {onBack && (
          <button type="button" onClick={onBack}
            style={{ ...PLAIN_BTN, alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: COLORS.muted, marginLeft: -2 }}>
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 1L1.5 6l5 5" /></svg>
            Settings
          </button>
        )}

        <div className="bk-step" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, color: COLORS.muted }}>
            {pending === undefined ? 'Review queue' : count ? `${count} to file` : 'Review queue'}
          </span>
          <h1 style={H1}>{pending === undefined ? ' ' : count ? 'Which cup?' : 'Nothing to file.'}</h1>
          {pending !== undefined && !count && (
            <span style={{ fontSize: 15, color: COLORS.muted, lineHeight: 1.5 }}>New bank emails file themselves when they can.</span>
          )}
        </div>

        {toast && (
          <span key={toast} className="bk-step" role="status" style={{ fontSize: 14, color: toast.startsWith('That did not') ? COLORS.rust : COLORS.green, lineHeight: 1.45, marginTop: -12 }}>
            {toast}
          </span>
        )}

        {byMonth.map((g) => {
          return (
            <section key={g.label || 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.label && <span style={{ fontSize: 13, color: COLORS.muted }}>{g.label}</span>}
              {g.rows.map((row) => (
                <QueueCard
                  key={row._id}
                  row={row}
                  cups={cups}
                  open={leaving[row._id] ? true : activeId === row._id}
                  leaving={!!leaving[row._id]}
                  onOpen={() => setOpenId(row._id)}
                  onFile={(cup, memo, amount) => fileTo(row, cup, memo, amount)}
                  onNotSpending={() => leaveOut(row)}
                  onRemove={() => removeOne(row)}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function QueueCard({ row, cups, open, leaving, onOpen, onFile, onNotSpending, onRemove }: {
  row: any; cups: any[]; open: boolean; leaving: boolean;
  onOpen: () => void;
  onFile: (cup: any, memo: string, amount?: number) => void;
  onNotSpending: () => void;
  onRemove: () => void;
}) {
  const [memo, setMemo] = useState('');
  const [amountText, setAmountText] = useState(String(row.amount ?? ''));
  const amount = parseFloat(amountText);
  const amountOk = isFinite(amount) && amount > 0;
  const editedAmount = row.needsAttention && amountOk && amount !== row.amount ? amount : undefined;
  const isIn = row.direction === 'in';

  const shell: React.CSSProperties = {
    background: COLORS.sheet, borderRadius: 18, display: 'flex', flexDirection: 'column',
    opacity: leaving ? 0 : 1, filter: leaving ? 'blur(6px)' : 'none',
    transition: 'opacity .45s ease, filter .45s ease',
    pointerEvents: leaving ? 'none' : undefined,
  };

  if (!open) {
    return (
      <button type="button" className="bk-row" onClick={onOpen} style={{ ...PLAIN_BTN, ...shell, padding: '14px 18px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 60 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.merchant ?? 'Unnamed'}</span>
          <span style={{ fontSize: 13, color: row.needsAttention ? COLORS.rust : COLORS.muted }}>
            {row.needsAttention ? 'Check this one' : whenLabel(row).split(' · ').slice(0, 2).join(' · ')}
          </span>
        </span>
        <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', color: isIn ? COLORS.green : COLORS.ink, flexShrink: 0 }}>
          {isIn ? '+' : ''}{money(row.amount)}
        </span>
      </button>
    );
  }

  const targets = [...cups, { id: 'none', name: 'Not spending' }];

  return (
    <div className="bk-step" style={{ ...shell, padding: 20, gap: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: COLORS.muted }}>{whenLabel(row)}</span>
        {row.needsAttention ? (
          <label style={{ display: 'flex', alignItems: 'baseline', gap: 2, boxShadow: 'inset 0 -1px 0 #D9D2C6' }}>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>$</span>
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="decimal" aria-label="Amount"
              style={{ ...INPUT, boxShadow: 'none', fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', padding: '2px 0' }} />
          </label>
        ) : (
          <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: isIn ? COLORS.green : COLORS.ink }}>
            {isIn ? '+' : ''}{money(row.amount)}
          </span>
        )}
        <span style={{ fontSize: 13, color: COLORS.muted }}>Bank calls it {row.merchant ?? 'nothing'}</span>
        {row.needsAttention && (
          <span style={{ fontSize: 13, color: COLORS.rust }}>I could not read all of this one. Check the amount.</span>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10 }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>What was it? Optional</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. lunch at the hawker" style={INPUT} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 14, columnGap: 2 }}>
        {targets.map((c) => (
          <button key={c.id} type="button" className="bk-cup" aria-label={c.id === 'none' ? 'Not spending' : `File to ${c.name}`}
            disabled={!amountOk}
            onClick={() => (c.id === 'none' ? onNotSpending() : onFile(c, memo, editedAmount))}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64, opacity: amountOk ? 1 : 0.4 }}>
            <span style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {c.id === 'none' ? (
                <span style={{ width: 34, height: 34, borderRadius: 999, boxShadow: 'inset 0 0 0 1px #D9D2C6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                </span>
              ) : (
                <img src={cupSrc(c.name)} alt="" />
              )}
            </span>
            <span style={{ fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap' }}>{c.name}</span>
          </button>
        ))}
      </div>

      <button type="button" onClick={onRemove}
        style={{ ...PLAIN_BTN, alignSelf: 'center', textAlign: 'center', fontSize: 14, color: COLORS.muted, minHeight: 44, marginTop: -8 }}>
        Remove just this one
      </button>
    </div>
  );
}
