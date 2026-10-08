import React, { useEffect, useState } from 'react';
import { COLORS } from '../screens/home/homeStyles';

// The Moru wordmark, traced from Jaz's own handwriting (8 Oct 2026): one
// pen line each. The m rises, loops in the middle and falls; a small tilted
// o; an r with its arm swinging out; and the u is a cup, rim on top.
// Coordinates are in the drawing's own pixels; the viewBox crops to them.
const LETTERS = [
  'M445 515 C438 455 470 390 520 372 C555 360 590 372 600 405 C608 435 600 470 580 475 C562 478 560 450 568 420 C580 375 625 340 675 338 C715 337 738 370 738 420 L736 484',
  'M822 448 C812 425 835 400 868 395 C900 390 918 405 910 425 C902 448 870 465 845 466 C830 466 824 458 822 448 Z',
  'M1008 482 C1020 445 1035 405 1045 372 M1020 438 C1042 405 1080 382 1133 382',
  'M1188 400 H1322 C1318 430 1310 460 1298 478 C1290 490 1275 493 1255 493 C1235 493 1222 488 1212 475 C1200 455 1192 430 1188 400 Z',
];
// Letters nudged closer than in the drawing, for even ~50px gaps between them.
const SHIFT = [0, -24, -64, -69];
const VB = { x: 425, y: 322, w: 848, h: 213 };

const CSS = `
/* Round line ends show a dot while a stroke is still zero-length, so each letter fades in as it starts drawing. */
@keyframes moruDraw { 0% { stroke-dashoffset: 1; opacity: 0; } 12% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; } }
.moru-draw path { stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; animation: moruDraw .9s cubic-bezier(0.16,0.9,0.4,1) forwards; }
@keyframes moruOut { to { opacity: 0; filter: blur(6px); } }
.moru-splash { position: fixed; inset: 0; z-index: 5000; background: ${COLORS.wall}; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; font-family: 'Schibsted Grotesk', system-ui, sans-serif; }
.moru-splash.out { animation: moruOut .6s cubic-bezier(0.16,0.9,0.4,1) forwards; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .moru-draw path { animation: none; stroke-dashoffset: 0; opacity: 1; } .moru-splash.out { animation: none; } }
`;

let injected = false;
function useLogoCss() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
}

/** The wordmark. `draw` traces the letters one after another, like pots being thrown. */
export function MoruLogo({ width = 140, color = COLORS.espresso, draw = false, label = 'Moru' }: { width?: number; color?: string; draw?: boolean; label?: string }) {
  useLogoCss();
  return (
    <svg className={draw ? 'moru-draw' : undefined} width={width} height={width * (VB.h / VB.w)} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} fill="none"
      // The pen line stays about 1.5px or more on screen, so the small mark at the bottom of Home doesn't go hairline.
      stroke={color} strokeWidth={Math.max(12, (VB.w / width) * 1.5)} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }}>
      {LETTERS.map((d, i) => (
        <path key={i} d={d} transform={SHIFT[i] ? `translate(${SHIFT[i]} 0)` : undefined} pathLength={1} style={draw ? { animationDelay: `${0.15 + i * 0.3}s` } : undefined} />
      ))}
    </svg>
  );
}

/** Shown once per launch: the wordmark writes itself, then it all fades into the app. */
export function MoruSplash() {
  useLogoCss();
  const [phase, setPhase] = useState<'on' | 'out' | 'gone'>(() => {
    try { return sessionStorage.getItem('moru-splash') ? 'gone' : 'on'; } catch { return 'on'; }
  });
  useEffect(() => {
    if (phase !== 'on') return;
    try { sessionStorage.setItem('moru-splash', '1'); } catch {}
    const t1 = window.setTimeout(() => setPhase('out'), 2300);
    const t2 = window.setTimeout(() => setPhase('gone'), 2900);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);
  if (phase === 'gone') return null;
  return (
    <div className={`moru-splash ${phase === 'out' ? 'out' : ''}`} aria-hidden onClick={() => setPhase('gone')}>
      <MoruLogo width={112} draw />
    </div>
  );
}
