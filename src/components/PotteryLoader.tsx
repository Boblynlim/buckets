import React, { useState, useEffect } from 'react';
import { COLORS, useHomeStyles } from '../screens/home/homeStyles';

const loaderAnimation = require('../../assets/images/moru-happy-cup-loader.gif');
const loaderStill = require('../../assets/images/moru-happy-cup-loader-still.png');

interface PotteryLoaderProps {
  message?: string;
}

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

export const PotteryLoader: React.FC<PotteryLoaderProps> = ({ message = 'Getting your cups ready.' }) => {
  useHomeStyles();
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
      <div aria-hidden="true" style={{ width: 120, height: 120, position: 'relative', overflow: 'hidden' }}>
        <img
          src={still ? loaderStill : loaderAnimation}
          alt=""
          width={288}
          height={288}
          style={{ display: 'block', maxWidth: 'none', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', mixBlendMode: 'multiply' }}
        />
      </div>
      <span style={{ fontSize: 14, color: COLORS.muted, letterSpacing: '-0.01em' }}>{message}</span>
    </div>
  );
};
