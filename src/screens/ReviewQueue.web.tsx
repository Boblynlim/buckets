import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { isPaymentCompany } from '../../convex/lib/merchantKey';
import { COLORS, SAFE_TOP, cupSrc, currentMonth, money, moneyExact, useHomeStyles } from './home/homeStyles';

// Bank transactions waiting for a cup. Same feel as the check-in's
// "Which cup?" step: one card open at a time, tap a cup to file it. Filing a
// merchant teaches the app; "Not spending" teaches it to leave that one out.

type Props = { onBack?: () => void };

const BANK_LABELS: Record<string, string> = { dbs: 'DBS', ocbc: 'OCBC', hsbc: 'HSBC', amex: 'Amex' };

const H1: React.CSSProperties = { fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 };
const PLAIN_BTN: React.CSSProperties = { appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' };
const INPUT: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', fontSize: 17, padding: '8px 0',
  boxShadow: `inset 0 -1px 0 ${COLORS.line}`, outline: 'none', fontFamily: 'inherit', color: COLORS.ink, width: '100%',
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
  const markAsIncome = useMutation(api.pendingTransactions.markAsIncome);
  const fileUnsure = useMutation(api.pendingTransactions.fileUnsure);

  const cups = useMemo(() => [...(summary?.shelves.flatMap((s: any) => s.cups) ?? []), ...(summary?.fixedCups ?? [])], [summary]);
  const invested = useMutation(api.merchantRules.markInvested);

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

  const invest = (row: any, accountId: any, name: string) =>
    finish(row, () => invested({ pendingId: row._id, accountId }), `Added to ${name}. Next time ${row.merchant ?? 'this'} goes there itself.`);

  const moneyIn = (row: any) =>
    finish(row, () => markAsIncome({ pendingId: row._id }), `Counted as money in. Pay near month end goes to next month.`);

  const unsure = (row: any, note?: string, amount?: number) =>
    finish(row, () => fileUnsure({ pendingId: row._id, note: note || undefined, amount }), 'Filed under Not sure. It still counts, nothing learned.');

  const removeOne = (row: any) => finish(row, () => dismiss({ pendingId: row._id }), 'Removed. Nothing learned.');

  const count = visible.length;

  return (
    <div className="bk-root bk-scroll" style={{ height: '100vh', overflowY: 'auto', scrollbarWidth: 'none' as any }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: `calc(${SAFE_TOP} + 12px) 24px 140px`, display: 'flex', flexDirection: 'column', gap: 28 }}>
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
                  onIncome={() => moneyIn(row)}
                  onInvest={(accountId: any, name: string) => invest(row, accountId, name)}
                  onPaidBack={(msg: string) => finish(row, async () => {}, msg)}
                  onUnsure={(note?: string, amount?: number) => unsure(row, note, amount)}
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

// Other spends that day, to help remember what this one was.
function SameDay({ pendingId }: { pendingId: any }) {
  const items = useQuery(api.pendingTransactions.sameDay, { pendingId });
  if (!items || items.length === 0) return null;
  return (
    <span className="bk-fade-in" style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
      Same day: {items.map((i: any) => `${i.what} ${moneyExact(i.amount)}`).join(' · ')}
    </span>
  );
}

// Money in: what was it? Pay, a refund, or someone paying me back.
function InChoices({ row, onIncome, onNotSpending, onDone }: { row: any; onIncome: () => void; onNotSpending: () => void; onDone: (msg: string) => void }) {
  const [picking, setPicking] = useState(false);
  const candidates = useQuery(api.pendingTransactions.paybackCandidates, picking ? { pendingId: row._id } : 'skip');
  const applyPayback = useMutation(api.pendingTransactions.applyPayback);
  const opt: React.CSSProperties = { ...PLAIN_BTN, display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0', minHeight: 56, boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` };
  if (picking) {
    return (
      <div className="bk-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, color: COLORS.muted, paddingBottom: 6 }}>Which spend was this paying back?</span>
        {candidates === undefined && <span style={{ fontSize: 14, color: COLORS.muted, padding: '12px 0' }}>Looking…</span>}
        {candidates?.length === 0 && <span style={{ fontSize: 14, color: COLORS.muted, padding: '12px 0' }}>No spends in the 60 days before this.</span>}
        {candidates?.map((c: any) => (
          <button key={c.id} type="button" style={{ ...opt, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
            onClick={async () => {
              const r = await applyPayback({ pendingId: row._id, expenseId: c.id });
              onDone(r.removed ? `${c.note} is paid back in full, so it's off ${c.cup}.` : `${moneyExact(row.amount)} taken off ${c.note}. ${moneyExact(r.left)} stays in ${c.cup}.`);
            }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.note}</span>
              <span style={{ fontSize: 13, color: COLORS.muted }}>{new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {c.cup}</span>
            </span>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{moneyExact(c.amount)}</span>
          </button>
        ))}
        <button type="button" onClick={() => setPicking(false)} style={{ ...PLAIN_BTN, fontSize: 14, color: COLORS.muted, minHeight: 44, alignSelf: 'flex-start' }}>Back</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button type="button" style={opt} onClick={() => setPicking(true)}>
        <span style={{ fontSize: 15 }}>Paid back</span>
        <span style={{ fontSize: 13, color: COLORS.muted }}>Someone paying me back. Takes it off what I spent.</span>
      </button>
      <button type="button" style={opt} onClick={onNotSpending}>
        <span style={{ fontSize: 15 }}>A refund</span>
        <span style={{ fontSize: 13, color: COLORS.muted }}>Like an insurance claim. Not income. I'll remember {row.merchant ?? 'this sender'}.</span>
      </button>
      <button type="button" style={opt} onClick={onIncome}>
        <span style={{ fontSize: 15 }}>Income</span>
        <span style={{ fontSize: 13, color: COLORS.muted }}>Pay or other earnings. Counts toward the month it funds.</span>
      </button>
    </div>
  );
}

// Money moved into an investment: which account? Adds to what I've put in.
export function InvestPicker({ onPick, onBack }: { onPick: (accountId: any, name: string) => void; onBack: () => void }) {
  const { user } = useAuth();
  const accounts = useQuery(api.accounts.list, user?._id ? { userId: user._id } : 'skip') as any[] | undefined;
  const invested = (accounts ?? []).filter((a) => a.invested);
  const shown = invested.length ? invested : accounts ?? [];
  const opt: React.CSSProperties = { ...PLAIN_BTN, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', minHeight: 52, boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` };
  return (
    <div className="bk-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 13, color: COLORS.muted, paddingBottom: 6 }}>Into which account? It adds to what you've put in.</span>
      {accounts === undefined && <span style={{ fontSize: 14, color: COLORS.muted, padding: '12px 0' }}>Looking…</span>}
      {shown.map((a) => (
        <button key={a._id} type="button" style={opt} onClick={() => onPick(a._id, a.name)}>
          <span style={{ fontSize: 15 }}>{a.name}</span>
          {a.amountIn != null && <span style={{ fontSize: 13, color: COLORS.muted }}>{money(a.amountIn)} in</span>}
        </button>
      ))}
      <button type="button" onClick={onBack} style={{ ...PLAIN_BTN, fontSize: 14, color: COLORS.muted, minHeight: 44, alignSelf: 'flex-start' }}>Back</button>
    </div>
  );
}

export function InvestIcon() {
  return (
    <span style={{ width: 34, height: 34, borderRadius: 999, boxShadow: `inset 0 0 0 1px ${COLORS.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10.5l3.5-3.5 2.5 2.5L12 5M9 5h3v3" /></svg>
    </span>
  );
}

function QueueCard({ row, cups, open, leaving, onOpen, onFile, onNotSpending, onIncome, onInvest, onUnsure, onRemove, onPaidBack }: {
  row: any; cups: any[]; open: boolean; leaving: boolean;
  onOpen: () => void;
  onFile: (cup: any, memo: string, amount?: number) => void;
  onNotSpending: () => void;
  onIncome: () => void;
  onInvest: (accountId: any, name: string) => void;
  onUnsure: (note?: string, amount?: number) => void;
  onPaidBack: (msg: string) => void;
  onRemove: () => void;
}) {
  const [memo, setMemo] = useState('');
  const [investing, setInvesting] = useState(false);
  const [amountText, setAmountText] = useState(String(row.amount ?? ''));
  const amount = parseFloat(amountText);
  const amountOk = isFinite(amount) && amount > 0;
  const isIn = row.direction === 'in';
  // Shared bills: only my share goes into the cup.
  const [splitOpen, setSplitOpen] = useState(false);
  const [share, setShare] = useState<number | null>(null);
  const [customShare, setCustomShare] = useState('');
  const base = row.needsAttention && amountOk ? amount : row.amount;
  const custom = parseFloat(customShare);
  const shareAmount =
    share === -1 ? (isFinite(custom) && custom > 0 ? custom : null) : share ? Math.round((base / share) * 100) / 100 : null;
  const editedAmount =
    shareAmount != null ? shareAmount : row.needsAttention && amountOk && amount !== row.amount ? amount : undefined;
  const fileMemo = (m: string) =>
    shareAmount != null && !m.trim() ? `${row.merchant ?? 'Shared'} (my share of ${moneyExact(base)})` : m;

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
        <span style={{ fontSize: 15, color: isIn ? COLORS.green : COLORS.ink, flexShrink: 0 }}>
          {isIn ? '+' : ''}{moneyExact(row.amount)}
        </span>
      </button>
    );
  }

  const targets = [...cups, { id: 'invest', name: 'Invested' }, { id: 'none', name: 'Not spending' }, { id: 'in', name: 'Money in' }];

  return (
    <div className="bk-step" style={{ ...shell, padding: 20, gap: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: COLORS.muted }}>{whenLabel(row)}</span>
        {row.needsAttention ? (
          <label style={{ display: 'flex', alignItems: 'baseline', gap: 2, boxShadow: `inset 0 -1px 0 ${COLORS.line}` }}>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>$</span>
            <input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="decimal" aria-label="Amount"
              style={{ ...INPUT, boxShadow: 'none', fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', padding: '2px 0' }} />
          </label>
        ) : (
          <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', color: isIn ? COLORS.green : COLORS.ink }}>
            {isIn ? '+' : ''}{moneyExact(row.amount)}
          </span>
        )}
        <span style={{ fontSize: 13, color: COLORS.muted }}>Bank calls it {row.merchant ?? 'nothing'}</span>
        <SameDay pendingId={row._id} />
        {!isIn && (
          shareAmount != null ? (
            <span style={{ fontSize: 14, color: COLORS.green }}>
              Your share: {moneyExact(shareAmount)} of {moneyExact(base)}.{' '}
              <button type="button" onClick={() => { setShare(null); setCustomShare(''); setSplitOpen(false); }}
                style={{ ...PLAIN_BTN, color: COLORS.muted, textDecoration: 'underline', fontSize: 14, padding: 0 }}>Undo</button>
            </span>
          ) : splitOpen ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingTop: 2 }}>
              <span style={{ fontSize: 13, color: COLORS.muted, width: '100%' }}>Split with friends. Only your share goes in the cup.</span>
              <button type="button" className="bk-chip" onClick={() => setShare(2)}>Half</button>
              <button type="button" className="bk-chip" onClick={() => setShare(3)}>A third</button>
              <button type="button" className="bk-chip" onClick={() => setShare(4)}>A quarter</button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, color: COLORS.muted }}>
                Mine $
                <input inputMode="decimal" aria-label="My share" value={customShare} placeholder="0.00"
                  onChange={(e) => { setCustomShare(e.target.value); setShare(-1); }}
                  style={{ ...INPUT, width: 72, fontSize: 15, padding: '6px 0' }} />
              </label>
            </div>
          ) : (
            <button type="button" onClick={() => setSplitOpen(true)}
              style={{ ...PLAIN_BTN, alignSelf: 'flex-start', color: COLORS.ink, fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, minHeight: 32 }}>
              Split it
            </button>
          )
        )}
        {row.needsAttention && (
          <span style={{ fontSize: 13, color: COLORS.rust }}>I could not read all of this one. Check the amount.</span>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10 }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>What was it? Optional</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. lunch at the hawker" style={INPUT} />
        </label>
      </div>

      {isIn ? (
        <InChoices row={row} onIncome={onIncome} onNotSpending={onNotSpending} onDone={onPaidBack} />
      ) : investing ? (
        <InvestPicker onPick={onInvest} onBack={() => setInvesting(false)} />
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 14, columnGap: 2 }}>
        {targets.map((c) => (
          <button key={c.id} type="button" className="bk-cup" aria-label={c.id === 'none' || c.id === 'in' || c.id === 'invest' ? c.name : `File to ${c.name}`}
            disabled={!amountOk || (share === -1 && shareAmount == null)}
            onClick={() => (c.id === 'none' ? onNotSpending() : c.id === 'in' ? onIncome() : c.id === 'invest' ? setInvesting(true) : onFile(c, fileMemo(memo), editedAmount))}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64, opacity: amountOk ? 1 : 0.4 }}>
            <span style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {c.id === 'invest' ? (
                <InvestIcon />
              ) : c.id === 'none' ? (
                <span style={{ width: 34, height: 34, borderRadius: 999, boxShadow: `inset 0 0 0 1px ${COLORS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                </span>
              ) : c.id === 'in' ? (
                <span style={{ width: 34, height: 34, borderRadius: 999, boxShadow: `inset 0 0 0 1px ${COLORS.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={COLORS.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" /></svg>
                </span>
              ) : (
                <img src={cupSrc(c.name)} alt="" />
              )}
            </span>
            <span style={{ fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap' }}>{c.name}</span>
          </button>
        ))}
      </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: -8 }}>
        {!isIn && <button type="button" onClick={() => onUnsure(fileMemo(memo).trim() || undefined, editedAmount)}
          style={{ ...PLAIN_BTN, fontSize: 14, color: COLORS.ink, minHeight: 44 }}>
          Can't remember
        </button>}
        <button type="button" onClick={onRemove}
          style={{ ...PLAIN_BTN, fontSize: 14, color: COLORS.muted, minHeight: 44 }}>
          Remove just this one
        </button>
      </div>
    </div>
  );
}
