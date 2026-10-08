import React from 'react';
import { CUP_IMAGES, CupIcon } from '../../constants/bucketIcons';

// Each cup's pottery photo, by cup name (matches the October 2026 prototype).
const CUP_ART: Record<string, CupIcon> = {
  Food: 'cup10',
  Grocery: 'cup8',
  Transport: 'cup9',
  Maintenance: 'cup15',
  'Self care': 'cup11',
  Fitness: 'cup14',
  Shopping: 'cup12',
  Entertainment: 'cup13',
  Adventures: 'cup0',
  'Family trips': 'cup19',
  Gifts: 'cup16',
  'Home decor': 'cup17',
  Enrichment: 'cup18',
};

export function cupSrc(name: string): string {
  const mod: any = CUP_IMAGES[CUP_ART[name] ?? 'cup20'];
  return typeof mod === 'string' ? mod : mod?.default ?? mod?.uri ?? '';
}

export const money = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');

// Exact, with cents: for individual transactions ($4.57, $1,128.00).
// Balances and totals stay in whole dollars (money).
export const moneyExact = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Clears the status bar / Dynamic Island: at least 44px, even where the inset reads 0. */
export const SAFE_TOP = 'max(env(safe-area-inset-top, 0px), 44px)';

export const COLORS = {
  wall: '#F3F0EA',
  ink: '#2B1D15', // espresso: text, numbers, the logo
  espresso: '#2B1D15', // the same espresso, for dark fills: buttons, the dock
  muted: '#75695F',
  hairline: '#E4DFD6', // dividers between rows
  line: '#D9D2C6', // outlines: chips, inputs, empty rings
  faint: '#A89E92', // placeholders, empty values, version text
  sand: '#EEEAE3', // soft fill: icon buttons, quiet pills
  green: '#4E7D6D',
  rust: '#A0563F',
  sheet: '#FFFFFF', // cards, rows and pop-up sheets
  scrim: 'rgba(31,27,23,0.2)',
};

// Injected once. Motion follows the bobland rules: deceleration only, no
// bounce, blur-fades; everything stops under prefers-reduced-motion.
export const HOME_CSS = `
.bk-root { font-family: 'Schibsted Grotesk', system-ui, sans-serif; color: ${COLORS.ink}; background: ${COLORS.wall}; }
.bk-root button { font: inherit; color: inherit; }
.bk-scroll::-webkit-scrollbar { display: none; }
/* Nothing in a scrolling column gets squashed when the content runs long. */
.bk-scroll > *, .bk-sheet > * { flex-shrink: 0; }
.bk-row, .bk-chip, .bk-cup, .bk-month-pill { flex-shrink: 0; }
.bk-plank { height: 9px; margin: 0 -4px; border-radius: 2px;
  background: linear-gradient(#7B4C2D 0 2px, #5C361E 2px 100%);
  box-shadow: 0 12px 16px -10px rgba(45,28,16,.4), 0 1px 2px rgba(45,28,16,.2); }
.bk-cup { appearance: none; border: 0; background: transparent; cursor: pointer; padding: 0; position: relative; top: 0;
  transition: top .6s cubic-bezier(0.16,0.9,0.4,1); }
/* Lift with "top", not transform: a transform would isolate the cup and
   bring back the white halo the multiply blend removes. */
.bk-cup:hover { top: -3px; }
.bk-cup:focus-visible, .bk-row:focus-visible { outline: 2px solid ${COLORS.green}; outline-offset: 4px; border-radius: 12px; }
.bk-cup img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: bottom; mix-blend-mode: multiply; }
.bk-cup img.ghost { filter: grayscale(1); opacity: .18; }
.bk-cup img.glaze { transition: clip-path 1.4s cubic-bezier(0.16,0.9,0.4,1); }
.bk-chip { appearance: none; border: 0; cursor: pointer; background: transparent; font-size: 13px; height: 34px; padding: 0 12px;
  border-radius: 999px; box-shadow: inset 0 0 0 1px ${COLORS.line}; transition: background .3s ease, color .3s ease; }
.bk-chip:hover { background: ${COLORS.espresso}; color: ${COLORS.wall}; }
.bk-root .bk-btn, .bk-btn { appearance: none; border: 0; cursor: pointer; background: ${COLORS.espresso}; color: ${COLORS.wall}; font-size: 16px;
  font-weight: 500; height: 56px; flex-shrink: 0; border-radius: 999px; width: 100%; transition: background .3s ease; }
.bk-root .bk-btn:hover { background: #1E140E; }
.bk-btn:disabled { opacity: .4; cursor: default; }
/* The bottom bar lives in src/components/Dock.web.tsx. */
.bk-month-pill { appearance: none; border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px;
  margin-left: -2px; border-radius: 999px; background: #FFFFFF; color: ${COLORS.ink}; font: inherit; font-size: 14px;
  box-shadow: inset 0 0 0 1px ${COLORS.hairline}; transition: box-shadow .3s ease; }
.bk-month-pill:hover { box-shadow: inset 0 0 0 1px ${COLORS.line}; }
.bk-root .bk-mark { appearance: none; border: 0; background: transparent; cursor: pointer; align-self: center; margin-top: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 10px; color: ${COLORS.faint}; font-size: 12px; padding: 12px; letter-spacing: .02em; }
.bk-month-pill svg { color: ${COLORS.muted}; }
.bk-month-strip { position: relative; display: flex; gap: 2px; height: 36px; padding: 0; margin: 0 -24px; padding: 0 24px; overflow-x: auto;
  scrollbar-width: none; scroll-snap-type: x proximity; -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent); }
.bk-month-strip button { position: relative; z-index: 1; flex: 0 0 auto; appearance: none; border: 0; background: transparent; cursor: pointer;
  height: 36px; padding: 0 14px; border-radius: 999px; font: inherit; font-size: 14px; color: ${COLORS.muted}; scroll-snap-align: center;
  transition: color .45s cubic-bezier(0.16,0.9,0.4,1); }
.bk-month-strip button.on { color: ${COLORS.wall}; }
.bk-month-strip button .yr { font-size: 10px; margin-left: 3px; opacity: .6; }
.bk-month-ind { position: absolute; top: 0; height: 36px; border-radius: 999px; background: ${COLORS.espresso}; z-index: 0;
  transition: left .5s cubic-bezier(0.16,0.9,0.4,1), width .5s cubic-bezier(0.16,0.9,0.4,1); }
@keyframes bkFadeIn { from { opacity: 0; filter: blur(4px); } to { opacity: 1; filter: none; } }
.bk-fade-in { animation: bkFadeIn .45s cubic-bezier(0.16,0.9,0.4,1) backwards; }
@media (prefers-reduced-motion: reduce) { .bk-month-ind, .bk-month-strip button { transition: none; } .bk-fade-in { animation: none; } }
/* No blur on the sheet: blurring a full-screen layer drops frames on phones. */
@keyframes bkSheetIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes bkFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bkStep { from { opacity: 0; transform: translateY(16px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
.bk-sheet { animation: bkSheetIn .6s cubic-bezier(0.16,0.9,0.4,1) backwards; }
.bk-scrim { animation: bkFade .4s ease backwards; }
.bk-step { animation: bkStep .7s cubic-bezier(0.16,0.9,0.4,1) backwards; }
@media (prefers-reduced-motion: reduce) {
  .bk-sheet, .bk-scrim, .bk-step { animation: none; }
  .bk-cup, .bk-cup img.glaze { transition: none; }
}
`;

let injected = false;
export function useHomeStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600&display=swap';
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.textContent = HOME_CSS;
  document.head.appendChild(style);
}

/** Closes a sheet on Escape, like tapping the backdrop. */
export function useEscape(onClose: () => void) {
  const ref = React.useRef(onClose);
  ref.current = onClose;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function currentMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long' });
}
