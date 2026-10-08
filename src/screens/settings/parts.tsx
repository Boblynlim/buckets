import React, { useEffect } from 'react';
// react-dom ships without types in this repo; only createPortal is used.
// @ts-ignore
import { createPortal } from 'react-dom';
import { COLORS } from '../home/homeStyles';

// Settings building blocks: plain DOM, one font, hairlines, white cards on the wall.

const CSS = `
.st-row { appearance: none; border: 0; background: transparent; width: 100%; box-sizing: border-box; text-align: left;
  display: flex; align-items: center; gap: 14px; min-height: 56px; padding: 12px 16px; font-size: 15px; color: ${COLORS.ink};
  position: relative; transition: background .25s ease; }
button.st-row { cursor: pointer; }
button.st-row:hover { background: #FAF8F4; }
button.st-row:disabled { cursor: default; background: transparent; }
.st-row:focus-visible { outline: 2px solid ${COLORS.green}; outline-offset: -2px; border-radius: 14px; }
.st-card > .st-row + .st-row::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; height: 1px; background: ${COLORS.hairline}; }
.st-link, .bk-root .st-link { appearance: none; border: 0; background: transparent; cursor: pointer; font-size: 15px; color: ${COLORS.muted};
  min-height: 44px; padding: 0 4px; transition: color .25s ease; }
.bk-root .st-link:hover { color: ${COLORS.ink}; }
.st-link:focus-visible, .st-switch:focus-visible { outline: 2px solid ${COLORS.green}; outline-offset: 2px; border-radius: 8px; }
.st-input { appearance: none; border: 0; outline: 0; background: transparent; width: 100%; box-sizing: border-box; font: inherit;
  font-size: 17px; color: ${COLORS.ink}; height: 48px; padding: 0; box-shadow: inset 0 -1px 0 #D9D2C6; border-radius: 0;
  transition: box-shadow .25s ease; }
.st-input:focus { box-shadow: inset 0 -1.5px 0 ${COLORS.ink}; }
.st-input::placeholder { color: #A89E92; }
.st-switch { appearance: none; border: 0; cursor: pointer; width: 46px; height: 28px; border-radius: 999px; padding: 0; flex-shrink: 0;
  background: #D9D2C6; position: relative; transition: background .3s ease; }
.st-switch[aria-checked=true] { background: ${COLORS.green}; }
.st-switch span { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 999px; background: #fff;
  box-shadow: 0 1px 2px rgba(31,27,23,.2); transition: left .35s cubic-bezier(0.16,0.9,0.4,1); }
.st-switch[aria-checked=true] span { left: 21px; }
.st-switch:disabled { opacity: .5; cursor: default; }
.st-danger, .bk-root .st-danger { appearance: none; border: 0; cursor: pointer; background: ${COLORS.rust}; color: #fff; font-size: 16px; font-weight: 500;
  height: 56px; border-radius: 999px; width: 100%; transition: background .3s ease, opacity .3s ease; }
.st-danger:hover { background: #8A4733; }
.st-danger:disabled { opacity: .35; cursor: default; background: ${COLORS.rust}; }
.st-cups img { mix-blend-mode: multiply; }
@keyframes stToast { from { opacity: 0; transform: translateY(-12px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
.st-toast { animation: stToast .5s cubic-bezier(0.16,0.9,0.4,1) backwards; }
@media (prefers-reduced-motion: reduce) {
  .st-toast { animation: none; }
  .st-switch span, .st-row { transition: none; }
}
`;

let injected = false;
export function useSettingsStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

export const LABEL: React.CSSProperties = { fontSize: 13, color: COLORS.muted };
export const BODY: React.CSSProperties = { fontSize: 15, color: COLORS.muted, lineHeight: 1.5, margin: 0 };

export function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke={COLORS.faint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M1.5 1.5L6.5 7l-5 5.5" />
    </svg>
  );
}

// A labelled block of rows on a white card.
export function Group({ label, action, children }: { label?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(label || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', minHeight: 20 }}>
          <span style={LABEL}>{label}</span>
          {action}
        </div>
      )}
      <div className="st-card" style={{ background: COLORS.sheet, borderRadius: 16, overflow: 'hidden' }}>{children}</div>
    </section>
  );
}

type RowProps = {
  title: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  leading?: React.ReactNode;
  tone?: 'ink' | 'rust' | 'faint';
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
};

export function Row({ title, sub, value, leading, tone = 'ink', chevron, onClick, disabled, trailing }: RowProps) {
  const color = tone === 'rust' ? COLORS.rust : tone === 'faint' ? COLORS.faint : COLORS.ink;
  const inner = (
    <>
      {leading}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {sub && <span style={{ fontSize: 13, color: COLORS.muted }}>{sub}</span>}
      </span>
      {value !== undefined && value !== null && <span style={{ color: COLORS.muted, flexShrink: 0 }}>{value}</span>}
      {trailing}
      {chevron && <Chevron />}
    </>
  );
  if (!onClick) return <div className="st-row">{inner}</div>;
  return (
    <button type="button" className="st-row" onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

// Full-screen sub-page that slides over Settings (above the bottom bar).
export function Page({ title, onBack, backLabel = 'Settings', action, children }: {
  title: string; onBack: () => void; backLabel?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  // Portalled to <body> so it sits above the bottom bar (the screen's own
  // container is a separate stacking context).
  return createPortal(
    <div className="bk-root" role="dialog" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 1500, overflowY: 'auto' }}>
      <div className="bk-step" style={{ maxWidth: 440, minHeight: '100%', margin: '0 auto', boxSizing: 'border-box', padding: '20px 20px 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 -4px' }}>
          <button type="button" className="st-link" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6.5 1.5L1.5 7l5 5.5" />
            </svg>
            {backLabel}
          </button>
          {action}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 4px' }}>{title}</h1>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
      <span style={LABEL}>{label}</span>
      <input className="st-input" {...input} />
    </label>
  );
}

export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="st-switch" disabled={disabled} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function Check({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <span aria-hidden style={{
      width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: on ? COLORS.espresso : 'transparent', boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${dim ? COLORS.hairline : COLORS.line}`,
      transition: 'background .25s ease',
    }}>
      {on && (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4.5L4 7.5 10 1" />
        </svg>
      )}
    </span>
  );
}

export type ToastState = { message: string; tone: 'ok' | 'error' | 'busy' } | null;

export function Toast({ toast, onHide }: { toast: ToastState; onHide: () => void }) {
  useEffect(() => {
    if (!toast || toast.tone === 'busy') return;
    const t = setTimeout(onHide, 3200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  const dot = toast.tone === 'ok' ? COLORS.green : toast.tone === 'error' ? COLORS.rust : COLORS.faint;
  return createPortal(
    <div style={{ position: 'fixed', top: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 4000, pointerEvents: 'none', padding: '0 16px' }}>
      <div key={toast.message} className="st-toast bk-root" role="status"
        style={{ background: COLORS.espresso, color: '#F3F0EA', borderRadius: 999, padding: '12px 18px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 400 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: dot, flexShrink: 0 }} />
        {toast.message}
      </div>
    </div>,
    document.body,
  );
}
