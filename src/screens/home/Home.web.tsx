import React, { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../lib/AuthContext';
import { CupSheet } from './CupSheet.web';
import { COLORS, cupSrc, currentMonth, money, monthLabel, useHomeStyles } from './homeStyles';

type Cup = { id: string; name: string; left: number; full: number; carry: number; funded: number; spent: number };

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

function Shelf({ name, total, cups, filled, onPick, startIndex }: {
  name: string; total: number; cups: Cup[]; filled: boolean; onPick: (c: Cup) => void; startIndex: number;
}) {
  const cols = `repeat(${cups.length}, minmax(0, 1fr))`;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: COLORS.muted }}>
        <span>{name}</span>
        <span>{money(total)} left</span>
      </div>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'end' }}>
          {cups.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="bk-cup"
              onClick={() => onPick(c)}
              aria-label={`${c.name}, ${money(c.left)} left`}
              style={{ justifySelf: 'center', width: 52, height: 52 }}
            >
              <CupArt name={c.name} pct={pctLeft(c)} size={52} filled={filled} delay={0.06 * (startIndex + i)} />
            </button>
          ))}
        </div>
        <div className="bk-plank" />
        <div style={{ display: 'grid', gridTemplateColumns: cols, paddingTop: 12 }}>
          {cups.map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 11.5, color: '#6E6258', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: c.full > 0 && pctLeft(c) < 25 ? COLORS.rust : COLORS.ink }}>
                {money(c.left)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Bar({ pct, color = COLORS.ink }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 2, background: COLORS.hairline, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color }} />
    </div>
  );
}

export function Home({ onOpenCheckin }: { onOpenCheckin: () => void }) {
  useHomeStyles();
  const { user } = useAuth();
  const month = currentMonth();
  const data = useQuery(api.home.summary, user ? { userId: user._id, month } : 'skip');
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
    <div className="bk-root" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '64px 24px 140px', display: 'flex', flexDirection: 'column', gap: 44 }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, color: COLORS.muted }}>{monthLabel(month)}</span>
          <span style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{money(data.spendable)}</span>
          <span style={{ fontSize: 15, color: COLORS.muted }}>yours to spend this month</span>
        </section>

        {data.pendingCount > 0 && (
          <button type="button" className="bk-row" onClick={onOpenCheckin}
            style={{ appearance: 'none', border: 0, background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15 }}>
            <span>{data.pendingCount} to file</span>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Open check-in</span>
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
        </section>

        {data.netWorth && (
          <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '16px 0', boxShadow: `inset 0 1px 0 ${COLORS.hairline}, inset 0 -1px 0 ${COLORS.hairline}` }}>
            <span style={{ fontSize: 15, color: COLORS.muted }}>Net worth</span>
            <span style={{ fontSize: 15 }}>
              <span style={{ fontWeight: 500 }}>{money(data.netWorth.total)}</span>{' '}
              {data.netWorth.change !== 0 && (
                <span style={{ color: data.netWorth.change > 0 ? COLORS.green : COLORS.rust }}>
                  {data.netWorth.change > 0 ? '+' : '-'}{(Math.abs(data.netWorth.change) / 1000).toFixed(1)}k
                </span>
              )}
            </span>
          </section>
        )}

        {data.shelves.filter((s) => s.cups.length).map((s) => {
          const start = index;
          index += s.cups.length;
          return <Shelf key={s.name} name={s.name} total={s.total} cups={s.cups as Cup[]} filled={filled} startIndex={start} onPick={setPicked} />;
        })}
      </div>

      {picked && (
        <CupSheet
          cup={picked}
          month={month}
          allCups={data.shelves.flatMap((s) => s.cups as Cup[])}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
