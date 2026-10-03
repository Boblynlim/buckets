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

export const COLORS = {
  wall: '#F3F0EA',
  ink: '#1F1B17',
  muted: '#75695F',
  hairline: '#E4DFD6',
  green: '#4E7D6D',
  rust: '#A0563F',
  sheet: '#FFFFFF',
};

// Injected once. Motion follows the bobland rules: deceleration only, no
// bounce, blur-fades; everything stops under prefers-reduced-motion.
export const HOME_CSS = `
.bk-root { font-family: 'Schibsted Grotesk', system-ui, sans-serif; color: ${COLORS.ink}; background: ${COLORS.wall}; }
.bk-root button { font: inherit; color: inherit; }
.bk-scroll::-webkit-scrollbar { display: none; }
.bk-plank { height: 9px; margin: 0 -4px; border-radius: 2px;
  background: linear-gradient(#7B4C2D 0 2px, #5C361E 2px 100%);
  box-shadow: 0 12px 16px -10px rgba(45,28,16,.4), 0 1px 2px rgba(45,28,16,.2); }
.bk-cup { appearance: none; border: 0; background: transparent; cursor: pointer; padding: 0; position: relative;
  transition: transform .6s cubic-bezier(0.16,0.9,0.4,1); }
.bk-cup:hover { transform: translateY(-3px); }
.bk-cup:focus-visible, .bk-row:focus-visible { outline: 2px solid ${COLORS.green}; outline-offset: 4px; border-radius: 12px; }
.bk-cup img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: bottom; mix-blend-mode: multiply; }
.bk-cup img.ghost { filter: grayscale(1); opacity: .18; }
.bk-cup img.glaze { transition: clip-path 1.4s cubic-bezier(0.16,0.9,0.4,1); }
.bk-chip { appearance: none; border: 0; cursor: pointer; background: transparent; font-size: 13px; height: 34px; padding: 0 12px;
  border-radius: 999px; box-shadow: inset 0 0 0 1px #D9D2C6; transition: background .3s ease, color .3s ease; }
.bk-chip:hover { background: ${COLORS.ink}; color: ${COLORS.wall}; }
.bk-btn { appearance: none; border: 0; cursor: pointer; background: ${COLORS.ink}; color: ${COLORS.wall}; font-size: 16px;
  font-weight: 500; height: 56px; border-radius: 999px; width: 100%; transition: background .3s ease; }
.bk-btn:hover { background: #000; }
.bk-btn:disabled { opacity: .4; cursor: default; }
@keyframes bkSheetIn { from { opacity: 0; transform: translateY(24px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes bkFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bkStep { from { opacity: 0; transform: translateY(16px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
.bk-sheet { animation: bkSheetIn .6s cubic-bezier(0.16,0.9,0.4,1) both; }
.bk-scrim { animation: bkFade .4s ease both; }
.bk-step { animation: bkStep .7s cubic-bezier(0.16,0.9,0.4,1) both; }
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

export function currentMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long' });
}
