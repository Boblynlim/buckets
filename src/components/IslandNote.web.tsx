import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore react-dom has no type definitions in this repo
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { useSpendableCups } from '../screens/AddExpense';
import { COLORS, moneyExact, money } from '../screens/home/homeStyles';
import { playClink } from '../utils/cupClink';

// A quick spend, noted from the Dynamic Island. An invisible capsule sits over
// the camera cut-out; tap it and a black panel grows out of the island with
// amount, what it was, when, and which cup. Saving clinks, says where it went,
// and folds back in. Phones without an island get no capsule: the + sheet
// does the same job. Built after the curriculum app's Slip (src/ui/Slip.tsx).

/** Safe-area top in px. `--bk-safe-top` on :root overrides it (for testing on a laptop). */
function safeTopPx(): number {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:var(--bk-safe-top, env(safe-area-inset-top, 0px));visibility:hidden;pointer-events:none';
  document.body.appendChild(p);
  const h = p.getBoundingClientRect().height;
  p.remove();
  return h;
}

const CSS = `
.bk-isl { position: fixed; left: 50%; top: calc(var(--bk-safe-top, env(safe-area-inset-top, 0px)) - 41px); transform: translateX(-50%); z-index: 3001;
  font-family: 'Schibsted Grotesk', system-ui, sans-serif; }
.bk-isl-cap { width: 126px; height: 37px; border: 0; border-radius: 20px; background: transparent; cursor: pointer; padding: 0; position: relative; }
.bk-isl-cap::after { content: ''; position: absolute; inset: -4px -6px -7px; }
.bk-isl-scrim { position: fixed; inset: 0; z-index: 3000; background: ${COLORS.scrim}; animation: bkFade .4s ease backwards; }
.bk-isl-panel { box-sizing: border-box; width: min(360px, calc(100vw - 24px)); border-radius: 38px; background: #000; color: #fff;
  padding: 26px 22px 22px; transform-origin: 50% 0; animation: bkIslGrow .55s cubic-bezier(0.16,0.9,0.4,1) backwards; }
.bk-isl-panel.out { animation: bkIslShrink .4s cubic-bezier(0.4,0,0.7,0.2) forwards; }
@keyframes bkIslGrow { from { transform: scale(.36, .12); opacity: 0; border-radius: 20px; } }
@keyframes bkIslShrink { to { transform: scale(.36, .12); opacity: 0; } }
.bk-isl-lab { font-size: 12px; color: #8d8d8d; margin: 0 0 4px; }
.bk-isl-amt { display: flex; align-items: baseline; gap: 2px; }
.bk-isl-amt span { font-size: 26px; font-weight: 500; color: #6b6b6b; }
.bk-isl input { appearance: none; border: 0; outline: none; background: transparent; color: #fff; font-family: inherit; padding: 0; min-width: 0; }
.bk-isl-amt input { flex: 1; font-size: 40px; font-weight: 600; letter-spacing: -0.03em; height: 52px; }
.bk-isl-amt input::placeholder { color: #4a4a4a; }
.bk-isl-what { width: 100%; font-size: 16px; height: 40px; box-shadow: inset 0 -1px 0 #333; }
.bk-isl-what::placeholder { color: #6b6b6b; }
.bk-isl-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -22px; padding: 0 22px;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent); }
.bk-isl-row::-webkit-scrollbar { display: none; }
.bk-isl-chip { flex: 0 0 auto; appearance: none; border: 0; cursor: pointer; height: 36px; padding: 0 14px; border-radius: 999px;
  background: #1c1c1c; color: #ddd; font: inherit; font-size: 14px; transition: background .3s ease, color .3s ease; }
.bk-isl-chip small { font-size: 11px; color: #7a7a7a; margin-left: 6px; transition: color .3s ease; }
.bk-isl-chip.on { background: #fff; color: #111; }
.bk-isl-chip.on small { color: #777; }
.bk-isl-acts { display: flex; gap: 8px; margin-top: 18px; }
.bk-isl-acts button { appearance: none; border: 0; cursor: pointer; height: 48px; border-radius: 999px; font: inherit; font-size: 15px; font-weight: 500; }
.bk-isl-save { flex: 1; background: #fff; color: #111; transition: opacity .3s ease; }
.bk-isl-save:disabled { opacity: .3; cursor: default; }
.bk-isl-ghost { padding: 0 20px; background: #222; color: #ddd; }
.bk-isl-err { font-size: 13px; color: #F0B9A6; margin: 12px 0 0; }
.bk-isl-done { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 0 10px; text-align: center; }
.bk-isl-done b { font-size: 20px; font-weight: 500; }
.bk-isl-done span { font-size: 14px; color: #9a9a9a; }
@media (prefers-reduced-motion: reduce) { .bk-isl-panel, .bk-isl-panel.out, .bk-isl-scrim { animation: none; } }
`;

const parseAmount = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

type View = 'closed' | 'note' | 'done';

export function IslandNote() {
  const { user } = useAuth();
  const cups = useSpendableCups();
  const create = useMutation(api.expenses.create);
  const [island, setIsland] = useState(() => safeTopPx() >= 54);
  const [view, setView] = useState<View>('closed');
  const [leaving, setLeaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [yesterday, setYesterday] = useState(false);
  const [cupId, setCupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<{ amount: number; cup: string; left: number } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const reset = () => { setAmount(''); setNote(''); setYesterday(false); setCupId(null); setErr(''); setSaved(null); setSaving(false); };
  const close = () => {
    window.clearTimeout(timer.current);
    setLeaving(true);
    timer.current = window.setTimeout(() => { setView('closed'); setLeaving(false); reset(); }, 380);
  };
  const open = () => { reset(); setView('note'); };

  useEffect(() => { if (view === 'note') amountRef.current?.focus(); }, [view]);
  useEffect(() => {
    if (view === 'closed') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Re-check on rotate or resize (and when a laptop test sets --bk-safe-top).
  useEffect(() => {
    const on = () => setIsland(safeTopPx() >= 54);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  if (!island || !user) return null;

  const value = parseAmount(amount);
  const cup = cups?.find((c) => c.id === cupId);
  const valid = value > 0 && !!cup;

  const save = async () => {
    if (!valid || saving || !cup) return;
    setSaving(true);
    setErr('');
    const when = new Date();
    if (yesterday) when.setDate(when.getDate() - 1);
    try {
      await create({ userId: user._id, bucketId: cup.id as any, amount: value, date: when.getTime(), note: note.trim() });
      playClink(String(Math.round(value) % 10));
      setSaved({ amount: value, cup: cup.name, left: cup.left - value });
      setView('done');
      timer.current = window.setTimeout(close, 2200);
    } catch (e: any) {
      setErr('Could not save that. Try again.');
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <style>{CSS}</style>
      {view !== 'closed' && <div className="bk-isl-scrim" onClick={close} />}
      <div className="bk-isl">
        {view === 'closed' && <button type="button" className="bk-isl-cap" aria-label="Note a spend" onClick={open} />}

        {view === 'note' && (
          <div className={`bk-isl-panel ${leaving ? 'out' : ''}`} role="dialog" aria-label="Note a spend">
            <p className="bk-isl-lab">Note a spend</p>
            <label className="bk-isl-amt">
              <span>$</span>
              <input ref={amountRef} inputMode="decimal" placeholder="0" value={amount} aria-label="Amount"
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
            </label>
            <input className="bk-isl-what" placeholder="What was it?" value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />

            <p className="bk-isl-lab" style={{ marginTop: 16 }}>Which cup?</p>
            <div className="bk-isl-row" role="listbox" aria-label="Which cup">
              {(cups ?? []).map((c) => (
                <button key={c.id} type="button" role="option" aria-selected={c.id === cupId}
                  className={`bk-isl-chip ${c.id === cupId ? 'on' : ''}`} onClick={() => setCupId(c.id)}>
                  {c.name}<small>{money(c.left)}</small>
                </button>
              ))}
            </div>

            <div className="bk-isl-row" style={{ marginTop: 10 }}>
              <button type="button" className={`bk-isl-chip ${!yesterday ? 'on' : ''}`} onClick={() => setYesterday(false)}>Today</button>
              <button type="button" className={`bk-isl-chip ${yesterday ? 'on' : ''}`} onClick={() => setYesterday(true)}>Yesterday</button>
            </div>

            {err && <p className="bk-isl-err" role="alert">{err}</p>}
            <div className="bk-isl-acts">
              <button type="button" className="bk-isl-save" disabled={!valid || saving} onClick={save}>
                {saving ? 'Saving' : valid ? `Save ${moneyExact(value)}` : 'Save'}
              </button>
              <button type="button" className="bk-isl-ghost" onClick={close}>Close</button>
            </div>
          </div>
        )}

        {view === 'done' && saved && (
          <button type="button" className={`bk-isl-panel ${leaving ? 'out' : ''}`} onClick={close} style={{ border: 0, cursor: 'pointer', font: 'inherit' }}>
            <span className="bk-isl-done">
              <b>{moneyExact(saved.amount)} from {saved.cup}</b>
              <span>{saved.left >= 0 ? `${money(saved.left)} left in it` : 'Paid ahead from next month'}</span>
            </span>
          </button>
        )}
      </div>
    </>,
    document.body
  );
}
