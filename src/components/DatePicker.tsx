import React, { useEffect, useState } from 'react';
import { COLORS, useHomeStyles } from '../screens/home/homeStyles';

// A small calendar sheet. Tap a day and it closes.

interface DatePickerProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const navBtn: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 44, height: 44,
  borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={COLORS.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
  </svg>
);

export const DatePicker: React.FC<DatePickerProps> = ({ visible, selectedDate, onSelectDate, onClose }) => {
  useHomeStyles();
  const [month, setMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  useEffect(() => {
    if (visible) setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [visible]);

  if (!visible) return null;

  const today = new Date();
  const y = month.getFullYear();
  const m = month.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // weeks start Monday

  // Keep the time of day from the current selection.
  const pick = (d: Date) => {
    const out = new Date(d);
    out.setHours(selectedDate.getHours(), selectedDate.getMinutes(), selectedDate.getSeconds(), 0);
    onSelectDate(out);
    onClose();
  };
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  return (
    <>
      <div className="bk-scrim" onClick={onClose} style={{ position: 'fixed', inset: 0, background: COLORS.scrim, zIndex: 4000 }} />
      <div
        className="bk-sheet bk-root"
        role="dialog"
        aria-label="Pick a date"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 4001, maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
          background: COLORS.sheet, borderRadius: '24px 24px 0 0', padding: '20px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" style={navBtn} aria-label="Previous month" onClick={() => setMonth(new Date(y, m - 1, 1))}>
            <Chevron dir="left" />
          </button>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" style={navBtn} aria-label="Next month" onClick={() => setMonth(new Date(y, m + 1, 1))}>
            <Chevron dir="right" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: 2 }}>
          {WEEKDAYS.map((d, i) => (
            <span key={i} style={{ fontSize: 12, color: COLORS.faint, textAlign: 'center', paddingBottom: 6 }}>{d}</span>
          ))}
          {Array.from({ length: lead }).map((_, i) => <span key={`e${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const d = new Date(y, m, i + 1);
            const on = d.toDateString() === selectedDate.toDateString();
            const isToday = d.toDateString() === today.toDateString();
            return (
              <button
                key={i}
                type="button"
                aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                aria-pressed={on}
                onClick={() => pick(d)}
                style={{
                  appearance: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', justifySelf: 'center',
                  width: 44, height: 44, borderRadius: 999, fontSize: 15, fontVariantNumeric: 'tabular-nums',
                  background: on ? COLORS.espresso : 'transparent', color: on ? COLORS.wall : COLORS.ink,
                  fontWeight: isToday || on ? 600 : 400, position: 'relative', transition: 'background .3s ease, color .3s ease',
                }}
              >
                {i + 1}
                {isToday && !on && (
                  <span style={{ position: 'absolute', left: '50%', bottom: 7, width: 4, height: 4, marginLeft: -2, borderRadius: 999, background: COLORS.green }} />
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button type="button" className="bk-chip" style={{ height: 40, fontSize: 14, padding: '0 16px' }} onClick={() => pick(today)}>Today</button>
          <button type="button" className="bk-chip" style={{ height: 40, fontSize: 14, padding: '0 16px' }} onClick={() => pick(yesterday)}>Yesterday</button>
        </div>
      </div>
    </>
  );
};
