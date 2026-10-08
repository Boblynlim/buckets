import React, { useState } from 'react';
// @ts-ignore react-dom has no type definitions in this repo
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { COLORS, money, moneyExact, useEscape } from './homeStyles';
import { AdventuresList } from './Adventures.web';
import { useAuth } from '../../lib/AuthContext';

type Cup = { id: string; name: string; left: number; full: number; carry: number; funded: number; spent?: number; planned?: number; kind?: 'bill' | 'invest' };

// One line per cup describing what goes in it (from the replan).
const RULES: Record<string, string> = {
  Food: 'Eating out',
  Grocery: 'Groceries for home',
  Transport: 'Bus, MRT, Grab',
  Maintenance: 'Things I had to buy',
  'Self care': 'Facials, health, flowers',
  Fitness: 'Classes, gear, courses',
  Shopping: 'Things I buy',
  Entertainment: 'Things I do',
  Adventures: 'Trips I choose. Fuji first',
  'Family trips': 'Hong Kong, Munich, KL',
  Gifts: 'Birthdays and occasions',
  'Home decor': 'For the new place',
  Enrichment: 'Courses and learning',
};
const NOTES: Record<string, string> = { 'Self care': 'Already paid for. Enjoy it.' };

export function CupSheet({ cup, month, allCups, onClose, onEdit, past }: { cup: Cup; month: string; allCups: Cup[]; onClose: () => void; past?: boolean; onEdit?: (t: { id: string; note: string; amount: number; date: number }) => void }) {
  const txns = useQuery(api.home.cupTransactions, { bucketId: cup.id as any, month });
  const { user } = useAuth();
  const refile = useMutation(api.merchantRules.refile);
  const [open, setOpen] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  useEscape(onClose);
  // Bills and investing are paid, not spent down: say what's gone out.
  const verb = cup.kind === 'invest' ? 'put in' : 'paid';
  const outOf = cup.planned ?? cup.funded;

  const move = async (expenseId: string, to: Cup) => {
    await refile({ expenseId: expenseId as any, bucketId: to.id as any });
    setMoved((m) => ({ ...m, [expenseId]: to.name }));
    setOpen(null);
  };

  // Portal to <body> so the sheet sits above the fixed bottom bar.
  return createPortal(
    <>
      <div className="bk-scrim" onClick={onClose} style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 2000 }} />
      <div className="bk-sheet bk-root" role="dialog" aria-label={cup.name}
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2001, background: COLORS.wall, borderRadius: '24px 24px 0 0', padding: '28px 24px 36px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '80vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 15, color: COLORS.muted }}>{cup.name}</span>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 44, height: 44, margin: '-12px -12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {cup.kind ? `${money(cup.spent ?? 0)} ${verb}` : past ? `${money(cup.spent ?? 0)} spent` : `${money(cup.left)} left`}
          </span>
          <span style={{ fontSize: 15, color: COLORS.muted }}>
            {cup.kind && !past
              ? outOf > 0 ? `of ${money(outOf)} this month` : 'No set amount each month'
              : past
              ? `in ${new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleString('en-GB', { month: 'long' })}`
              : cup.carry > 0 ? `${money(cup.funded)} this month, plus ${money(cup.carry)} carried over` : `of ${money(cup.funded)} this month`}
          </span>
        </div>
        {!past && NOTES[cup.name] && <span style={{ fontSize: 15, color: COLORS.green }}>{NOTES[cup.name]}</span>}
        {RULES[cup.name] && <span style={{ fontSize: 13, color: COLORS.muted }}>{RULES[cup.name]}</span>}

        <div className="bk-scroll" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'none' as any }}>
          {!past && cup.name === 'Adventures' && user && (
            <div style={{ paddingBottom: 16 }}><AdventuresList userId={user._id} /></div>
          )}
          {txns && txns.length === 0 && <span style={{ fontSize: 15, color: COLORS.muted, padding: '10px 0' }}>{cup.kind ? 'Nothing has gone out yet' : 'Nothing yet this month'}</span>}
          {txns?.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
              <button type="button" className="bk-row" onClick={() => setOpen(open === t.id ? null : t.id)}
                style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', minHeight: 52 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15 }}>{t.note}</span>
                  <span style={{ fontSize: 12, color: moved[t.id] ? COLORS.green : COLORS.muted }}>
                    {moved[t.id]
                      ? `Moved to ${moved[t.id]}. It goes there from now on.`
                      : new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (t.autoFiled ? ' · filed for you. Tap to move' : '')}
                  </span>
                </span>
                <span style={{ fontSize: 15 }}>{moneyExact(t.amount)}</span>
              </button>
              {open === t.id && (
                <div className="bk-sheet" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 12 }}>
                  {onEdit && (
                    <button type="button" className="bk-chip" style={{ background: COLORS.espresso, color: COLORS.wall }} onClick={() => onEdit(t)}>Edit details</button>
                  )}
                  <span style={{ fontSize: 12, color: COLORS.muted, width: '100%', paddingTop: 4 }}>Move to</span>
                  {allCups.filter((c) => c.id !== cup.id).map((c) => (
                    <button key={c.id} type="button" className="bk-chip" onClick={() => move(t.id, c)}>{c.name}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
