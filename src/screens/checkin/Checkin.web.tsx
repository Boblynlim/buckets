import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../lib/AuthContext';
import { isPaymentCompany } from '../../../convex/lib/merchantKey';
import { CupArt } from '../home/Home.web';
import { InvestIcon, InvestPicker } from '../ReviewQueue.web';
import { COLORS, cupSrc, currentMonth, money, moneyExact, monthLabel, useHomeStyles } from '../home/homeStyles';

// Payday check-in: recap -> balances -> filed for you -> the few it couldn't
// file -> done (numbers count up, cups fill). Skipping is always fine.

const STEPS = 6;
const H1: React.CSSProperties = { fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 };
const LABEL: React.CSSProperties = { fontSize: 14, color: COLORS.muted };
const PAGE: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 3000, overflowY: 'auto' };
const INNER: React.CSSProperties = { maxWidth: 440, minHeight: '100%', margin: '0 auto', boxSizing: 'border-box', padding: 'calc(max(env(safe-area-inset-top, 0px), 44px) + 88px) 24px 40px', display: 'flex', flexDirection: 'column', gap: 28 };

function useCountUp(target: number, run: boolean, ms = 1800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const x = Math.min(1, (now - t0) / ms);
      setV(target * (1 - Math.pow(1 - x, 4)));
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target]);
  return v;
}

export function Checkin({ onClose }: { onClose: () => void }) {
  useHomeStyles();
  const { user } = useAuth();
  const userId = user?._id;
  // In the last week of a month the check-in sets up the next one (pay that
  // lands from the 24th funds next month; see convex/lib/incomeMonth.ts).
  const month = (() => {
    const now = new Date();
    return now.getDate() >= 24 ? currentMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1)) : currentMonth(now);
  })();
  const [step, setStep] = useState(0);

  const summary = useQuery(api.home.summary, userId ? { userId, month } : 'skip');
  const income = useQuery(api.monthlyIncome.getByMonth, userId ? { userId, month } : 'skip') as any[] | undefined;
  const prev = summary?.prevMonth ?? month;
  const recap = useQuery(api.home.monthRecap, userId ? { userId, month: prev } : 'skip');
  const accounts = useQuery(api.accounts.list, userId ? { userId } : 'skip');
  const [y, m] = prev.split('-').map(Number);
  const since = Date.UTC(y, m - 1, 1) - 8 * 3600 * 1000;
  const filed = useQuery(api.merchantRules.filedForYou, userId ? { userId, since } : 'skip');
  const pending = useQuery(api.pendingTransactions.listPending, userId ? { userId } : 'skip');

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const cups = [...(summary?.shelves.flatMap((s) => s.cups) ?? []), ...(summary?.fixedCups ?? [])];
  const pay = (income ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="bk-root" style={PAGE}>
      {/* Clears the status bar / Dynamic Island (at least 44px even where the inset reads 0), on the wall colour so content scrolls under it. */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 44px) + 16px)', paddingBottom: 8, background: COLORS.wall, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
        <div style={{ width: 'min(392px, calc(100% - 48px))', display: 'flex', gap: 6, alignItems: 'center' }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} style={{ flexGrow: 1, height: 2, borderRadius: 2, background: i <= step ? COLORS.ink : COLORS.hairline, transition: 'background .6s ease' }} />
          ))}
          <button type="button" onClick={onClose} aria-label="Close check-in"
            style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 36, height: 36, marginLeft: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
      </div>

      {step === 0 && (
        <div className="bk-step" style={{ ...INNER, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={LABEL}>{monthLabel(month)}</span>
            <span style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{money(pay)}</span>
            <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>Payday. Five minutes?</span>
            <span style={{ fontSize: 15, color: COLORS.muted, lineHeight: 1.5 }}>
              See how {monthLabel(prev)} went, update a few balances, file what I couldn't. Then your cups fill.
            </span>
          </div>
          <button type="button" className="bk-btn" onClick={next}>Start</button>
        </div>
      )}

      {step === 1 && recap && <Recap recap={recap} prevLabel={monthLabel(prev)} onNext={next} />}
      {step === 2 && accounts && userId && <Balances userId={userId} month={month} accounts={accounts} onNext={next} />}
      {step === 3 && filed && <FiledForYou groups={filed} cups={cups} onNext={next} />}
      {step === 4 && pending && <Leftovers rows={pending.filter((p: any) => (p.direction ?? 'out') === 'out')} cups={cups} onDone={next} />}
      {step === 5 && summary && <Done summary={summary} month={month} onClose={onClose} />}
    </div>
  );
}

// Last month: what each cup actually spent. (What carried over isn't shown:
// opening balances were set fresh in October, so "left" would mislead.)
function Recap({ recap, prevLabel, onNext }: { recap: any[]; prevLabel: string; onNext: () => void }) {
  const total = recap.reduce((s, sh) => s + sh.cups.reduce((t: number, c: any) => t + c.spent, 0), 0);
  return (
    <div className="bk-step" style={INNER}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={LABEL}>{prevLabel}</span>
        <h1 style={H1}>You spent {money(total)} from your cups.</h1>
      </div>
      {recap.filter((sh) => sh.cups.length).map((sh) => {
        const cols = `repeat(${sh.cups.length}, minmax(0, 1fr))`;
        const shelfSpent = sh.cups.reduce((t: number, c: any) => t + c.spent, 0);
        return (
          <div key={sh.name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: COLORS.muted }}>
              <span>{sh.name}</span>
              <span>{money(shelfSpent)} spent</span>
            </div>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'end' }}>
                {sh.cups.map((c: any) => (
                  <img key={c.id} src={cupSrc(c.name)} alt=""
                    style={{ justifySelf: 'center', width: 44, height: 44, objectFit: 'contain', objectPosition: 'bottom', mixBlendMode: 'multiply', opacity: c.spent > 0 ? 1 : 0.35 }} />
                ))}
              </div>
              <div className="bk-plank" />
              <div style={{ display: 'grid', gridTemplateColumns: cols, paddingTop: 8 }}>
                {sh.cups.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: c.spent > 0 ? COLORS.ink : '#B5ACA0' }}>{c.spent > 0 ? money(c.spent) : '–'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" className="bk-btn" style={{ marginTop: 'auto' }} onClick={onNext}>Next. Balances</button>
    </div>
  );
}

const GROUP_LABEL: Record<string, string> = { now: 'Now', soon: 'Soon', later: 'Later' };

const num = (v: string) => Number(v.replace(/[^0-9.]/g, ''));
const AMOUNT_INPUT: React.CSSProperties = { appearance: 'none', border: 0, background: 'transparent', width: 96, textAlign: 'right', fontSize: 15, padding: '8px 0', outline: 'none', fontFamily: 'inherit' };

function Balances({ userId, month, accounts, onNext }: { userId: any; month: string; accounts: any[]; onNext: () => void }) {
  const save = useMutation(api.accounts.saveBalances);
  const close = useMutation(api.accounts.closeAccount);
  // Keys: account id for "now", `${id}:in` for what went in (investments).
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const valueOf = (a: any, key: 'now' | 'in') => {
    const base = key === 'now' ? a.amount : a.amountIn ?? 0;
    const v = vals[key === 'now' ? a._id : `${a._id}:in`];
    const n = v !== undefined && v.trim() !== '' ? num(v) : base;
    return Number.isNaN(n) ? base : n;
  };
  const isChanged = (a: any) =>
    Math.abs(valueOf(a, 'now') - a.amount) > 0.004 || (a.invested && Math.abs(valueOf(a, 'in') - (a.amountIn ?? 0)) > 0.004);
  const changed = accounts.filter(isChanged).length;

  const submit = async () => {
    setBusy(true);
    await save({
      userId,
      month,
      // Unchanged accounts are saved too, so this month has a full picture.
      entries: accounts.map((a) => ({
        accountId: a._id,
        amount: valueOf(a, 'now'),
        ...(a.invested ? { amountIn: valueOf(a, 'in') } : {}),
      })),
    });
    setBusy(false);
    onNext();
  };

  const field = (a: any, key: 'now' | 'in', label: string) => {
    const k = key === 'now' ? a._id : `${a._id}:in`;
    const base = key === 'now' ? a.amount : a.amountIn ?? 0;
    return (
      <span style={{ display: 'flex', alignItems: 'center', fontSize: 15 }}>
        <span style={{ color: COLORS.muted }}>$</span>
        <input inputMode="decimal" aria-label={`${a.name} ${label}`}
          value={vals[k] ?? Math.round(base).toLocaleString('en-US')}
          onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
          style={AMOUNT_INPUT} />
      </span>
    );
  };

  return (
    <div className="bk-step" style={INNER}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={LABEL}>Balances</span>
        <h1 style={H1}>Change only what moved.</h1>
      </div>
      {(['now', 'soon', 'later'] as const).filter((g) => accounts.some((a) => a.group === g)).map((g) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, color: COLORS.muted, paddingBottom: 4 }}>{GROUP_LABEL[g]}</span>
          {accounts.filter((a) => a.group === g).map((a) => {
            const closer = valueOf(a, 'now') === 0 && vals[a._id] !== undefined && (
              <button type="button" className="bk-step" onClick={() => close({ userId, accountId: a._id, month })}
                style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: '0 0 10px', alignSelf: 'flex-start', fontSize: 13, color: COLORS.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Closed it? Hide {a.name}
              </button>
            );
            const dot = <span style={{ width: 6, height: 6, borderRadius: 999, background: isChanged(a) ? COLORS.green : 'transparent' }} />;
            if (!a.invested) {
              return (
                <div key={a._id} style={{ display: 'flex', flexDirection: 'column', boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 48 }}>
                    <span style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>{a.name}{dot}</span>
                    {field(a, 'now', 'balance')}
                  </label>
                  {closer}
                </div>
              );
            }
            // Investments: what went in, and what it's worth now.
            const gain = valueOf(a, 'now') - valueOf(a, 'in');
            return (
              <div key={a._id} style={{ display: 'flex', flexDirection: 'column', padding: '10px 0 4px', boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>{a.name}{dot}</span>
                  <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: Math.abs(gain) < 0.5 ? COLORS.muted : gain > 0 ? COLORS.green : COLORS.rust }}>
                    {Math.abs(gain) < 0.5 ? 'even' : `${gain > 0 ? '+' : '-'}${money(Math.abs(gain)).replace('-', '')}`}
                  </span>
                </span>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: COLORS.muted }}>Put in</span>
                    {field(a, 'in', 'put in')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: COLORS.muted }}>Now</span>
                    {field(a, 'now', 'worth now')}
                  </label>
                </span>
                {closer}
              </div>
            );
          })}
        </div>
      ))}
      <AddAccount userId={userId} />
      <button type="button" className="bk-btn" disabled={busy} onClick={submit}>
        {changed ? `Save ${changed} ${changed === 1 ? 'change' : 'changes'}` : 'Nothing moved. Next'}
      </button>
    </div>
  );
}

const GROUP_HINT: Record<string, string> = { now: 'Can use any time', soon: 'Locked for a while, like an FD', later: 'Long term, like CPF or stocks' };

function AddAccount({ userId }: { userId: any }) {
  const add = useMutation(api.accounts.addAccount);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<'now' | 'soon' | 'later'>('now');
  const [invested, setInvested] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, alignSelf: 'flex-start', minHeight: 44, fontSize: 15, color: COLORS.ink, display: 'flex', alignItems: 'center', gap: 8, marginTop: -12 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
        Add an account
      </button>
    );
  }
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await add({ userId, name, group, invested: invested || undefined });
    setBusy(false);
    setName('');
    setInvested(false);
    setOpen(false);
  };
  return (
    <div className="bk-step" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRadius: 18, background: '#FFFFFF', marginTop: -12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, color: COLORS.muted }}>Name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trust Bank"
          style={{ appearance: 'none', border: 0, background: 'transparent', fontSize: 17, padding: '8px 0', boxShadow: 'inset 0 -1px 0 #D9D2C6', outline: 'none', fontFamily: 'inherit' }} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['now', 'soon', 'later'] as const).map((g) => (
            <button key={g} type="button" className="bk-chip" onClick={() => setGroup(g)}
              style={group === g ? { background: COLORS.ink, color: '#FFFFFF' } : undefined}>{GROUP_LABEL[g]}</button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: COLORS.muted }}>{GROUP_HINT[group]}</span>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, cursor: 'pointer' }}>
        <input type="checkbox" checked={invested} onChange={(e) => setInvested(e.target.checked)} style={{ width: 18, height: 18, accentColor: COLORS.ink }} />
        Track what I put in, too
      </label>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button type="button" className="bk-btn" disabled={busy || !name.trim()} onClick={submit} style={{ flex: 1 }}>Add</button>
        <button type="button" onClick={() => setOpen(false)}
          style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, color: COLORS.muted, minHeight: 44 }}>Cancel</button>
      </div>
    </div>
  );
}

function FiledForYou({ groups, cups, onNext }: { groups: any[]; cups: any[]; onNext: () => void }) {
  const refile = useMutation(api.merchantRules.refile);
  const [open, setOpen] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  const nameOf = (id?: string) => cups.find((c) => c.id === id)?.name ?? '?';
  const count = groups.reduce((s, g) => s + g.count, 0);

  const move = async (g: any, to: any) => {
    for (const id of g.expenseIds) await refile({ expenseId: id, bucketId: to.id });
    setMoved((m) => ({ ...m, [g.merchant]: to.name }));
    setOpen(null);
    setToast(`${g.merchant}${g.count > 1 ? ` (all ${g.count})` : ''} moved to ${to.name}. It goes there from now on.`);
  };

  return (
    <div className="bk-step" style={INNER}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={LABEL}>Filed for you</span>
        <h1 style={H1}>{count ? `${count} sorted themselves. Anything wrong?` : 'Nothing was filed automatically.'}</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {groups.map((g) => {
          const cupName = moved[g.merchant] ?? nameOf(g.bucketId);
          return (
            <div key={g.merchant} style={{ display: 'flex', flexDirection: 'column', boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
              <button type="button" className="bk-row" onClick={() => setOpen(open === g.merchant ? null : g.merchant)}
                style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', minHeight: 56 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15 }}>{g.merchant}</span>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>{g.count > 1 ? `${g.count} times · ` : ''}{moneyExact(g.total)}</span>
                </span>
                <span style={{ fontSize: 15, color: moved[g.merchant] ? COLORS.green : COLORS.muted, whiteSpace: 'nowrap' }}>{cupName}</span>
              </button>
              {open === g.merchant && (
                <div className="bk-step" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 14 }}>
                  {cups.filter((c) => c.name !== cupName).map((c) => (
                    <button key={c.id} type="button" className="bk-chip" onClick={() => move(g, c)}>{c.name}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {toast && <span className="bk-step" style={{ fontSize: 14, color: COLORS.green }}>{toast}</span>}
      <button type="button" className="bk-btn" style={{ marginTop: 'auto' }} onClick={onNext}>Looks right. Next</button>
    </div>
  );
}

function Leftovers({ rows, cups, onDone }: { rows: any[]; cups: any[]; onDone: () => void }) {
  const confirm = useMutation(api.pendingTransactions.confirm);
  const notSpending = useMutation(api.merchantRules.markNotSpending);
  const markAsIncome = useMutation(api.pendingTransactions.markAsIncome);
  const markInvested = useMutation(api.merchantRules.markInvested);
  const [investing, setInvesting] = useState(false);
  const queue = useRef(rows).current; // freeze the order while filing
  const [i, setI] = useState(0);
  const [memo, setMemo] = useState('');
  const [toast, setToast] = useState('');
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const row = queue[i];
  const targets = useMemo(() => [...cups, { id: 'invest', name: 'Invested' }, { id: 'none', name: 'Not spending' }, { id: 'in', name: 'Money in' }], [cups]);

  useEffect(() => {
    if (!row && queue.length > 0) {
      const t = setTimeout(onDone, 1500);
      return () => clearTimeout(t);
    }
    if (queue.length === 0) onDone();
  }, [row]);

  const pick = (ci: number) => {
    if (fly || !row) return;
    const target = targets[ci];
    if (target.id === 'invest') return setInvesting(true);
    const col = ci % 4;
    const r = Math.floor(ci / 4);
    setFly({ x: (col - 1.5) * 86, y: 236 + r * 78 });
    setTimeout(async () => {
      const name = memo.trim();
      if (target.id === 'in') {
        await markAsIncome({ pendingId: row._id });
        setToast('Counted as money in. Pay near month end goes to next month.');
      } else if (target.id === 'none') {
        await notSpending({ pendingId: row._id });
        setToast('Got it. Left out of your cups.');
      } else {
        await confirm({ pendingId: row._id, bucketId: target.id, note: name || undefined });
        setToast(
          isPaymentCompany(row.merchant)
            ? `Filed to ${target.name}. That name is a payment company many shops use, so I will keep asking for it.`
            : `Filed to ${target.name}. Next time this files itself.`
        );
      }
      setLanded(ci);
      setTimeout(() => setLanded(null), 500);
      setFly(null);
      setMemo('');
      setI((n) => n + 1);
    }, 650);
  };

  const invest = async (accountId: any, name: string) => {
    if (!row) return;
    await markInvested({ pendingId: row._id, accountId });
    setToast(`Added to ${name}. Next time this goes there itself.`);
    setInvesting(false);
    setMemo('');
    setI((n) => n + 1);
  };

  const when = row
    ? new Date(row.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${row.bank.toUpperCase()}`
    : '';

  return (
    <div className="bk-step" style={INNER}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={LABEL}>{row ? `${queue.length - i} I couldn't file` : 'All filed'}</span>
        <h1 style={H1}>Which cup?</h1>
      </div>
      {row && (
        <div key={row._id} className="bk-step" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6, padding: 20, borderRadius: 18, background: '#FFFFFF',
            transform: fly ? `translate(${fly.x}px, ${fly.y}px) scale(0.08)` : 'none', opacity: fly ? 0 : 1, filter: fly ? 'blur(4px)' : 'none',
            transition: 'transform .7s cubic-bezier(0.55,0,0.7,0.4), opacity .7s ease, filter .7s ease',
          }}>
            <span style={{ fontSize: 13, color: COLORS.muted }}>{when}</span>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>{moneyExact(row.amount)}</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>Bank calls it {row.merchant ?? 'nothing'}</span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
              <span style={{ fontSize: 13, color: COLORS.muted }}>What was it? Optional</span>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. lunch at the hawker"
                style={{ appearance: 'none', border: 0, background: 'transparent', fontSize: 17, padding: '8px 0', boxShadow: 'inset 0 -1px 0 #D9D2C6', outline: 'none', fontFamily: 'inherit' }} />
            </label>
          </div>
          {investing ? <InvestPicker onPick={invest} onBack={() => setInvesting(false)} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 14, columnGap: 2 }}>
            {targets.map((c, ci) => (
              <button key={c.id} type="button" onClick={() => pick(ci)} aria-label={c.name}
                style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64 }}>
                <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transform: landed === ci ? 'translateY(3px) scale(1.08)' : 'none', transition: 'transform .5s cubic-bezier(0.16,0.9,0.4,1)' }}>
                  {c.id === 'invest' ? (
                    <InvestIcon />
                  ) : c.id === 'in' ? (
                    <div style={{ width: 34, height: 34, borderRadius: 999, boxShadow: `inset 0 0 0 1px ${COLORS.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={COLORS.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" /></svg>
                    </div>
                  ) : c.id === 'none' ? (
                    <div style={{ width: 34, height: 34, borderRadius: 999, boxShadow: 'inset 0 0 0 1px #D9D2C6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                    </div>
                  ) : (
                    <img src={cupSrc(c.name)} alt="" style={{ width: 44, height: 44, objectFit: 'contain', objectPosition: 'bottom', mixBlendMode: 'multiply' }} />
                  )}
                </div>
                <span style={{ fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap' }}>{c.name}</span>
              </button>
            ))}
          </div>
          )}
        </div>
      )}
      {toast && <span key={toast + i} className="bk-step" style={{ fontSize: 14, color: COLORS.green }}>{toast}</span>}
      {row && (
        <button type="button" onClick={onDone}
          style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: COLORS.muted, fontSize: 14, marginTop: 'auto', minHeight: 44 }}>
          Do the rest later
        </button>
      )}
    </div>
  );
}

function Done({ summary, month, onClose }: { summary: any; month: string; onClose: () => void }) {
  const [run, setRun] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRun(true), 300);
    return () => clearTimeout(t);
  }, []);
  const spend = useCountUp(summary.spendable, run);
  const nw = useCountUp(summary.netWorth?.total ?? 0, run);
  const cups = summary.shelves.flatMap((s: any) => s.cups).slice(0, 4);
  return (
    <div className="bk-step" style={INNER}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 40 }}>
        <span style={LABEL}>{monthLabel(month)} is set</span>
        <span style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{money(spend)}</span>
        <span style={{ fontSize: 15, color: COLORS.muted }}>yours to spend in {monthLabel(month)}</span>
      </div>
      {summary.netWorth && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: COLORS.muted }}>Net worth</span>
          <span style={{ fontWeight: 500 }}>{money(nw)}</span>
        </div>
      )}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cups.length}, minmax(0, 1fr))`, alignItems: 'end' }}>
          {cups.map((c: any, i: number) => (
            <div key={c.id} className="bk-cup" style={{ justifySelf: 'center', width: 56, height: 56, cursor: 'default' }}>
              <CupArt name={c.name} pct={run ? 100 : 0} size={56} delay={0.08 * i} />
            </div>
          ))}
        </div>
        <div className="bk-plank" />
        <span style={{ display: 'block', fontSize: 13, color: COLORS.muted, paddingTop: 12 }}>All your cups are filled.</span>
      </div>
      <button type="button" className="bk-btn" style={{ marginTop: 'auto' }} onClick={onClose}>Done</button>
    </div>
  );
}
