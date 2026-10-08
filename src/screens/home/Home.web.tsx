import React, { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../lib/AuthContext';
import { CupSheet } from './CupSheet.web';
import { NextAdventure } from './Adventures.web';
import { NetWorthSheet } from './NetWorthSheet.web';
import { playClink } from '../../utils/cupClink';
import { MoruLogo } from '../../components/MoruLogo';
import { NET_WORTH_EVENT, takeNetWorthRequest } from '../../components/Dock.web';
import { COLORS, SAFE_TOP, cupSrc, currentMonth, money, monthLabel, useHomeStyles } from './homeStyles';

type Cup = { id: string; name: string; left: number; full: number; carry: number; funded: number; spent: number; planned?: number; kind?: 'bill' | 'invest' };

// A pottery cup coloured up to what's left; the empty part is a grey ghost.
export function CupArt({ name, pct, size, delay = 0, filled = true }: { name: string; pct: number; size: number; delay?: number; filled?: boolean }) {
  const top = filled ? Math.max(0, Math.min(100, 100 - pct)) : 100;
  return (
    <>
      <img className="ghost" src={cupSrc(name)} alt="" />
      <img
        className="glaze"
        src={cupSrc(name)}
        alt=""
        style={{ clipPath: `inset(${top}% 0 0 0)`, transitionDelay: `${delay}s` }}
      />
      <span style={{ display: 'block', width: size, height: size }} />
    </>
  );
}

const pctLeft = (c: Cup) => (c.full > 0 ? (Math.max(0, c.left) / c.full) * 100 : 0);

function Shelf({ name, total, cups, filled, onPick, startIndex, past }: {
  name: string; total: number; cups: Cup[]; filled: boolean; onPick: (c: Cup) => void; startIndex: number; past?: boolean;
}) {
  const cols = `repeat(${cups.length}, minmax(0, 1fr))`;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: COLORS.muted }}>
        <span>{name}</span>
        <span>{past ? `${money(cups.reduce((s, c) => s + c.spent, 0))} spent` : `${money(total)} left`}</span>
      </div>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'end' }}>
          {cups.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="bk-cup"
              onClick={() => onPick(c)}
              aria-label={past ? `${c.name}, ${money(c.spent)} spent` : `${c.name}, ${money(c.left)} left`}
              style={{ justifySelf: 'center', width: 52, height: 52 }}
            >
              <CupArt name={c.name} pct={past ? 100 : pctLeft(c)} size={52} filled={filled} delay={0.06 * (startIndex + i)} />
            </button>
          ))}
        </div>
        <div className="bk-plank" />
        <div style={{ display: 'grid', gridTemplateColumns: cols, paddingTop: 12 }}>
          {cups.map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 11.5, color: COLORS.muted, whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: past ? (c.spent > 0 ? COLORS.ink : COLORS.faint) : c.full > 0 && pctLeft(c) < 25 ? COLORS.rust : COLORS.ink }}>
                {past ? (c.spent > 0 ? money(c.spent) : '–') : money(c.left)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// An empty ring for a bill not paid yet; a green tick once it is.
function PaidRing({ done, partial, quiet }: { done: boolean; partial: boolean; quiet?: boolean }) {
  return (
    <span aria-hidden style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: done ? COLORS.green : 'transparent', boxShadow: done ? 'none' : `inset 0 0 0 1.5px ${partial ? COLORS.green : quiet ? COLORS.hairline : COLORS.line}`, transition: 'background .4s ease' }}>
      {done && <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke={COLORS.wall} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5l2.5 2.5L11 4.5" /></svg>}
    </span>
  );
}

// The potter's signature on the base of a pot: the Moru wordmark, small and
// faint, at the very bottom of Home. Tap it and it redraws with a soft clink.
function MakersMark() {
  const [rung, setRung] = useState(0);
  return (
    <button type="button" className="bk-mark" onClick={() => { playClink(String(rung % 10)); setRung((n) => n + 1); }} aria-label="Moru">
      <MoruLogo key={rung} width={64} color={COLORS.faint} draw={rung > 0} />
      {rung >= 3 && <span className="bk-fade-in">Made one cup at a time.</span>}
    </button>
  );
}

function Bar({ pct, color = COLORS.ink }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 2, background: COLORS.hairline, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color }} />
    </div>
  );
}

const FIRST_MONTH = '2025-08'; // the money sheet starts here

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return out;
}

const shortMonth = (mm: string) => new Date(Number(mm.slice(0, 4)), Number(mm.slice(5)) - 1, 1).toLocaleString('en-GB', { month: 'short' });

// A quiet pill with the month. Tap it and a strip of months slides open; an
// ink highlight glides to the one you pick, then the strip folds away.
function MonthPicker({ month, thisMonth, onChange }: { month: string; thisMonth: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const chipRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const months = monthsBetween(FIRST_MONTH, thisMonth);
  const year = month.slice(0, 4) !== thisMonth.slice(0, 4) ? ` ${month.slice(0, 4)}` : '';

  React.useLayoutEffect(() => {
    if (!open) return;
    const el = chipRefs.current[month];
    const strip = stripRef.current;
    if (!el || !strip) return;
    setInd({ left: el.offsetLeft, width: el.offsetWidth });
    strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2, behavior: ind ? 'smooth' : 'auto' });
  }, [open, month]);

  const pick = (m: string) => {
    onChange(m);
    setTimeout(() => setOpen(false), 420);
  };

  return (
    <div style={{ position: 'relative', height: 40, display: 'flex', alignItems: 'center' }}>
      {!open ? (
        <button type="button" className="bk-month-pill bk-fade-in" onClick={() => { setInd(null); setOpen(true); }} aria-expanded={false} aria-label={`Showing ${monthLabel(month)}${year}. Change month`}>
          {monthLabel(month)}{year}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4l2.5 2.5L7.5 4" /></svg>
        </button>
      ) : (
        <div ref={stripRef} className="bk-month-strip bk-scroll bk-fade-in" role="listbox" aria-label="Choose a month">
          {ind && <span className="bk-month-ind" style={{ left: ind.left, width: ind.width }} />}
          {months.map((mm) => (
            <button key={mm} type="button" role="option" aria-selected={mm === month}
              ref={(el) => { chipRefs.current[mm] = el; }}
              className={mm === month ? 'on' : ''} onClick={() => pick(mm)}>
              {mm === thisMonth ? 'Now' : shortMonth(mm)}
              {mm.slice(5) === '01' || mm === FIRST_MONTH ? <span className="yr">{mm.slice(2, 4)}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Home({ onOpenCheckin, onOpenQueue, onEditExpense }: { onOpenCheckin: () => void; onOpenQueue?: () => void; onEditExpense?: (expense: any, bucket: any) => void }) {
  useHomeStyles();
  const { user } = useAuth();
  const thisMonth = currentMonth();
  const [month, setMonth] = useState(thisMonth);
  const [showNetWorth, setShowNetWorth] = useState<false | 'view' | 'edit'>(false);
  // The dock's "Update balances" opens the net worth sheet straight at the balances.
  useEffect(() => {
    const on = () => { if (takeNetWorthRequest()) setShowNetWorth('edit'); };
    on();
    window.addEventListener(NET_WORTH_EVENT, on);
    return () => window.removeEventListener(NET_WORTH_EVENT, on);
  }, []);
  const past = month !== thisMonth;

  const fresh = useQuery(api.home.summary, user ? { userId: user._id, month } : 'skip');
  // Keep showing the last month while the next one loads (no blank flash).
  const [last, setLast] = useState<typeof fresh>(undefined);
  useEffect(() => { if (fresh) setLast(fresh); }, [fresh]);
  const data = fresh ?? last;
  const [filled, setFilled] = useState(false);
  const [picked, setPicked] = useState<Cup | null>(null);

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setFilled(true), 350);
    return () => clearTimeout(t);
  }, [!!data]);

  if (!data) return <div className="bk-root" style={{ minHeight: '100vh' }} />;

  const emergency = data.goals.find((g) => /emergency/i.test(g.name));
  const reno = data.goals.find((g) => /reno/i.test(g.name));
  const backup = data.earmarks.find((e) => reno && e.goalBucketId === reno.id);
  let index = 0;

  return (
    // The page itself is locked (html/body overflow hidden), so Home scrolls.
    <div className="bk-root bk-scroll" style={{ height: '100vh', overflowY: 'auto', scrollbarWidth: 'none' as any }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: `calc(${SAFE_TOP} + 20px) 24px 140px`, display: 'flex', flexDirection: 'column', gap: 44 }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MonthPicker month={month} thisMonth={thisMonth} onChange={setMonth} />
          <span key={month} className="bk-step" style={{ fontSize: 56, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {past ? money(data.shelves.reduce((s, sh) => s + sh.cups.reduce((t, c) => t + c.spent, 0), 0)) : money(data.spendable)}
          </span>
          <span key={month + 'c'} className="bk-step" style={{ fontSize: 15, color: COLORS.muted }}>{past ? `spent from your cups in ${monthLabel(month)}` : 'yours to spend this month'}</span>
        </section>

        {!past && data.pendingCount - (data.moneyInCount ?? 0) > 0 && (
          <button type="button" className="bk-row" onClick={onOpenCheckin}
            style={{ appearance: 'none', border: 0, background: COLORS.sheet, borderRadius: 14, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15 }}>
            <span>{data.pendingCount - (data.moneyInCount ?? 0)} to file</span>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Open check-in</span>
          </button>
        )}
        {!past && (data.moneyInCount ?? 0) > 0 && onOpenQueue && (
          <button type="button" className="bk-row" onClick={onOpenQueue}
            style={{ appearance: 'none', border: 0, background: COLORS.sheet, borderRadius: 14, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, marginTop: -32 }}>
            <span>{data.moneyInCount} money in to sort</span>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Paid back, refund or income</span>
          </button>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>Saved</span>
          {emergency && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
              <span>{emergency.name}</span>
              <span style={{ color: COLORS.muted }}>
                {money(emergency.balance)}{emergency.balance >= emergency.target ? ' · full' : ` of ${money(emergency.target)}`}
              </span>
            </div>
          )}
          {reno && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                <span>{reno.name}</span>
                <span style={{ color: COLORS.muted }}>{money(reno.balance)} of {money(reno.target)}</span>
              </div>
              <Bar pct={(reno.balance / Math.max(1, reno.target)) * 100} />
              {backup && <span style={{ fontSize: 13, color: COLORS.muted }}>Plus {money(backup.amount)} {backup.name.toLowerCase()} in the bank</span>}
            </div>
          )}
          {user && <NextAdventure userId={user._id} />}
        </section>

        {data.netWorth && (
          <button type="button" className="bk-row" onClick={() => setShowNetWorth('view')}
            style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: COLORS.ink, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '16px 0', boxShadow: `inset 0 1px 0 ${COLORS.hairline}, inset 0 -1px 0 ${COLORS.hairline}` }}>
            <span style={{ fontSize: 15, color: COLORS.muted }}>Net worth</span>
            <span style={{ fontSize: 15 }}>
              <span style={{ fontWeight: 500 }}>{money(data.netWorth.total)}</span>{' '}
              {data.netWorth.change !== 0 && (
                <span style={{ color: data.netWorth.change > 0 ? COLORS.green : COLORS.rust }}>
                  {data.netWorth.change > 0 ? '+' : '-'}{(Math.abs(data.netWorth.change) / 1000).toFixed(1)}k
                </span>
              )}
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}><path d="M2 2l4 4-4 4" /></svg>
            </span>
          </button>
        )}

        {data.shelves.filter((s) => s.cups.length).map((s) => {
          const start = index;
          index += s.cups.length;
          return <Shelf key={s.name} name={s.name} total={s.total} cups={s.cups as Cup[]} filled={filled} startIndex={start} onPick={setPicked} past={past} />;
        })}

        {/* Goes out before spending: bills and regular investing. A quiet
            checklist under the cups; each ring fills once that month is paid. */}
        {([['Fixed', data.fixedCups ?? [], 'paid'], ['Investing', data.investCups ?? [], 'in']] as const).filter(([, cups]) => cups.length).map(([name, cups, verb]) => {
          const planned = cups.reduce((t, c) => t + c.planned, 0);
          const paid = cups.reduce((t, c) => t + Math.min(c.spent, c.planned || c.spent), 0);
          const allDone = cups.every((c) => c.planned <= 0 || c.spent >= c.planned - 0.5);
          return (
            <section key={name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: COLORS.muted }}>
                <span>{name}</span>
                {past ? <span>{money(cups.reduce((t, c) => t + c.spent, 0))} {verb}</span>
                  : allDone && planned > 0 ? <span style={{ color: COLORS.green }}>All {verb} this month</span>
                  : <span>{money(paid)} of {money(planned)} {verb}</span>}
              </div>
              <div>
                {cups.map((c) => {
                  const done = c.planned > 0 && c.spent >= c.planned - 0.5;
                  return (
                    <button key={c.id} type="button" className="bk-row" onClick={() => setPicked({ ...c, kind: name === 'Fixed' ? 'bill' : 'invest' } as Cup)}
                      style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: COLORS.ink, padding: 0, width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
                      <PaidRing done={done} partial={!done && c.spent > 0} quiet={c.planned <= 0} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ flexShrink: 0, fontSize: 15, color: done ? COLORS.ink : COLORS.muted }}>
                        {done || c.planned <= 0 ? (c.spent > 0 ? money(c.spent) : '–') : c.spent > 0 ? `${money(c.spent)} of ${money(c.planned)}` : money(c.planned)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <MakersMark />
      </div>

      {showNetWorth && user && <NetWorthSheet userId={user._id} startEditing={showNetWorth === 'edit'} onClose={() => setShowNetWorth(false)} />}

      {picked && (
        <CupSheet
          cup={picked}
          past={past}
          month={month}
          allCups={data.shelves.flatMap((s) => s.cups as Cup[])}
          onClose={() => setPicked(null)}
          onEdit={onEditExpense ? (t) => {
            const cup = picked;
            setPicked(null);
            onEditExpense(
              { _id: t.id, note: t.note, amount: t.amount, date: t.date, bucketId: cup.id, userId: user?._id },
              { _id: cup.id, name: cup.name },
            );
          } : undefined}
        />
      )}
    </div>
  );
}
