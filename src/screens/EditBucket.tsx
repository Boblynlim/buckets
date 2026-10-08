import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Bucket } from '../types';
import { COLORS, SAFE_TOP, cupSrc, money, useHomeStyles } from './home/homeStyles';

// Editing a cup (and, via CupForm, adding one). Calm full-screen page:
// the cup photo, its name, what goes in each month, which shelf it sits on.
// Older knobs (share of take-home, kind, low alert) live under "More options".

export type Mode = 'spend' | 'save' | 'recurring';
export const SHELVES = ['Everyday', 'For me', 'Saving up', 'Fixed'] as const;
export type Shelf = (typeof SHELVES)[number];

const EASE = 'cubic-bezier(0.16,0.9,0.4,1)';
const LABEL: React.CSSProperties = { fontSize: 13, color: COLORS.muted };
const INPUT: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit',
  color: COLORS.ink, fontSize: 17, padding: '8px 0', boxShadow: `inset 0 -1px 0 ${COLORS.line}`, width: '100%', boxSizing: 'border-box',
};
const LINK: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: COLORS.muted, fontSize: 14,
  minHeight: 44, padding: 0, fontFamily: 'inherit',
};

const FORM_CSS = `
.bk-cupform input::placeholder { color: #A89E92; }
.bk-cupform input:focus { box-shadow: inset 0 -1.5px 0 ${COLORS.ink} !important; }
.bk-cupform .bk-money input:focus { box-shadow: none !important; }
.bk-cupform .bk-money:focus-within { box-shadow: inset 0 -1.5px 0 ${COLORS.ink} !important; }
.bk-chip.on { background: ${COLORS.espresso}; color: ${COLORS.wall}; box-shadow: none; }
.bk-more { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .6s ${EASE}, opacity .4s ease; }
.bk-more.open { grid-template-rows: 1fr; opacity: 1; }
.bk-more > div { overflow: hidden; }
.bk-chev { transition: transform .5s ${EASE}; }
@keyframes bkCupIn { from { opacity: 0; } to { opacity: 1; } }
.bk-cupimg { animation: bkCupIn .5s ease backwards; }
@media (prefers-reduced-motion: reduce) { .bk-more, .bk-chev { transition: none; } .bk-cupimg { animation: none; } }
`;
let cssInjected = false;
function useFormStyles() {
  useHomeStyles();
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const s = document.createElement('style');
  s.textContent = FORM_CSS;
  document.head.appendChild(s);
}

// "50000.5" -> "50,000.5" for display; typing strips the commas again.
const withCommas = (s: string) => {
  if (!s) return s;
  const [i, d] = s.split('.');
  return Number(i || 0).toLocaleString('en-US') + (d !== undefined ? '.' + d : '');
};

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function Chips<T extends string>({ options, value, onChange, label }: {
  options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={`bk-chip${value === o.value ? ' on' : ''}`} style={{ height: 40, padding: '0 14px', fontSize: 14 }}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Big money input: "$" muted, number 52/600, optional suffix. */
export function MoneyInput({ value, onChange, label, suffix, prefix = '$', size = 52, autoFocus }: {
  value: string; onChange: (v: string) => void; label: string; suffix?: string; prefix?: string; size?: number; autoFocus?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={LABEL}>{label}</span>
      <span className="bk-money" style={{ display: 'flex', alignItems: 'baseline', gap: 4, boxShadow: `inset 0 -1px 0 ${COLORS.line}` }}>
        {prefix && <span style={{ fontSize: size * 0.6, fontWeight: 500, color: COLORS.faint, letterSpacing: '-0.02em' }}>{prefix}</span>}
        <input inputMode="decimal" value={prefix ? withCommas(value) : value} placeholder="0" autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          style={{ ...INPUT, boxShadow: 'none', fontSize: size, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1, padding: '4px 0', flex: 1, minWidth: 0 }} />
        {suffix && <span style={{ fontSize: 15, color: COLORS.muted, whiteSpace: 'nowrap' }}>{suffix}</span>}
      </span>
    </label>
  );
}

export type CupValues = {
  name: string;
  mode: Mode;
  shelf: Shelf | null;
  allocationType: 'amount' | 'percentage';
  amount: string; // spend/recurring: $ or %, save: monthly contribution
  target: string; // save only
  contributionType: 'amount' | 'percentage' | 'none';
  alertThreshold: string;
};

/** The shared page used by EditBucket and AddBucket. */
export function CupForm({
  title, initial, initialMode, takeHome, saved = 0, onClose, onSave, saveLabel, onRetire, retireNote, helper, onShelfChange,
}: {
  title: string;
  initial: CupValues;
  initialMode?: Mode;
  takeHome: number;
  saved?: number;
  onClose: () => void;
  onSave: (v: CupValues) => Promise<void>;
  saveLabel: string;
  onRetire?: () => Promise<void>;
  retireNote?: string;
  helper?: (v: CupValues, set: (p: Partial<CupValues>) => void) => React.ReactNode;
  onShelfChange?: (shelf: Shelf, v: CupValues) => Partial<CupValues>;
}) {
  useFormStyles();
  const [v, setV] = useState<CupValues>(initial);
  const set = (p: Partial<CupValues>) => setV((cur) => ({ ...cur, ...p }));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRetire, setConfirmRetire] = useState(false);

  const modeChanged = initialMode !== undefined && v.mode !== initialMode;
  const isSave = v.mode === 'save';
  const pct = v.allocationType === 'percentage';
  const savePct = v.contributionType === 'percentage';
  const threshold = num(v.alertThreshold);

  const valid = !!v.name.trim()
    && threshold >= 0 && threshold <= 100 && v.alertThreshold.trim() !== ''
    && (isSave
      ? num(v.target) > 0 && (v.contributionType === 'none' || num(v.amount) > 0)
      : num(v.amount) > 0);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave(v);
    } catch (e: any) {
      setError(e?.message || 'That did not save. Try again.');
      setBusy(false);
    }
  };

  const retire = async () => {
    if (!onRetire) return;
    setBusy(true);
    try {
      await onRetire();
    } catch (e: any) {
      setError(e?.message || 'That did not work. Try again.');
      setBusy(false);
    }
  };

  const monthly = isSave
    ? (v.contributionType === 'none' ? 0 : savePct ? (num(v.amount) / 100) * takeHome : num(v.amount))
    : pct ? (num(v.amount) / 100) * takeHome : num(v.amount);
  const src = cupSrc(v.name.trim());

  return (
    <div className="bk-root bk-cupform" role="dialog" aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 2500, overflowY: 'auto', background: COLORS.wall }}>
      <div className="bk-step" style={{ maxWidth: 440, minHeight: '100%', margin: '0 auto', boxSizing: 'border-box', padding: `calc(${SAFE_TOP} + 12px) 24px 48px`, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, color: COLORS.muted }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 44, height: 44, marginRight: -12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>

        {/* The cup, sitting on the wall. No transform on this branch: the
            multiply blend needs it to stay flat. */}
        <div style={{ display: 'flex', justifyContent: 'center', height: 150, marginTop: -8 }}>
          <img key={src} className="bk-cupimg" src={src} alt=""
            style={{ height: 150, width: 150, objectFit: 'contain', objectPosition: 'bottom', mixBlendMode: 'multiply' }} />
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={LABEL}>Name</span>
          <input value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="What is this cup for?"
            autoFocus={!initial.name}
            style={{ ...INPUT, fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', padding: '6px 0 10px' }} />
        </label>

        {isSave ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <MoneyInput label="Saving up to" value={v.target} onChange={(t) => set({ target: t })} />
            {v.contributionType !== 'none' && (
              <MoneyInput label="Each month" size={32} value={v.amount} onChange={(a) => set({ amount: a })}
                prefix={savePct ? '' : '$'} suffix={savePct ? '% of take-home' : undefined} />
            )}
            {(saved > 0 || (num(v.target) > 0 && monthly > 0)) && (
              <span style={{ fontSize: 14, color: COLORS.muted, marginTop: -12, lineHeight: 1.5 }}>
                {saved > 0 ? `${money(saved)} saved so far. ` : ''}
                {num(v.target) > 0 && monthly > 0 && (saved >= num(v.target)
                  ? <span style={{ color: COLORS.green }}>You’re there.</span>
                  : <span style={{ color: COLORS.green }}>About {Math.ceil((num(v.target) - saved) / monthly)} months to go.</span>)}
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <MoneyInput label="Each month" value={v.amount} onChange={(a) => set({ amount: a })}
              prefix={pct ? '' : '$'} suffix={pct ? '% of take-home' : undefined} />
            <span style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
              {pct && takeHome > 0 ? `About ${money(monthly)} a month. ` : ''}
              {v.mode === 'recurring' ? 'Paid out the same each month.' : 'Whatever you don’t spend stays in the cup.'}
            </span>
          </div>
        )}

        {helper?.(v, set)}

        {!isSave && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={LABEL}>Shelf</span>
          <Chips label="Shelf" value={(v.shelf ?? '') as Shelf}
            options={SHELVES.map((s) => ({ value: s, label: s }))}
            onChange={(s) => set({ shelf: s, ...(onShelfChange?.(s, v) ?? {}) })} />
        </div>}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
            style={{ ...LINK, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            More options
            <svg className="bk-chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round"
              style={{ transform: more ? 'rotate(180deg)' : 'none' }}><path d="M3 4.5l3 3 3-3" /></svg>
          </button>
          <div className={`bk-more${more ? ' open' : ''}`} aria-hidden={!more}>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '8px 0 4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={LABEL}>Kind of cup</span>
                  <Chips label="Kind of cup" value={v.mode} onChange={(m) => set({ mode: m })}
                    options={[{ value: 'spend', label: 'Spending' }, { value: 'save', label: 'Saving for a goal' }, { value: 'recurring', label: 'Fixed bill' }] as const} />
                  {modeChanged && <span style={{ fontSize: 13, color: COLORS.rust }}>Changing this starts the cup from $0.</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={LABEL}>Each month, put in</span>
                  {isSave ? (
                    <Chips label="Each month, put in" value={v.contributionType} onChange={(c) => set({ contributionType: c })}
                      options={[{ value: 'amount', label: 'A set amount' }, { value: 'percentage', label: 'A share of take-home' }, { value: 'none', label: 'Nothing' }] as const} />
                  ) : (
                    <Chips label="Each month, put in" value={v.allocationType} onChange={(a) => set({ allocationType: a })}
                      options={[{ value: 'amount', label: 'A set amount' }, { value: 'percentage', label: 'A share of take-home' }] as const} />
                  )}
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={LABEL}>Tell me when it’s down to</span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <input inputMode="decimal" value={v.alertThreshold} aria-label="Alert threshold"
                      onChange={(e) => set({ alertThreshold: e.target.value.replace(/[^0-9.]/g, '') })}
                      style={{ ...INPUT, width: 56, textAlign: 'center' }} />
                    <span style={{ fontSize: 15, color: COLORS.muted }}>% left</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
          {error && <span style={{ fontSize: 14, color: COLORS.rust }}>{error}</span>}
          <button type="button" className="bk-btn" disabled={!valid || busy} onClick={submit}>
            {busy && !confirmRetire ? 'Saving' : saveLabel}
          </button>

          {onRetire && !confirmRetire && (
            <button type="button" style={{ ...LINK, color: COLORS.rust }} onClick={() => setConfirmRetire(true)}>
              Retire this cup
            </button>
          )}
          {onRetire && confirmRetire && (
            <div className="bk-step" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, marginTop: 8, borderRadius: 18, background: COLORS.sheet }}>
              <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>Retire {initial.name}?</span>
              <span style={{ fontSize: 15, color: COLORS.muted, lineHeight: 1.5 }}>
                It comes off your shelf and stops getting money. {retireNote ?? ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setConfirmRetire(false)}
                  style={{ ...LINK, flex: 1, height: 48, borderRadius: 999, boxShadow: `inset 0 0 0 1px ${COLORS.line}`, color: COLORS.ink, fontSize: 15 }}>
                  Keep it
                </button>
                <button type="button" disabled={busy} onClick={retire}
                  style={{ ...LINK, flex: 1, height: 48, borderRadius: 999, background: COLORS.rust, color: '#FFFFFF', fontSize: 15, fontWeight: 500 }}>
                  {busy ? 'Retiring' : 'Retire'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Takes home this month, and the user's shelves (groups) by name. */
export function useCupContext(userId: any) {
  const d = new Date();
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const income = useQuery(api.monthlyIncome.getByMonth, userId ? { userId, month } : 'skip') as any[] | undefined;
  const groups = useQuery(api.groups.getByUser, userId ? { userId } : 'skip') as any[] | undefined;
  const takeHome = useMemo(() => (income ?? []).reduce((s, r) => s + r.amount, 0), [income]);
  const createGroup = useMutation(api.groups.create);
  const assign = useMutation(api.groups.assignBucket);

  // Puts the cup on the named shelf, making the shelf if this user lacks it.
  const placeOnShelf = async (bucketId: any, shelf: Shelf) => {
    let g = (groups ?? []).find((x) => x.name === shelf);
    const groupId = g ? g._id : await createGroup({ userId, name: shelf });
    await assign({ bucketId, groupId });
  };
  const shelfOf = (groupId?: string): Shelf | null => {
    const n = (groups ?? []).find((x) => x._id === groupId)?.name;
    return (SHELVES as readonly string[]).includes(n) ? (n as Shelf) : null;
  };
  return { takeHome, groups, placeOnShelf, shelfOf };
}

/** Builds the buckets.update / buckets.create amount fields from the form. */
export function amountFields(v: CupValues) {
  if (v.mode === 'save') {
    return {
      targetAmount: num(v.target),
      contributionType: v.contributionType,
      ...(v.contributionType === 'amount' && { contributionAmount: num(v.amount) }),
      ...(v.contributionType === 'percentage' && { contributionPercent: num(v.amount) }),
    };
  }
  return {
    allocationType: v.allocationType,
    ...(v.allocationType === 'amount' ? { plannedAmount: num(v.amount) } : { plannedPercent: num(v.amount) }),
  };
}

interface EditBucketProps {
  visible?: boolean;
  bucket?: Bucket;
  suggestedAmount?: number;
  onClose?: () => void;
}

export const EditBucket: React.FC<EditBucketProps> = (props) => {
  // Native navigation passes the cup as a route param; web passes props.
  let route: any = null;
  let navigation: any = null;
  try {
    const { useRoute, useNavigation } = require('@react-navigation/native');
    route = useRoute();
    navigation = useNavigation();
  } catch {
    // Not inside a navigator (web).
  }
  const bucket: Bucket | undefined = props.bucket || route?.params?.bucket;
  const onClose = props.onClose || (() => navigation?.goBack());
  if (!bucket || props.visible === false) return null;
  return <EditCup bucket={bucket} suggestedAmount={props.suggestedAmount} onClose={onClose} />;
};

function EditCup({ bucket, suggestedAmount, onClose }: { bucket: Bucket; suggestedAmount?: number; onClose: () => void }) {
  const updateBucket = useMutation(api.buckets.update);
  const removeBucket = useMutation(api.buckets.remove);
  const { takeHome, groups, placeOnShelf, shelfOf } = useCupContext(bucket.userId);

  const initialMode: Mode = bucket.bucketMode || 'spend';
  const isSave = initialMode === 'save';
  const startAmount = suggestedAmount !== undefined
    ? suggestedAmount
    : isSave
      ? (bucket.contributionAmount || bucket.contributionPercent || 0)
      : (bucket.plannedAmount || bucket.plannedPercent || bucket.allocationValue || 0);

  if (groups === undefined) {
    return <div className="bk-root" style={{ position: 'fixed', inset: 0, zIndex: 2500, background: COLORS.wall }} />;
  }
  const startShelf = shelfOf(bucket.groupId);

  const initial: CupValues = {
    name: bucket.name,
    mode: initialMode,
    shelf: startShelf,
    allocationType: bucket.allocationType || 'amount',
    amount: startAmount ? String(startAmount) : '',
    target: bucket.targetAmount ? String(bucket.targetAmount) : '',
    contributionType: bucket.contributionType || (isSave ? 'none' : 'amount'),
    alertThreshold: String(bucket.alertThreshold ?? 20),
  };

  const save = async (v: CupValues) => {
    const params: any = {
      bucketId: bucket._id as any,
      name: v.name.trim(),
      alertThreshold: num(v.alertThreshold),
      color: bucket.color,
      ...amountFields(v),
    };
    // Only send the mode when it changed: the backend treats a mode change
    // as a reset (clears the other mode's fields and the balance).
    if (v.mode !== initialMode) params.bucketMode = v.mode;
    await updateBucket(params);
    if (v.mode !== 'save' && v.shelf && v.shelf !== startShelf) await placeOnShelf(bucket._id, v.shelf);
    onClose();
  };

  const balance = bucket.currentBalance || 0;
  return (
    <CupForm
      title="Edit cup"
      initial={initial}
      initialMode={initialMode}
      takeHome={takeHome}
      onClose={onClose}
      onSave={save}
      saveLabel="Save"
      saved={initialMode === 'save' ? balance : 0}
      onRetire={async () => {
        await removeBucket({ bucketId: bucket._id as any });
        onClose();
      }}
      retireNote={`${balance > 0 ? `${money(balance)} is still in it. ` : ''}Its past spending stays in your history.`}
    />
  );
}
