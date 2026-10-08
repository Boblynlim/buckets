import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
// @ts-ignore react-dom has no type definitions in this repo
import { createPortal } from 'react-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { COLORS, SAFE_TOP, currentMonth, money } from './homeStyles';
import { Balances } from '../checkin/Checkin.web';

// Net worth: the total rolls in digit by digit, one soft curve you can
// scrub month by month, where it sits (Now / Soon / Later), and what moved.
// Balances are one tap away ("Update balances") so the sheet stays short.

const WALNUT = '#5C361E';
const CLAY = '#B98563';
const CARD = '#FBF9F5';
const SAND = '#EAE4DA';
const EASE = 'cubic-bezier(0.16,0.9,0.4,1)';

const CSS = `
.nw-odo { display: inline-flex; overflow: hidden; height: 1em; line-height: 1em; }
.nw-odo i { display: flex; flex-direction: column; font-style: normal; transition: transform 1.1s ${EASE}; }
.nw-odo b { height: 1em; font-weight: inherit; text-align: center; }
.nw-odo .sep { margin: 0 -.04em 0 -.08em; }
.nw-card { background: ${CARD}; border-radius: 24px; box-shadow: 0 10px 24px -18px rgba(45,28,16,.35); }
.nw-tk { flex: 1; display: flex; justify-content: center; align-items: flex-end; height: 100%; }
.nw-tk i { width: 4px; height: 10px; border-radius: 99px; background: #D9D0C3; transition: height .45s ${EASE}, width .3s ease, background .3s ease; }
.nw-tk.near i { height: 15px; background: #CBBBA8; }
.nw-tk.sel i { height: 24px; width: 5px; background: ${WALNUT}; }
.nw-fill { height: 100%; border-radius: 99px; background: ${WALNUT}; transition: width 1.1s ${EASE}; }
.nw-rise { animation: nwRise .6s ${EASE} backwards; }
@keyframes nwRise { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
@media (prefers-reduced-motion: reduce) { .nw-odo i, .nw-tk i, .nw-fill, .nw-rise { transition: none; animation: none; } }
`;

const monthShort = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleString('en-GB', { month: 'short' });
const monthLong = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
const thousands = (n: number) => `$${Math.round(n / 1000)}k`;

/** Rolls each digit into place (from 0 on first show), like the curriculum's week number. */
function Odometer({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  const target = Math.round(value).toLocaleString('en-US');
  const now = Math.round(shown).toLocaleString('en-US').padStart(target.length, '0');
  // Key columns from the right so a digit keeps its column as the number changes.
  return (
    <span className="nw-odo" aria-label={`$${target}`}>
      {target.split('').map((ch, i) => {
        const key = target.length - i;
        if (ch === ',') return <span key={`s${key}`} className="sep" aria-hidden="true">,</span>;
        const d = Number(now[i]) || 0;
        return (
          <i key={key} aria-hidden="true" style={{ transform: `translateY(${-d}em)`, transitionDelay: `${i * 45}ms` }}>
            {'0123456789'.split('').map((n) => <b key={n}>{n}</b>)}
          </i>
        );
      })}
    </span>
  );
}

/** Catmull-Rom through the points, as Bezier curves: rounded, no corners. */
function smooth(pts: [number, number][]) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2, t = 0.18;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const W = 300, H = 140, PAD_T = 18, PAD_B = 12;

function Curve({ totals, sel, onPick }: { totals: number[]; sel: number; onPick: (i: number) => void }) {
  const line = useRef<SVGPathElement>(null);
  const ticks = useRef<HTMLDivElement>(null);
  const down = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const lo = Math.min(...totals) * 0.985, hi = Math.max(...totals) * 1.005;
  const x = (i: number) => 10 + (i / Math.max(1, totals.length - 1)) * (W - 20);
  const y = (v: number) => PAD_T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - PAD_T - PAD_B);
  const pts = totals.map((v, i) => [x(i), y(v)] as [number, number]);
  const d = smooth(pts);

  // Draw the line in once, on open.
  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    el.getBoundingClientRect();
    el.style.transition = `stroke-dashoffset 1.6s ${EASE}`;
    el.style.strokeDashoffset = '0';
    const t = setTimeout(() => setDrawn(true), 1100);
    return () => clearTimeout(t);
  }, []);

  const pickAt = (clientX: number) => {
    const els = Array.from(ticks.current?.querySelectorAll<HTMLElement>('[data-i]') ?? []);
    let best = sel, bestD = Infinity;
    for (const t of els) {
      const r = t.getBoundingClientRect();
      const dist = Math.abs(clientX - (r.left + r.width / 2));
      if (dist < bestD) { bestD = dist; best = Number(t.dataset.i); }
    }
    if (best !== sel) onPick(best);
  };
  const scrub = {
    onPointerDown: (e: React.PointerEvent) => { down.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pickAt(e.clientX); },
    onPointerMove: (e: React.PointerEvent) => { if (down.current) pickAt(e.clientX); },
    onPointerUp: () => { down.current = false; },
  };
  const [mx, my] = pts[sel] ?? [0, 0];
  const marker = { transform: `translate(${mx}px, ${my}px)`, transition: `transform .5s ${EASE}, opacity .6s ease`, opacity: drawn ? 1 : 0 };

  return (
    <div {...scrub} style={{ touchAction: 'none', cursor: 'ew-resize' }}
      role="slider" aria-label="Month" aria-valuemin={1} aria-valuemax={totals.length} aria-valuenow={sel + 1} tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' && sel > 0) onPick(sel - 1);
        if (e.key === 'ArrowRight' && sel < totals.length - 1) onPick(sel + 1);
      }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={CLAY} stopOpacity=".28" />
            <stop offset="1" stopColor={CLAY} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="nwGlow">
            <stop offset="0" stopColor={CLAY} stopOpacity=".45" />
            <stop offset="1" stopColor={CLAY} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={`${d} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`} fill="url(#nwFill)" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 1.2s ease' }} />
        <path ref={line} d={d} fill="none" stroke={WALNUT} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={0} x2={0} y1={PAD_T - 8} y2={H} stroke={WALNUT} strokeOpacity={0.15} strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round"
          style={{ transform: `translateX(${mx}px)`, transition: marker.transition, opacity: marker.opacity }} />
        <circle r={16} fill="url(#nwGlow)" style={marker} />
        <circle r={6} fill={WALNUT} stroke={CARD} strokeWidth={3} style={marker} />
      </svg>
      <div ref={ticks} style={{ display: 'flex', alignItems: 'flex-end', height: 32, marginTop: 6 }}>
        {totals.map((_, i) => (
          <span key={i} data-i={i} className={`nw-tk${i === sel ? ' sel' : Math.abs(i - sel) === 1 ? ' near' : ''}`}><i /></span>
        ))}
      </div>
    </div>
  );
}

export function NetWorthSheet({ userId, onClose, startEditing = false }: { userId: any; onClose: () => void; startEditing?: boolean }) {
  const history = useQuery(api.accounts.netWorthHistory, { userId });
  const accounts = useQuery(api.accounts.list, { userId });
  const months = (history ?? []).slice(-12);
  const [sel, setSel] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(startEditing);
  const editRef = React.useRef<HTMLDivElement>(null);
  // Opened from the dock's "Update balances": glide down to the balances once they're there.
  React.useEffect(() => {
    if (!startEditing || !accounts) return;
    const t = window.setTimeout(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
    return () => window.clearTimeout(t);
  }, [startEditing, !!accounts]);
  const i = sel ?? months.length - 1;
  const cur = months[i];
  const prev = i > 0 ? months[i - 1] : undefined;
  const change = cur && prev ? cur.total - prev.total : 0;
  // What moved since the month before, biggest first.
  const moves = cur && prev
    ? cur.byAccount
        .map((a) => ({ name: a.name, change: a.amount - (prev.byAccount.find((p) => p.id === a.id)?.amount ?? 0) }))
        .filter((m) => Math.abs(m.change) >= 1)
        .sort((x, y) => Math.abs(y.change) - Math.abs(x.change))
    : [];
  const biggest = Math.max(1, ...moves.map((m) => Math.abs(m.change)));
  const [grow, setGrow] = useState(false);
  useEffect(() => {
    setGrow(false);
    const t = setTimeout(() => setGrow(true), 30);
    return () => clearTimeout(t);
  }, [i, showAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="bk-scrim" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,27,23,0.2)', zIndex: 2000 }} />
      <div className="bk-sheet bk-root" role="dialog" aria-label="Net worth"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, top: `calc(${SAFE_TOP} + 8px)`, zIndex: 2001, maxWidth: 480, margin: '0 auto', background: COLORS.wall, borderRadius: '28px 28px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0 22px' }}>
          <span style={{ fontSize: 15, color: COLORS.muted }}>Net worth</span>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ appearance: 'none', border: 0, background: SAND, cursor: 'pointer', width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>

        <div className="bk-scroll" style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as any, padding: '12px 22px calc(env(safe-area-inset-bottom, 0px) + 32px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {cur && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', fontSize: 52, fontWeight: 500, letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: '0.62em', fontWeight: 500, color: COLORS.muted, marginRight: 2, transform: 'translateY(-0.32em)' }}>$</span>
                <Odometer value={cur.total} />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: COLORS.muted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 999, background: SAND, fontWeight: 500,
                  color: !prev || Math.abs(change) < 1 ? COLORS.muted : change > 0 ? COLORS.green : COLORS.rust }}>
                  {!prev ? 'First month' : Math.abs(change) < 1 ? 'No change' : `${change > 0 ? '↑' : '↓'} ${money(Math.abs(change))}`}
                </span>
                {prev ? `${monthLong(cur.month)}, vs ${monthShort(prev.month)}` : monthLong(cur.month)}
              </span>
            </div>
          )}

          {months.length > 1 && cur && (
            <div className="nw-card" style={{ padding: '18px 16px 16px' }}>
              <Curve totals={months.map((m) => m.total)} sel={i} onPick={setSel} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
                <span>{monthShort(months[0].month)} ’{months[0].month.slice(2, 4)}</span>
                <span>{monthShort(months[months.length - 1].month)} ’{months[months.length - 1].month.slice(2, 4)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 14, paddingTop: 14, boxShadow: `inset 0 1px 0 ${COLORS.hairline}` }}>
                {([['now', 'Now'], ['soon', 'Soon'], ['later', 'Later']] as const).map(([g, label], j) => (
                  <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: j ? 14 : 0, boxShadow: j ? `inset 1px 0 0 ${COLORS.hairline}` : undefined }}>
                    <span style={{ fontSize: 12, color: COLORS.muted }}>{label}</span>
                    <span style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{thousands(cur[g])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {prev && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 13, color: COLORS.muted, paddingLeft: 2 }}>What moved since {monthShort(prev.month)}</span>
              <div className="nw-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {moves.length === 0 && <span style={{ fontSize: 15, color: COLORS.muted }}>Nothing moved this month.</span>}
                {(showAll ? moves : moves.slice(0, 4)).map((m, j) => (
                  <div key={`${cur.month}-${m.name}`} className="nw-rise" style={{ display: 'flex', flexDirection: 'column', gap: 8, animationDelay: `${j * 70}ms` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                      <span>{m.name}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: m.change > 0 ? COLORS.green : COLORS.rust }}>{m.change > 0 ? '+' : '−'}{money(Math.abs(m.change))}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: '#EFE9E0', overflow: 'hidden' }}>
                      <div className="nw-fill" style={{ width: grow ? `${Math.max(4, (Math.abs(m.change) / biggest) * 100)}%` : 0 }} />
                    </div>
                  </div>
                ))}
                {moves.length > 4 && (
                  <button type="button" onClick={() => setShowAll((v) => !v)}
                    style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: '4px 0 0', fontFamily: 'inherit', fontSize: 14, color: COLORS.muted, alignSelf: 'flex-start' }}>
                    {showAll ? 'Show less' : `Show all ${moves.length}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {accounts && (editing ? (
            <div ref={editRef} className="nw-rise" style={{ display: 'flex', flexDirection: 'column', gap: 4, scrollMarginTop: 12 }}>
              <span style={{ fontSize: 13, color: COLORS.muted }}>Change a balance, or tap a name to edit the account</span>
              <Balances userId={userId} month={currentMonth()} accounts={accounts} onNext={() => setEditing(false)} inSheet />
            </div>
          ) : (
            <button type="button" className="bk-btn" onClick={() => setEditing(true)}>Update balances</button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
