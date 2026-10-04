import React, { useEffect, useRef, useState } from 'react';
import { COLORS, useHomeStyles } from '../screens/home/homeStyles';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'loading';
  onHide: () => void;
  duration?: number;
}

// A small ink pill at the top. Blur-fades in and out; no slide, no bounce.
const CSS = `
@keyframes bkToastIn { from { opacity: 0; transform: translate(-50%, -6px); filter: blur(6px); } to { opacity: 1; transform: translate(-50%, 0); filter: none; } }
@keyframes bkToastOut { from { opacity: 1; filter: none; } to { opacity: 0; filter: blur(6px); } }
@keyframes bkToastBreathe { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
.bk-toast { animation: bkToastIn .5s cubic-bezier(0.16,0.9,0.4,1) backwards; }
.bk-toast.out { animation: bkToastOut .3s ease forwards; }
.bk-toast-dot.loading { animation: bkToastBreathe 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .bk-toast, .bk-toast.out, .bk-toast-dot.loading { animation: none; }
}
`;

let injected = false;
function useToastCss() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

const DOT: Record<ToastProps['type'], string> = {
  success: '#8DB8A8',
  error: '#D98C73',
  loading: '#A89E92',
};

export const Toast: React.FC<ToastProps> = ({ visible, message, type, onHide, duration = 3000 }) => {
  useHomeStyles();
  useToastCss();
  const [phase, setPhase] = useState<'in' | 'out' | null>(visible ? 'in' : null);
  const hideRef = useRef(onHide);
  hideRef.current = onHide;

  useEffect(() => {
    if (visible) {
      setPhase('in');
      if (type !== 'loading' && duration > 0) {
        const t = setTimeout(() => setPhase('out'), duration);
        return () => clearTimeout(t);
      }
    } else {
      setPhase((p) => (p === 'in' ? 'out' : p));
    }
  }, [visible, type, duration, message]);

  // Leave on a timer rather than animationend, so reduced motion still closes.
  useEffect(() => {
    if (phase !== 'out') return;
    const t = setTimeout(() => {
      setPhase(null);
      hideRef.current();
    }, 300);
    return () => clearTimeout(t);
  }, [phase]);

  if (!phase) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`bk-toast${phase === 'out' ? ' out' : ''}`}
      style={{
        position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', left: '50%', transform: 'translate(-50%, 0)',
        zIndex: 9999, maxWidth: 'calc(100% - 32px)', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderRadius: 999,
        background: 'rgba(31,27,23,0.9)', color: COLORS.wall,
        backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        fontFamily: "'Schibsted Grotesk', system-ui, sans-serif", fontSize: 14, lineHeight: 1.35,
      }}
    >
      <span className={`bk-toast-dot ${type}`} style={{ width: 6, height: 6, borderRadius: 999, background: DOT[type], flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
};
