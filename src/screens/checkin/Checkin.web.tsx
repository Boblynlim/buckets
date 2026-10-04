import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../lib/AuthContext';
import { isPaymentCompany } from '../../../convex/lib/merchantKey';
import { CupArt } from '../home/Home.web';
import { COLORS, cupSrc, currentMonth, money, monthLabel, useHomeStyles } from '../home/homeStyles';

// Payday check-in: recap -> balances -> filed for you -> the few it couldn't
// file -> done (numbers count up, cups fill). Skipping is always fine.

const STEPS = 6;
const H1: React.CSSProperties = { fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 };
const LABEL: React.CSSProperties = { fontSize: 14, color: COLORS.muted };
const PAGE: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 3000, overflowY: 'auto' };
const INNER: React.CSSProperties = { maxWidth: 440, minHeight: '100%', margin: '0 auto', boxSizing: 'border-box', padding: '72px 24px 40px', display: 'flex', flexDirection: 'column', gap: 28 };

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
  const month = currentMonth();
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
  const cups = summary?.shelves.flatMap((s) => s.cups) ?? [];
  const pay = (income ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="bk-root" style={PAGE}>
      <div style={{ position: 'fixed', top: 28, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
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

function Recap({ recap, prevLabel, onNext }: { recap: any[]; prevLabel: string; onNext: () => void }) {
  const [drained, setDrained] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrained(true), 500);
    return () => clearTimeout(t);
  }, []);
  const left = recap.reduce((s, sh) => s + sh.left, 0);
  let k = 0;
  return (
    <div className="bk-step" style={INNER}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={LABEL}>{prevLabel}</span>
        <h1 style={H1}>{money(left)} left in your cups. It stays there for next month.</h1>
      </div>
      {recap.filter((sh) => sh.cups.length).map((sh) => {
        const cols = `repeat(${sh.cups.length}, minmax(0, 1fr))`;
        return (
          <div key={sh.name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: COLORS.muted }}>
              <span>{sh.name}</span>
              <span>{money(sh.left)} stays</span>
            </div>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'end' }}>
                {sh.cups.map((c: any) => {
                  const i = k++;
                  const pct = c.had > 0 ? (Math.max(0, c.left) / c.had) * 100 : 0;
                  return (
                    <div key={c.id} className="bk-cup" style={{ justifySelf: 'center', width: 44, height: 44, cursor: 'default' }}>
                      <CupArt name={c.name} pct={drained ? pct : 100} size={44} delay={0.1 * i} />
                    </div>
                  );
                })}
              </div>
              <div className="bk-plank" />
              <div style={{ display: 'grid', gridTemplateColumns: cols, paddingTop: 6 }}>
                {sh.cups.map((c: any) => (
                  <span key={c.id} style={{ fontSize: 12, textAlign: 'center', color: c.left > 0 ? COLORS.ink : '#B5ACA0', opacity: drained ? 1 : 0, transition: 'opacity .8s ease 1.2s' }}>
                    {c.left > 0 ? money(c.left) : '–'}
                  </span>
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

function Balances({ userId, month, accounts, onNext }: { userId: any; month: string; accounts: any[]; onNext: () => void }) {
  const save = useMutation(api.accounts.saveBalances);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const changed = Object.entries(vals).filter(([id, v]) => {
    const a = accounts.find((x) => x._id === id);
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return a && v.trim() !== '' && !Number.isNaN(n) && Math.abs(n - a.amount) > 0.004;
  });

  const submit = async () => {
    setBusy(true);
    await save({
      userId,
      month,
      // Unchanged accounts are saved too, so this month has a full picture.
      entries: accounts.map((a) => {
        const v = vals[a._id];
        const n = v !== undefined && v.trim() !== '' ? Number(v.replace(/[^0-9.]/g, '')) : a.amount;
        return { accountId: a._id, amount: Number.isNaN(n) ? a.amount : n };
      }),
    });
    setBusy(false);
    onNext();
  };

  return (
    <div className="bk-step" style={INNER}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={LABEL}>Balances</span>
        <h1 style={H1}>Change only what moved.</h1>
      </div>
      {(['now', 'soon', 'later'] as const).map((g) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, color: COLORS.muted, paddingBottom: 4 }}>{GROUP_LABEL[g]}</span>
          {accounts.filter((a) => a.group === g).map((a) => {
            const isChanged = changed.some(([id]) => id === a._id);
            return (
              <label key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 48, boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
                <span style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.name}
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: isChanged ? COLORS.green : 'transparent' }} />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 15 }}>
                  <span style={{ color: COLORS.muted }}>$</span>
                  <input
                    inputMode="decimal"
                    aria-label={`${a.name} balance`}
                    value={vals[a._id] ?? Math.round(a.amount).toLocaleString('en-US')}
                    onChange={(e) => setVals((v) => ({ ...v, [a._id]: e.target.value }))}
                    style={{ appearance: 'none', border: 0, background: 'transparent', width: 100, textAlign: 'right', fontSize: 15, padding: '8px 0', outline: 'none', fontFamily: 'inherit' }}
                  />
                </span>
              </label>
            );
          })}
        </div>
      ))}
      <button type="button" className="bk-btn" disabled={busy} onClick={submit}>
        {changed.length ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}` : 'Nothing moved. Next'}
      </button>
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
                  <span style={{ fontSize: 13, color: COLORS.muted }}>{g.count > 1 ? `${g.count} times · ` : ''}{money(g.total)}</span>
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
  const queue = useRef(rows).current; // freeze the order while filing
  const [i, setI] = useState(0);
  const [memo, setMemo] = useState('');
  const [toast, setToast] = useState('');
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const row = queue[i];
  const targets = useMemo(() => [...cups, { id: 'none', name: 'Not spending' }], [cups]);

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
    const col = ci % 4;
    const r = Math.floor(ci / 4);
    setFly({ x: (col - 1.5) * 86, y: 236 + r * 78 });
    setTimeout(async () => {
      const name = memo.trim();
      if (target.id === 'none') {
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
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>{money(row.amount)}</span>
            <span style={{ fontSize: 13, color: COLORS.muted }}>Bank calls it {row.merchant ?? 'nothing'}</span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
              <span style={{ fontSize: 13, color: COLORS.muted }}>What was it? Optional</span>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. lunch at the hawker"
                style={{ appearance: 'none', border: 0, background: 'transparent', fontSize: 17, padding: '8px 0', boxShadow: 'inset 0 -1px 0 #D9D2C6', outline: 'none', fontFamily: 'inherit' }} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 14, columnGap: 2 }}>
            {targets.map((c, ci) => (
              <button key={c.id} type="button" onClick={() => pick(ci)} aria-label={c.name}
                style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64 }}>
                <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transform: landed === ci ? 'translateY(3px) scale(1.08)' : 'none', transition: 'transform .5s cubic-bezier(0.16,0.9,0.4,1)' }}>
                  {c.id === 'none' ? (
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
