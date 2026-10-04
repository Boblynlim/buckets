import React, { useId, useState, useEffect } from 'react';
import { COLORS, useHomeStyles } from '../screens/home/homeStyles';

interface PotteryLoaderProps {
  message?: string;
}

// The app's loading state: a cup thrown on the wheel. A lump of wet clay is
// centred and pulled up into a cup; faint throwing rings slide across it so
// it reads as spinning without anything rotating. A pause, a soft blur-fade,
// and it starts again. Deceleration easing only. Under reduced motion it is
// the finished cup, still.

// Every outline uses the same commands (M, 3 C, Z) so the morph is smooth.
// Symmetric about x = 48; the wheel head sits at y = 80.
const LUMP = 'M20 80 C20 70 30 64 38 63 C42 61 54 61 58 63 C66 64 76 70 76 80 Z';
const CONE = 'M24 80 C26 64 38 50 42 40 C45 37 51 37 54 40 C58 50 70 64 72 80 Z';
const OPEN = 'M23 80 C23 66 27 56 30 50 C40 48 56 48 66 50 C69 56 73 66 73 80 Z';
const CUP = 'M31 80 C28 68 28 46 29 31 C40 29 56 29 67 31 C68 46 68 68 65 80 Z';

const DUR = '3.6s';
// lump (hold) -> cone -> opened -> cup (pause) -> blur out
const D_VALUES = [LUMP, LUMP, CONE, OPEN, CUP, CUP].join(';');
const D_TIMES = '0;0.1;0.36;0.54;0.74;1';
const EASE = '0.16 0.9 0.4 1';
const D_SPLINES = [EASE, EASE, EASE, EASE, '0 0 1 1'].join(';');

const CLAY_LIGHT = '#C08D69';
const CLAY = '#B07A55';
const CLAY_DARK = '#8E5D3F';

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

function Wheel({ id, still }: { id: string; still: boolean }) {
  const anim = (attr: string, values: string, keyTimes: string, splines?: string) =>
    still ? null : (
      <animate attributeName={attr} dur={DUR} repeatCount="indefinite" values={values} keyTimes={keyTimes}
        {...(splines ? { calcMode: 'spline', keySplines: splines } : {})} />
    );

  // A throwing ring: a short groove that slides across the clay, left to right.
  const ring = (y: number, delay: number, w: number) =>
    still ? null : (
      <line x1={-w / 2} y1={y} x2={w / 2} y2={y} stroke={CLAY_DARK} strokeWidth="0.9" strokeLinecap="round" opacity="0.45">
        <animateTransform attributeName="transform" type="translate" from="22 0" to="74 0" dur="1.3s" begin={`${delay}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.45;0.45;0" keyTimes="0;0.2;0.8;1" dur="1.3s" begin={`${delay}s`} repeatCount="indefinite" />
      </line>
    );

  return (
    <svg width="88" height="88" viewBox="0 0 96 96" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${id}-clay`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={CLAY_LIGHT} />
          <stop offset="0.45" stopColor={CLAY} />
          <stop offset="1" stopColor={CLAY_DARK} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={still ? CUP : LUMP}>{anim('d', D_VALUES, D_TIMES, D_SPLINES)}</path>
        </clipPath>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0">
            {anim('stdDeviation', '0;0;3;0', '0;0.9;0.98;1')}
          </feGaussianBlur>
        </filter>
      </defs>

      {/* Wheel head */}
      <ellipse cx="48" cy="81" rx="36" ry="2.6" fill="#DDD5C9" />

      <g filter={still ? undefined : `url(#${id}-soft)`}>
        {anim('opacity', '0;1;1;0;0', '0;0.05;0.9;0.98;1')}
        <path d={still ? CUP : LUMP} fill={`url(#${id}-clay)`}>
          {anim('d', D_VALUES, D_TIMES, D_SPLINES)}
        </path>
        {/* The cup's opening, once it is a cup */}
        <ellipse cx="48" cy="31" rx="17.5" ry="2.6" fill="#6E4630" opacity={still ? 0.9 : 0}>
          {anim('opacity', '0;0;0.9;0.9;0', '0;0.66;0.76;0.9;1')}
        </ellipse>
        <g clipPath={`url(#${id}-clip)`}>
          {ring(76, 0, 12)}
          {ring(68, 0.45, 16)}
          {ring(58, 0.9, 14)}
          {ring(46, 0.2, 12)}
          {ring(37, 0.7, 10)}
          {!still && (
            <rect x="-10" y="20" width="14" height="62" fill={`url(#${id}-shine)`}>
              <animateTransform attributeName="transform" type="translate" from="18 0" to="76 0" dur="2.6s" repeatCount="indefinite" />
            </rect>
          )}
        </g>
      </g>
    </svg>
  );
}

export const PotteryLoader: React.FC<PotteryLoaderProps> = ({ message = 'Getting your cups ready.' }) => {
  useHomeStyles();
  const id = 'bkl' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const still = usePrefersReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        fontFamily: "'Schibsted Grotesk', system-ui, sans-serif", padding: 24,
      }}
    >
      <Wheel id={id} still={still} />
      <span style={{ fontSize: 14, color: COLORS.muted, letterSpacing: '-0.01em' }}>{message}</span>
    </div>
  );
};
