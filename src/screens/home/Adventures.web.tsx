import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { COLORS, money } from './homeStyles';

// The adventures I'm saving for, in order. Shown inside the Adventures cup's
// sheet; the next one also appears on Home under "Saved".

const whenLabel = (when: string | null) =>
  when ? new Date(Number(when.slice(0, 4)), Number(when.slice(5)) - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' }) : null;

const INPUT: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', fontSize: 15, padding: '8px 0', outline: 'none',
  fontFamily: 'inherit', color: COLORS.ink, boxShadow: 'inset 0 -1px 0 #D9D2C6', width: '100%',
};
const LINK: React.CSSProperties = { appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0, minHeight: 36 };

export function Bar({ pct, color = COLORS.ink }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 2, background: COLORS.hairline, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, transition: 'width 1s cubic-bezier(0.16,0.9,0.4,1)' }} />
    </div>
  );
}

export function progressLine(a: { saved: number; cost: number; funded: boolean; monthsToGo: number | null; when: string | null }) {
  if (a.funded) return 'Funded. Book it';
  const by = a.monthsToGo != null ? `about ${a.monthsToGo} ${a.monthsToGo === 1 ? 'month' : 'months'} to go` : '';
  return [`${money(a.saved)} of ${money(a.cost)}`, by].filter(Boolean).join(' · ');
}

function Editor({ initial, onSave, onCancel, onRemove, onDone }: {
  initial?: { name: string; cost: number; when: string | null };
  onSave: (v: { name: string; cost: number; when?: string }) => void;
  onCancel: () => void; onRemove?: () => void; onDone?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [cost, setCost] = useState(initial ? String(initial.cost) : '');
  const [when, setWhen] = useState(initial?.when ?? '');
  const n = parseFloat(cost.replace(/[^0-9.]/g, ''));
  const ok = name.trim() && isFinite(n) && n > 0;
  return (
    <div className="bk-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0 16px' }}>
      <input autoFocus placeholder="e.g. Learn to dive" aria-label="Adventure" value={name} onChange={(e) => setName(e.target.value)} style={INPUT} />
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, fontSize: 15, color: COLORS.muted }}>
          $<input inputMode="decimal" placeholder="Cost" aria-label="Cost" value={cost} onChange={(e) => setCost(e.target.value)} style={INPUT} />
        </label>
        <input type="month" aria-label="When" value={when} onChange={(e) => setWhen(e.target.value)} style={{ ...INPUT, flex: 1, color: when ? COLORS.ink : COLORS.muted }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingTop: 4 }}>
        <button type="button" className="bk-chip" disabled={!ok} style={{ background: COLORS.ink, color: '#F3F0EA', opacity: ok ? 1 : 0.4 }}
          onClick={() => ok && onSave({ name: name.trim(), cost: n, when: when || undefined })}>Save</button>
        <button type="button" style={{ ...LINK, fontSize: 14, color: COLORS.muted }} onClick={onCancel}>Cancel</button>
        {onDone && <button type="button" style={{ ...LINK, fontSize: 14, color: COLORS.green, marginLeft: 'auto' }} onClick={onDone}>Went on it</button>}
        {onRemove && <button type="button" style={{ ...LINK, fontSize: 14, color: COLORS.rust, marginLeft: onDone ? 0 : 'auto' }} onClick={onRemove}>Remove</button>}
      </div>
    </div>
  );
}

export function AdventuresList({ userId }: { userId: any }) {
  const data = useQuery(api.adventures.list, { userId });
  const add = useMutation(api.adventures.add);
  const update = useMutation(api.adventures.update);
  const remove = useMutation(api.adventures.remove);
  const move = useMutation(api.adventures.move);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 13, color: COLORS.muted, paddingBottom: 4 }}>Saving for, in order</span>
      {data.items.map((a: any, i: number) => (
        <div key={a.id} style={{ boxShadow: 'inset 0 -1px 0 #EEEAE3' }}>
          {editing === a.id ? (
            <Editor initial={a}
              onSave={async (v) => { await update({ id: a.id, ...v }); setEditing(null); }}
              onCancel={() => setEditing(null)}
              onDone={async () => { await update({ id: a.id, done: true }); setEditing(null); }}
              onRemove={async () => { await remove({ id: a.id }); setEditing(null); }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <button type="button" onClick={() => setEditing(a.id)} style={{ ...LINK, flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 15 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  {whenLabel(a.when) && <span style={{ color: COLORS.muted, flexShrink: 0 }}>{whenLabel(a.when)}</span>}
                </span>
                <Bar pct={(a.saved / a.cost) * 100} color={a.funded ? COLORS.green : COLORS.ink} />
                <span style={{ fontSize: 12, color: a.funded ? COLORS.green : COLORS.muted }}>{progressLine(a)}</span>
              </button>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <button type="button" aria-label={`Move ${a.name} earlier`} disabled={i === 0} onClick={() => move({ id: a.id, dir: -1 })}
                  style={{ ...LINK, width: 32, minHeight: 22, color: COLORS.muted, opacity: i === 0 ? 0.25 : 1 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5L6 4.5l3 3" /></svg>
                </button>
                <button type="button" aria-label={`Move ${a.name} later`} disabled={i === data.items.length - 1} onClick={() => move({ id: a.id, dir: 1 })}
                  style={{ ...LINK, width: 32, minHeight: 22, color: COLORS.muted, opacity: i === data.items.length - 1 ? 0.25 : 1 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5L6 7.5l3-3" /></svg>
                </button>
              </span>
            </div>
          )}
        </div>
      ))}
      {adding ? (
        <Editor onSave={async (v) => { await add({ userId, ...v }); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={{ ...LINK, alignSelf: 'flex-start', fontSize: 14, color: COLORS.ink, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 2v8M2 6h8" /></svg>
          Add an adventure
        </button>
      )}
    </div>
  );
}

/** The next adventure, for Home's "Saved" section. */
export function NextAdventure({ userId }: { userId: any }) {
  const data = useQuery(api.adventures.list, { userId });
  const next = data?.items?.[0];
  if (!next) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
        <span>{next.name}</span>
        <span style={{ color: COLORS.muted }}>{whenLabel(next.when) ?? ''}</span>
      </div>
      <Bar pct={(next.saved / next.cost) * 100} color={next.funded ? COLORS.green : COLORS.ink} />
      <span style={{ fontSize: 13, color: next.funded ? COLORS.green : COLORS.muted }}>{progressLine(next)}</span>
    </div>
  );
}
