import React, { useEffect, useState } from 'react';
// @ts-ignore react-dom has no type definitions in this repo
import { createPortal } from 'react-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { COLORS, SAFE_TOP, currentMonth, money } from './homeStyles';
import { Balances } from '../checkin/Checkin.web';

// Net worth: month by month, then every account (tap a name to fix it,
// type a balance to update this month).

const monthShort = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleString('en-GB', { month: 'short' });
const monthLong = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
const k = (n: number) => `${n < 0 ? '-' : '+'}${money(Math.abs(n))}`;

export function NetWorthSheet({ userId, onClose }: { userId: any; onClose: () => void }) {
  const history = useQuery(api.accounts.netWorthHistory, { userId });
  const accounts = useQuery(api.accounts.list, { userId });
  const months = (history ?? []).slice(-12);
  const [sel, setSel] = useState<number | null>(null);
  const i = sel ?? months.length - 1;
  const cur = months[i];
  const prev = i > 0 ? months[i - 1] : undefined;
  const max = Math.max(1, ...months.map((m) => m.total));
  // What moved since the month before, biggest first.
  const moves = cur && prev
    ? cur.byAccount
        .map((a) => ({ name: a.name, change: a.amount - (prev.byAccount.find((p) => p.id === a.id)?.amount ?? 0) }))
        .filter((m) => Math.abs(m.change) >= 1)
        .sort((x, y) => Math.abs(y.change) - Math.abs(x.change))
    : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <>
      <div className="bk-scrim" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,27,23,0.2)', zIndex: 2000 }} />
      <div className="bk-sheet bk-root" role="dialog" aria-label="Net worth"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, top: `calc(${SAFE_TOP} + 8px)`, zIndex: 2001, maxWidth: 480, margin: '0 auto', background: COLORS.wall, borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 12px 0 24px' }}>
          <span style={{ fontSize: 15, color: COLORS.muted }}>Net worth</span>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>

        <div className="bk-scroll" style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as any, padding: '8px 24px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', flexDirection: 'column', gap: 32 }}>
          {cur && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{money(cur.total)}</span>
              <span style={{ fontSize: 15, color: COLORS.muted }}>
                {monthLong(cur.month)}
                {prev && (
                  <>
                    {' · '}
                    <span style={{ color: Math.abs(cur.total - prev.total) < 0.5 ? COLORS.muted : cur.total > prev.total ? COLORS.green : COLORS.rust }}>
                      {Math.abs(cur.total - prev.total) < 0.5 ? 'same as' : k(cur.total - prev.total)}
                    </span>
                    {Math.abs(cur.total - prev.total) < 0.5 ? ' ' : ' on '}{monthShort(prev.month)}
                  </>
                )}
              </span>
            </div>
          )}

          {months.length > 1 && (
            // One bar per month; tap a bar to see that month.
            <div role="group" aria-label="Net worth by month" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
              {months.map((m, j) => (
                <button key={m.month} type="button" onClick={() => setSel(j)}
                  aria-label={`${monthLong(m.month)}: ${money(m.total)}`} aria-pressed={j === i}
                  style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0, flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: '100%', maxWidth: 18, height: `${Math.max(2, (m.total / max) * 92)}px`, borderRadius: '4px 4px 0 0', background: j === i ? COLORS.ink : '#D9D2C6', transition: 'background .3s ease' }} />
                  <span style={{ fontSize: 11, color: j === i ? COLORS.ink : COLORS.muted }}>{monthShort(m.month).slice(0, 1)}</span>
                </button>
              ))}
            </div>
          )}

          {prev && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, color: COLORS.muted, paddingBottom: 4 }}>What moved since {monthShort(prev.month)}</span>
              {moves.length === 0 && <span style={{ fontSize: 15, color: COLORS.muted, padding: '10px 0' }}>Nothing changed</span>}
              {moves.map((m) => (
                <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44, boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
                  <span style={{ fontSize: 15 }}>{m.name}</span>
                  <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', color: m.change > 0 ? COLORS.green : COLORS.rust }}>{k(m.change)}</span>
                </div>
              ))}
            </div>
          )}

          {accounts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, color: COLORS.muted }}>Your accounts. Change a balance, or tap a name to edit it</span>
              <Balances userId={userId} month={currentMonth()} accounts={accounts} onNext={onClose} inSheet />
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
