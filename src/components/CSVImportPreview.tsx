import React, { useState, useEffect } from 'react';
import { Modal } from 'react-native';
import type { Bucket } from '../types';
import type { CSVExpense } from '../utils/csvExport';
import { COLORS, useHomeStyles } from '../screens/home/homeStyles';

interface CSVImportPreviewProps {
  visible: boolean;
  parsedExpenses: CSVExpense[];
  availableBuckets: Bucket[];
  onClose: () => void;
  onConfirmImport: (expenses: CSVExpense[]) => void;
}

const H1: React.CSSProperties = { fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 };
const PLAIN_BTN: React.CSSProperties = { appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0 };

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const CSVImportPreview: React.FC<CSVImportPreviewProps> = ({
  visible,
  parsedExpenses,
  availableBuckets,
  onClose,
  onConfirmImport,
}) => {
  useHomeStyles();
  const [expenses, setExpenses] = useState<CSVExpense[]>(parsedExpenses);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    setExpenses(parsedExpenses);
  }, [parsedExpenses]);

  // Match cup names loosely (case and spaces).
  const bucketNameMap = new Map(availableBuckets.map((b) => [b.name.toLowerCase().trim(), b.name]));
  const invalid = expenses.map((exp) => !bucketNameMap.has(exp.bucket.toLowerCase().trim()));
  const errorCount = invalid.filter(Boolean).length;

  // Rows that need a cup float to the top. Each keeps its original index so
  // edits patch the right expense.
  const orderedRows = expenses
    .map((expense, i) => ({ expense, i, bad: invalid[i] }))
    .sort((a, b) => (a.bad === b.bad ? a.i - b.i : a.bad ? -1 : 1));

  const setBucket = (index: number, name: string) => {
    setExpenses((prev) => prev.map((e, i) => (i === index ? { ...e, bucket: name } : e)));
    setOpenIndex(null);
  };

  const n = expenses.length;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <div className="bk-root" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="bk-scroll" style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as any }}>
          <div className="bk-step" style={{ maxWidth: 440, margin: '0 auto', padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: COLORS.muted }}>Import</span>
              <button type="button" onClick={onClose} aria-label="Close import"
                style={{ ...PLAIN_BTN, width: 44, height: 44, marginRight: -12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -12 }}>
              <h1 style={H1}>
                {errorCount
                  ? `${errorCount} ${errorCount === 1 ? 'needs' : 'need'} a cup.`
                  : `${n} ${n === 1 ? 'spend' : 'spends'} ready.`}
              </h1>
              <span style={{ fontSize: 15, color: COLORS.muted, lineHeight: 1.5 }}>
                {errorCount
                  ? 'Their cup names do not match yours. Pick one for each.'
                  : 'Check the cups, then bring them in.'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {orderedRows.map(({ expense, i, bad }) => {
                const open = openIndex === i;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', minHeight: 56 }}>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.note || 'No note'}</span>
                        <span style={{ fontSize: 13, color: COLORS.muted }}>{shortDate(expense.date)}</span>
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>${expense.amount.toFixed(2)}</span>
                        <button type="button" className="bk-row" onClick={() => setOpenIndex(open ? null : i)}
                          aria-expanded={open}
                          style={{ ...PLAIN_BTN, fontSize: 13, color: bad ? COLORS.rust : COLORS.muted, minHeight: 28, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {bad ? `No cup called ${expense.bucket || 'that'}` : expense.bucket}
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
                            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .4s cubic-bezier(0.16,0.9,0.4,1)' }}>
                            <path d="M2 3.5l3 3 3-3" />
                          </svg>
                        </button>
                      </span>
                    </div>
                    {open && (
                      <div className="bk-step" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 14 }}>
                        {availableBuckets.map((b) => (
                          <button key={b._id} type="button" className="bk-chip" onClick={() => setBucket(i, b.name)}
                            style={b.name === expense.bucket ? { background: COLORS.espresso, color: COLORS.wall } : undefined}>
                            {b.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, background: COLORS.wall, boxShadow: `inset 0 1px 0 ${COLORS.hairline}` }}>
          <div style={{ maxWidth: 440, margin: '0 auto', padding: '16px 24px calc(env(safe-area-inset-bottom, 0px) + 16px)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button type="button" className="bk-btn" disabled={errorCount > 0} onClick={() => onConfirmImport(expenses)}>
              {errorCount ? `Pick ${errorCount === 1 ? 'a cup' : 'cups'} first` : `Import ${n} ${n === 1 ? 'spend' : 'spends'}`}
            </button>
            <button type="button" onClick={onClose} style={{ ...PLAIN_BTN, color: COLORS.muted, fontSize: 14, minHeight: 44 }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
