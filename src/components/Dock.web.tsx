import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { COLORS, currentMonth } from '../screens/home/homeStyles';

// The bottom bar: one dark capsule. Two hand-drawn icons with a soft
// highlight that slides between them, and a cream + that turns into × and
// opens a small menu. Built after the curriculum app's Dock (src/ui/Dock.tsx).
// Small delights: and tapping Home again floats you back up.

export type DockScreen = 'home' | 'settings';
// Drawn for Moru in one soft line weight: a house for Home, two sliders for Settings.
const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 10.6 11 5.2a1.6 1.6 0 0 1 2 0l6.5 5.4V18a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z" />
    <path d="M10 20v-4.2a2 2 0 0 1 4 0V20" />
  </svg>
);
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M4 8h16M4 16h16" />
    <circle cx="9" cy="8" r="2.2" fill="currentColor" />
    <circle cx="15" cy="16" r="2.2" fill="currentColor" />
  </svg>
);
const TABS: { id: DockScreen; label: string; Icon: React.FC }[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

/** Asks Home to open the net worth sheet at the balances (Home owns it). If Home
 *  isn't mounted yet (asked from Settings), it picks the request up on mount. */
export const NET_WORTH_EVENT = 'moru:networth';
let pendingNetWorth = false;
export const takeNetWorthRequest = () => { const p = pendingNetWorth; pendingNetWorth = false; return p; };
const askNetWorth = () => { pendingNetWorth = true; window.dispatchEvent(new Event(NET_WORTH_EVENT)); };

const CSS = `
.mdock { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 18px); transform: translateX(-50%); z-index: 1000;
  min-height: 0; box-sizing: border-box; padding: 3px; border-radius: 999px; display: flex; align-items: center;
  background: rgba(43,29,21,0.92); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); color: ${COLORS.wall};
  box-shadow: inset 0 1px 0 rgba(255,236,214,0.08), 0 12px 28px -12px rgba(31,27,23,0.6);
  font-family: 'Schibsted Grotesk', system-ui, sans-serif; }
.mdock button { appearance: none; border: 0; background: transparent; cursor: pointer; font: inherit; color: inherit; padding: 0; }
.mdock-tabs { position: relative; display: flex; }
.mdock-blob { position: absolute; top: 0; bottom: 0; width: 50%; border-radius: 999px; background: rgba(243,240,234,0.15);
  transition: left .55s cubic-bezier(0.16,0.9,0.4,1); }
.mdock-tab { position: relative; z-index: 1; width: 50px; height: 36px; border-radius: 999px; display: grid; place-items: center;
  opacity: .55; transition: opacity .35s ease; }
.mdock-tab.on { opacity: 1; }
.mdock .mdock-plus { position: relative; flex: none; width: 36px; height: 36px; margin-left: 3px; border-radius: 50%; background: ${COLORS.wall};
  color: ${COLORS.ink}; display: grid; place-items: center; }
.mdock-plus svg { transition: transform .5s cubic-bezier(0.16,0.9,0.4,1); }
.mdock-plus.open svg { transform: rotate(135deg); }
.mdock-dot { position: absolute; top: 0; right: 0; width: 8px; height: 8px; border-radius: 50%; background: #E89A62;
  box-shadow: 0 0 0 2px #2B1D15, 0 0 10px 2px rgba(232,154,98,0.65); }
.mdock-menu { position: absolute; right: 0; bottom: calc(100% + 10px); width: 250px; box-sizing: border-box; padding: 6px; border-radius: 24px;
  background: rgba(43,29,21,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: inset 0 1px 0 rgba(255,236,214,0.08), 0 14px 32px -12px rgba(31,27,23,0.55);
  display: flex; flex-direction: column; gap: 2px; transform-origin: bottom right; animation: mdockMenu .38s cubic-bezier(0.16,0.9,0.4,1); }
@keyframes mdockMenu { from { opacity: 0; transform: translateY(6px) scale(.94); } }
.mdock .mdock-menu button { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; min-height: 52px;
  padding: 8px 16px; border-radius: 18px; text-align: left; transition: background .25s ease; }
.mdock .mdock-menu button:hover, .mdock .mdock-menu button:active { background: rgba(243,240,234,0.1); }
.mdock-menu b { font-size: 15px; font-weight: 500; }
.mdock-menu span { font-size: 12px; color: rgba(243,240,234,0.6); }
.mdock-menu .count { display: inline-block; margin-left: 6px; color: #F2B48A; }
.mdock button:focus-visible { outline: 2px solid #F2B48A; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .mdock-blob, .mdock-tab, .mdock-plus svg { transition: none; } .mdock-menu { animation: none; } }
`;

let injected = false;
function useDockCss() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Dock({ screen, onScreen, onAdd, onCheckin }: {
  screen: DockScreen; onScreen: (s: DockScreen) => void; onAdd: () => void; onCheckin: () => void;
}) {
  useDockCss();
  const { user } = useAuth();
  // Same query and arguments as Home, so it shares the subscription.
  const data = useQuery(api.home.summary, user ? { userId: user._id, month: currentMonth() } : 'skip');
  const toFile = data ? Math.max(0, data.pendingCount - (data.moneyInCount ?? 0)) : 0;
  const [menu, setMenu] = useState(false);
  const nav = useRef<HTMLElement>(null);

  // The menu closes on Escape or a tap anywhere outside the dock.
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => { if (!nav.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const pick = (t: DockScreen) => {
    if (t === screen) {
      // Tapping Home again floats the page back to the top.
      document.querySelector('.bk-root.bk-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onScreen(t);
  };
  const run = (fn: () => void) => { setMenu(false); fn(); };

  return (
    <nav ref={nav} className="mdock" aria-label="Main">
      <div className="mdock-tabs">
        <span className="mdock-blob" style={{ left: screen === 'home' ? 0 : '50%' }} />
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`mdock-tab ${t.id === screen ? 'on' : ''}`}
            aria-current={t.id === screen ? 'page' : undefined} aria-label={t.label} onClick={() => pick(t.id)}>
            <t.Icon />
          </button>
        ))}
      </div>

      {menu && (
        <div className="mdock-menu" role="menu" aria-label="Add">
          <button type="button" role="menuitem" onClick={() => run(onAdd)}><b>Add a spend</b><span>something you paid for</span></button>
          <button type="button" role="menuitem" onClick={() => run(onCheckin)}>
            <b>Check-in{toFile > 0 && <span className="count">{toFile} to file</span>}</b><span>file spends, fill your cups</span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(() => { askNetWorth(); onScreen('home'); })}>
            <b>Update balances</b><span>what your accounts hold now</span>
          </button>
        </div>
      )}

      <button type="button" className={`mdock-plus ${menu ? 'open' : ''}`} aria-label={menu ? 'Close' : 'Add'}
        aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M8 2.5v11M2.5 8h11" /></svg>
        {toFile > 0 && !menu && <span className="mdock-dot" aria-hidden />}
      </button>
    </nav>
  );
}
