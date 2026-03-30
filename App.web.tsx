/**
 * Buckets - Web Version
 */

import React, { useState, useEffect, useMemo } from 'react';
import { register as registerServiceWorker } from './src/serviceWorkerRegistration';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { PotteryLoader } from './src/components/PotteryLoader';
import { ConvexProvider, useAction } from 'convex/react';
import { api } from './convex/_generated/api';
import {
  PaintBucket,
  Settings as SettingsIcon,
  PackagePlus,
  Plus,
} from 'lucide-react';
import { convexClient } from './src/lib/convex';
import { AuthProvider, useAuth } from './src/lib/AuthContext';
import { BucketsOverview } from './src/screens/BucketsOverview.web';
import { AddBucket } from './src/screens/AddBucket';
import { AddExpense } from './src/screens/AddExpense';
import { Settings } from './src/screens/Settings';
import { Reports } from './src/screens/Reports';
import { IncomeManagement } from './src/screens/IncomeManagement';
import { EditBucket } from './src/screens/EditBucket';
import { EditExpense } from './src/screens/EditExpense';
import { Letters } from './src/screens/Letters';
import { Drawer } from './src/components/Drawer';
import { DailyPromptModal } from './src/components/DailyPromptModal';
import { GrowthLetterOverlay } from './src/components/GrowthLetter';
import { theme } from './src/theme';
import type { Bucket, Expense } from './src/types';

type Screen = 'buckets' | 'settings' | 'reports' | 'letters';

// Cup images for the shelf — all 15 cups fill a 5x5 grid
const SHELF_CUPS = [
  require('./assets/images/cup0.png'),
  require('./assets/images/cup8.png'),
  require('./assets/images/cup9.png'),
  require('./assets/images/cup10.png'),
  require('./assets/images/cup11.png'),
  require('./assets/images/cup12.png'),
  require('./assets/images/cup13.png'),
  require('./assets/images/cup14.png'),
  require('./assets/images/cup15.png'),
  require('./assets/images/cup16.png'),
  require('./assets/images/cup17.png'),
  require('./assets/images/cup18.png'),
  require('./assets/images/cup19.png'),
  require('./assets/images/cup20.png'),
  require('./assets/images/cup21.png'),
];

const SHELF_IMG = require('./assets/images/shelf.png');
const WALL_IMG = require('./assets/images/wall.jpg');

// Slight random rotations per cup for personality
const CUP_ROTATIONS = [-3, 2, -1, 4, -2, 1, 3, -4, 2, -1, 3, -2, 1, -3, 2];

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

function useResponsiveShelf() {
  const { w, h } = useWindowSize();
  return useMemo(() => {
    let cols: number, rows: number;

    if (w < 400) {
      cols = 3; rows = Math.max(5, Math.round(h / (w / 3)));
    } else if (w < 600) {
      cols = 4; rows = Math.max(5, Math.round(h / (w / 4)));
    } else if (w < 900) {
      cols = 5; rows = Math.max(4, Math.round(h / (w / 5)));
    } else if (w < 1200) {
      cols = 6; rows = Math.max(4, Math.round(h / (w / 6)));
    } else {
      cols = 7; rows = Math.max(4, Math.round(h / (w / 7)));
    }
    rows = Math.min(rows, 9);
    const total = cols * rows;

    const divider = w < 400 ? 6 : w < 600 ? 8 : w < 900 ? 10 : 12;
    const frame = w < 400 ? 8 : w < 600 ? 10 : w < 900 ? 14 : 16;
    const formMaxWidth = w < 400 ? 280 : w < 600 ? 340 : w < 900 ? 380 : 400;
    const titleSize = w < 400 ? 28 : w < 600 ? 36 : 40;
    const inputHeight = w < 400 ? 40 : 44;

    // Compute which cells the form card overlaps — those stay empty
    const cellW = (w - 2 * frame - (cols - 1) * divider) / cols;
    const cellH = (h - 2 * frame - (rows - 1) * divider) / rows;
    const formW = formMaxWidth + 56; // card padding
    const formH = 460;
    const cx = w / 2;
    const cy = h / 2;

    const formCells = new Set<number>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const l = frame + c * (cellW + divider);
        const t = frame + r * (cellH + divider);
        const rr = l + cellW;
        const b = t + cellH;
        if (rr > cx - formW / 2 && l < cx + formW / 2 && b > cy - formH / 2 && t < cy + formH / 2) {
          formCells.add(r * cols + c);
        }
      }
    }

    return { cols, rows, total, formCells, divider, frame, formMaxWidth, titleSize, inputHeight };
  }, [w, h]);
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isLocked, loginWithPasscode, loginWithEmail, signupWithEmail, setupPasscode, unlock } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [authStep, setAuthStep] = useState<'email' | 'passcode'>('email'); // email first, then passcode
  const [isSetup, setIsSetup] = useState(false); // true = first time setup
  const [isConfirming, setIsConfirming] = useState(false); // confirm step during setup
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  const hasUsersAction = useAction(api.auth.hasUsersWithPasscode);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Check if this is first-time setup or returning user
  useEffect(() => {
    hasUsersAction({}).then((has: boolean) => {
      setIsSetup(!has);
      setCheckingSetup(false);
    }).catch(() => setCheckingSetup(false));
  }, [hasUsersAction]);

  // Inject shelf animations
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'shelf-animations';
    style.textContent = `
      @keyframes cupDrop {
        0% { opacity: 0; transform: translateY(-30px) scale(0.7) rotate(var(--rot, 0deg)); }
        60% { opacity: 1; transform: translateY(4px) scale(1.02) rotate(var(--rot, 0deg)); }
        80% { transform: translateY(-2px) scale(0.98) rotate(var(--rot, 0deg)); }
        100% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--rot, 0deg)); }
      }
      @keyframes cupFloat {
        0%, 100% { transform: translateY(0px) rotate(var(--rot, 0deg)); }
        50% { transform: translateY(-3px) rotate(calc(var(--rot, 0deg) + 1deg)); }
      }
      @keyframes cupWobble {
        0%, 100% { transform: rotate(var(--rot, 0deg)); }
        15% { transform: rotate(calc(var(--rot, 0deg) - 6deg)) scale(0.95); }
        30% { transform: rotate(calc(var(--rot, 0deg) + 5deg)) scale(1.03); }
        50% { transform: rotate(calc(var(--rot, 0deg) - 3deg)); }
        70% { transform: rotate(calc(var(--rot, 0deg) + 2deg)); }
        85% { transform: rotate(calc(var(--rot, 0deg) - 1deg)); }
      }
      @keyframes successWiggle {
        0%, 100% { transform: rotate(var(--rot, 0deg)); }
        15% { transform: rotate(calc(var(--rot, 0deg) - 10deg)) scale(1.05); }
        30% { transform: rotate(calc(var(--rot, 0deg) + 8deg)) scale(1.02); }
        45% { transform: rotate(calc(var(--rot, 0deg) - 6deg)); }
        60% { transform: rotate(calc(var(--rot, 0deg) + 4deg)); }
        80% { transform: rotate(calc(var(--rot, 0deg) - 2deg)); }
      }
      @keyframes errorShake {
        0%, 100% { transform: translateX(0); }
        15% { transform: translateX(-8px); }
        30% { transform: translateX(8px); }
        45% { transform: translateX(-6px); }
        60% { transform: translateX(6px); }
        75% { transform: translateX(-3px); }
        90% { transform: translateX(3px); }
      }
      @keyframes formFadeIn {
        0% { opacity: 0; transform: translateY(16px) scale(0.97); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      .cup-cell { cursor: pointer; -webkit-tap-highlight-color: transparent; }
      .cup-cell .cup-wrap { transition: transform 0.15s ease; }
      .cup-cell:active .cup-wrap { transform: rotate(-6deg) scale(0.93); }
      .cup-cell.success .cup-img { animation: successWiggle 0.7s ease !important; }
      .error-shake { animation: errorShake 0.5s ease; }
      .auth-input::placeholder { color: rgba(0,0,0,0.28); }
      .auth-input:focus { border-color: #5C8A7A !important; box-shadow: 0 0 0 3px rgba(92,138,122,0.15) !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('shelf-animations')?.remove(); };
  }, []);

  // Reset passcode when lock screen activates
  useEffect(() => {
    if (isLocked) {
      setPasscode('');
      setConfirmPasscode('');
      setError('');
      setSubmitting(false);
    }
  }, [isLocked]);

  // Reset state when user logs out
  const prevUser = React.useRef(user);
  useEffect(() => {
    if (prevUser.current && !user && !isLocked) {
      setPasscode('');
      setConfirmPasscode('');
      setEmail('');
      setName('');
      setAuthStep('email');
      setIsConfirming(false);
      setError('');
      setSubmitting(false);
      setSuccess(false);
    }
    prevUser.current = user;
  }, [user, isLocked]);

  const responsive = useResponsiveShelf();
  const { formMaxWidth, titleSize } = responsive;

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#EAE3D5',
      }}>
        <PotteryLoader />
      </div>
    );
  }

  if (user && !isLocked) return <>{children}</>;

  // Determine if this is a lock screen (has session, just timed out)
  const isLockScreen = isLocked;

  const cleanError = (err: any): string => {
    const msg = err?.data || err?.message || '';
    if (typeof msg !== 'string' || !msg) return 'Something went wrong. Please try again.';
    // Extract meaningful error from Convex wrapper
    if (msg.includes('Uncaught Error:')) return msg.split('Uncaught Error:').pop()!.split('\n')[0].trim();
    // Strip Convex metadata prefix like "[CONVEX A(...)] [Request ID: ...] "
    const stripped = msg.replace(/\[CONVEX [^\]]+\]\s*\[Request ID: [^\]]+\]\s*/g, '').trim();
    if (stripped === 'Server Error Called by client' || stripped === 'Server Error') return 'Something went wrong. Please try again.';
    return stripped || 'Something went wrong. Please try again.';
  };

  // Handle digit press
  const handleDigit = (digit: string) => {
    if (submitting) return;
    setError('');
    if (isSetup && isConfirming) {
      if (confirmPasscode.length < 6) {
        const next = confirmPasscode + digit;
        setConfirmPasscode(next);
        if (next.length === 6) {
          if (next === passcode) {
            setSubmitting(true);
            signupWithEmail(email, name, next).then(() => {
              setSuccess(true);
            }).catch((err: any) => {
              setError(cleanError(err));
              setConfirmPasscode('');
            }).finally(() => setSubmitting(false));
          } else {
            setError("Passcodes don't match");
            setConfirmPasscode('');
            setPasscode('');
            setIsConfirming(false);
          }
        }
      }
    } else {
      if (passcode.length < 6) {
        const next = passcode + digit;
        setPasscode(next);
        if (next.length === 6) {
          if (isLockScreen) {
            // Quick unlock — verify via server (loginWithPasscode)
            setSubmitting(true);
            loginWithPasscode(next).then(() => {
              unlock();
              setSuccess(true);
            }).catch((err: any) => {
              setError(cleanError(err));
              setPasscode('');
            }).finally(() => setSubmitting(false));
          } else if (isSetup) {
            // Move to confirm step
            setIsConfirming(true);
          } else {
            // Login with email + passcode
            setSubmitting(true);
            loginWithEmail(email, next).then(() => {
              setSuccess(true);
            }).catch((err: any) => {
              setError(cleanError(err));
              setPasscode('');
            }).finally(() => setSubmitting(false));
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (submitting) return;
    setError('');
    if (isSetup && isConfirming) {
      setConfirmPasscode((p) => p.slice(0, -1));
    } else {
      setPasscode((p) => p.slice(0, -1));
    }
  };

  const handleEmailSubmit = () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (isSetup && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    setAuthStep('passcode');
  };

  const currentCode = (isSetup && isConfirming) ? confirmPasscode : passcode;

  // Ceramic cup clink sounds — bright, short, high-pitched like tapping porcelain
  const CLINK_NOTES = [
    1568, 1760, 1976, 2093, 2349, 2637, 2794, 3136, 3520, 3951, 4186, 4699,
  ];
  const playCupChime = (row: number, col: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const t = ctx.currentTime;
      const noteIdx = Math.min(row * 3 + col, CLINK_NOTES.length - 1);
      const baseFreq = CLINK_NOTES[noteIdx];
      const freq = baseFreq * (1 + (Math.random() - 0.5) * 0.015);

      // Primary clink — sharp sine with fast decay
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t);
      osc1.frequency.exponentialRampToValueAtTime(freq * 0.95, t + 0.12);
      g1.gain.setValueAtTime(0.18, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc1.connect(g1).connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.15);

      // High harmonic — ceramic shimmer
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.5, t);
      osc2.frequency.exponentialRampToValueAtTime(freq * 2.2, t + 0.08);
      g2.gain.setValueAtTime(0.06, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(t);
      osc2.stop(t + 0.08);

      // Tap body — short noise-like click from triangle wave
      const osc3 = ctx.createOscillator();
      const g3 = ctx.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(freq * 1.5, t);
      osc3.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.05);
      g3.gain.setValueAtTime(0.1, t);
      g3.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc3.connect(g3).connect(ctx.destination);
      osc3.start(t);
      osc3.stop(t + 0.06);

      setTimeout(() => ctx.close(), 250);
    } catch (_) {}
  };

  const PAD_CUPS = SHELF_CUPS.slice(0, 10);
  const PAD_LAYOUT = [
    { digit: '1', cupIdx: 1 },
    { digit: '2', cupIdx: 2 },
    { digit: '3', cupIdx: 3 },
    { digit: '4', cupIdx: 4 },
    { digit: '5', cupIdx: 5 },
    { digit: '6', cupIdx: 6 },
    { digit: '7', cupIdx: 7 },
    { digit: '8', cupIdx: 8 },
    { digit: '9', cupIdx: 9 },
    { digit: '', cupIdx: -1 },
    { digit: '0', cupIdx: 0 },
    { digit: 'del', cupIdx: -1 },
  ];

  const shelfSize = Math.min(formMaxWidth + 40, 360);

  const statusText = checkingSetup ? '' :
    isLockScreen ? 'enter passcode' :
    authStep === 'email' ? (isSetup ? 'create your account' : 'welcome back') :
    isSetup && !isConfirming ? 'set your passcode' :
    isSetup && isConfirming ? 'confirm passcode' :
    'enter passcode';

  // ── Email step (not shown on lock screen) ──
  const renderEmailStep = () => (
    <div style={{
      width: formMaxWidth,
      animation: mounted ? 'formFadeIn 0.5s ease 0.35s both' : 'none',
    }}>
      {isSetup && (
        <input
          className="auth-input"
          type="text"
          placeholder="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 16,
            fontFamily: 'Merchant',
            color: '#3D3229',
            background: 'rgba(255,255,255,0.5)',
            border: '1.5px solid rgba(0,0,0,0.1)',
            borderRadius: 12,
            outline: 'none',
            marginBottom: 10,
            textAlign: 'center',
            boxSizing: 'border-box' as const,
          }}
        />
      )}
      <input
        className="auth-input"
        type="email"
        placeholder="email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: 16,
          fontFamily: 'Merchant',
          color: '#3D3229',
          background: 'rgba(255,255,255,0.5)',
          border: '1.5px solid rgba(0,0,0,0.1)',
          borderRadius: 12,
          outline: 'none',
          marginBottom: 16,
          textAlign: 'center',
          boxSizing: 'border-box' as const,
        }}
      />
      <div
        onClick={handleEmailSubmit}
        style={{
          padding: '12px 24px',
          background: '#5C8A7A',
          borderRadius: 12,
          textAlign: 'center' as const,
          cursor: 'pointer',
          fontFamily: 'Merchant',
          fontSize: 16,
          color: '#fff',
          fontWeight: 500,
        }}
      >
        continue
      </div>
    </div>
  );

  // ── Passcode step (shown on lock screen and after email) ──
  const renderPasscodeStep = () => (
    <>
      {/* Passcode dots */}
      <div style={{
        display: 'flex',
        gap: 14,
        marginBottom: 24,
        animation: mounted ? 'formFadeIn 0.5s ease 0.35s both' : 'none',
      }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={error ? 'error-shake' : ''}
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: i < currentCode.length ? '#5C8A7A' : 'transparent',
              border: `2px solid ${i < currentCode.length ? '#5C8A7A' : 'rgba(0,0,0,0.15)'}`,
              transition: 'all 0.15s ease',
              transform: i < currentCode.length ? 'scale(1.1)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Shelf keypad */}
      <div style={{
        width: shelfSize,
        position: 'relative',
        animation: mounted ? 'formFadeIn 0.6s ease 0.4s both' : 'none',
        filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.2))',
      }}>
        <img
          src={SHELF_IMG}
          alt=""
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: 4,
          }}
        />
        <div style={{
          position: 'absolute',
          top: '3.5%',
          left: '4%',
          right: '4%',
          bottom: '3%',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: '3% 2.5%',
        }}>
          {PAD_LAYOUT.map((cell, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;

            if (cell.digit === '') return <div key={i} />;

            if (cell.digit === 'del') {
              return (
                <div
                  key={i}
                  onClick={handleDelete}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    userSelect: 'none' as const,
                  }}
                >
                  <span style={{
                    fontFamily: 'Merchant',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.75)',
                    fontWeight: 500,
                  }}>
                    delete
                  </span>
                </div>
              );
            }

            const cupSrc = PAD_CUPS[cell.cupIdx % PAD_CUPS.length];
            const rot = CUP_ROTATIONS[cell.cupIdx % CUP_ROTATIONS.length];
            const delay = 0.4 + i * 0.05;
            const floatDuration = 3.5 + (cell.cupIdx % 4) * 0.6;
            const floatDelay = (cell.cupIdx % 6) * 0.3;

            return (
              <div
                key={i}
                className={`cup-cell${success ? ' success' : ''}`}
                onClick={() => {
                  playCupChime(row, col);
                  handleDigit(cell.digit);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '6% 8% 4%',
                  cursor: 'pointer',
                  '--rot': `${rot}deg`,
                } as any}
              >
                <div className="cup-wrap" style={{ width: '85%', height: '80%' }}>
                  <img
                    className="cup-img"
                    src={cupSrc}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'bottom',
                      animation: mounted
                        ? `cupDrop 0.5s ease ${delay}s both, cupFloat ${floatDuration}s ease-in-out ${delay + 0.6 + floatDelay}s infinite`
                        : 'none',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
                      ...(success ? { animationDelay: `${cell.cupIdx * 0.06}s` } : {}),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back to email step (not on lock screen) */}
      {!isLockScreen && (
        <div
          onClick={() => {
            setAuthStep('email');
            setPasscode('');
            setConfirmPasscode('');
            setIsConfirming(false);
            setError('');
          }}
          style={{
            marginTop: 16,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            color: 'rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }}
        >
          ← back to email
        </div>
      )}
    </>
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      overflow: 'hidden',
      background: `#E8E0D0 url(${WALL_IMG}) center / cover no-repeat`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: "'Kaitou Yokoku Gothic', serif",
        fontSize: titleSize * 1.2,
        color: '#5C3D2E',
        textAlign: 'center' as const,
        marginBottom: 8,
        letterSpacing: 2,
        animation: mounted ? 'formFadeIn 0.5s ease 0.2s both' : 'none',
      }}>
        神棚
      </div>

      {/* Status text */}
      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        color: 'rgba(0,0,0,0.35)',
        textAlign: 'center' as const,
        marginBottom: 16,
        animation: mounted ? 'formFadeIn 0.5s ease 0.3s both' : 'none',
        minHeight: 18,
      }}>
        {statusText}
      </div>

      {/* Error message */}
      {error !== '' && (
        <div key={error} style={{
          marginBottom: 16,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          color: '#C0392B',
          textAlign: 'center' as const,
          maxWidth: formMaxWidth,
          paddingLeft: 20,
          paddingRight: 20,
        }}>
          {error}
        </div>
      )}

      {/* Render the right step */}
      {isLockScreen ? renderPasscodeStep() :
       authStep === 'email' ? renderEmailStep() :
       renderPasscodeStep()}

      {/* Toggle setup / login (only on email step, not lock screen) */}
      {!checkingSetup && !isLockScreen && authStep === 'email' && (
        <div
          onClick={() => {
            setIsSetup(!isSetup);
            setIsConfirming(false);
            setPasscode('');
            setConfirmPasscode('');
            setEmail('');
            setName('');
            setError('');
          }}
          style={{
            marginTop: 20,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            color: 'rgba(0,0,0,0.3)',
            cursor: 'pointer',
            animation: mounted ? 'formFadeIn 0.5s ease 0.6s both' : 'none',
          }}
        >
          {isSetup ? 'already have an account? tap to log in' : 'new here? tap to sign up'}
        </div>
      )}

      {/* Loading overlay */}
      {submitting && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(234,227,213,0.6)',
          zIndex: 10,
        }}>
          <PotteryLoader message="Entering..." />
        </div>
      )}
    </div>
  );
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('buckets');
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showIncomeManagement, setShowIncomeManagement] = useState(false);
  const [showEditBucket, setShowEditBucket] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [editSuggestedAmount, setEditSuggestedAmount] = useState<number | undefined>(undefined);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<{expense: Expense; bucket: Bucket} | null>(null);
  const [isReportSelected, setIsReportSelected] = useState(false);
  const [isLetterSelected, setIsLetterSelected] = useState(false);

  // Register service worker for PWA functionality
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker();
    }
  }, []);

  // Inject noise texture overlay into DOM (outside React tree so it stays on top)
  useEffect(() => {
    const el = document.createElement('div');
    el.id = 'noise-overlay';
    el.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0.03;
      mix-blend-mode: multiply;
    `;
    el.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <filter id="noiseFilter">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
    </svg>`;
    document.body.appendChild(el);
    return () => { document.body.removeChild(el); };
  }, []);

  const handleSaveBucket = (bucketData: any) => {
    console.log('New bucket:', bucketData);
    // Bucket is now saved to Convex automatically in AddBucket component
    setShowAddBucket(false);
  };

  const handleEditBucket = (bucket: Bucket, suggestedAmount?: number) => {
    setSelectedBucket(bucket);
    setEditSuggestedAmount(suggestedAmount);
    setShowEditBucket(true);
  };

  const handleEditExpense = (expense: Expense, bucket: Bucket) => {
    setSelectedExpense({ expense, bucket });
    setShowEditExpense(true);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'buckets':
        return (
          <BucketsOverview
            onEditBucket={handleEditBucket}
            onEditExpense={handleEditExpense}
          />
        );
      case 'settings':
        return (
          <Settings
            onAddBucket={() => setShowAddBucket(true)}
            onEditBucket={handleEditBucket}
            onSetIncome={() => setShowIncomeManagement(true)}
            onNavigateToReports={() => setCurrentScreen('reports')}
            onNavigateToLetters={() => setCurrentScreen('letters')}
          />
        );
      case 'reports':
        return <Reports onReportSelected={setIsReportSelected} />;
      case 'letters':
        return <Letters onLetterSelected={setIsLetterSelected} />;
      default:
        return (
          <BucketsOverview
            onEditBucket={handleEditBucket}
            onEditExpense={handleEditExpense}
          />
        );
    }
  };

  return (
    <ConvexProvider client={convexClient}>
    <AuthProvider>
    <AuthGate>
      <View style={styles.container}>
        <View style={styles.content}>{renderScreen()}</View>

        {/* Bottom Navigation - Left pill with icons only */}
        {!isReportSelected && !isLetterSelected && (
          <View style={styles.navContainer}>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            height: 56,
            paddingLeft: 8,
            paddingRight: 8,
            borderRadius: 28,
            background: 'rgba(92, 138, 122, 0.4)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => setCurrentScreen('buckets')}
            >
              <View
                style={[
                  styles.iconWrapper,
                  currentScreen === 'buckets' && styles.tabActive,
                ]}
              >
                <PaintBucket
                  size={22}
                  color="#FFFFFF"
                  strokeWidth={1.5}
                  style={{ opacity: currentScreen === 'buckets' ? 1 : 0.7 }}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tab}
              onPress={() => setCurrentScreen('settings')}
            >
              <View
                style={[
                  styles.iconWrapper,
                  currentScreen === 'settings' && styles.tabActive,
                ]}
              >
                <SettingsIcon
                  size={22}
                  color="#FFFFFF"
                  strokeWidth={1.5}
                  style={{ opacity: currentScreen === 'settings' ? 1 : 0.7 }}
                />
              </View>
            </TouchableOpacity>
          </div>

          {/* Two Circular Action Buttons on the right */}
          <View style={styles.actionButtons}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: 'rgba(92, 138, 122, 0.4)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }} onClick={() => setShowAddExpense(true)}>
              <Plus size={24} color="#FFFFFF" strokeWidth={1.5} />
            </div>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: 'rgba(92, 138, 122, 0.4)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }} onClick={() => setShowAddBucket(true)}>
              <PackagePlus size={24} color="#FFFFFF" strokeWidth={1.5} />
            </div>
          </View>
        </View>
        )}

        {/* Add Bucket Modal */}
        {showAddBucket && (
          <AddBucket
            visible={showAddBucket}
            onClose={() => setShowAddBucket(false)}
            onSave={handleSaveBucket}
          />
        )}

        {/* Add Expense Modal */}
        {showAddExpense && (
          <AddExpense
            visible={showAddExpense}
            onClose={() => setShowAddExpense(false)}
          />
        )}

        {/* Income Management Modal */}
        {showIncomeManagement && (
          <IncomeManagement
            visible={showIncomeManagement}
            onClose={() => setShowIncomeManagement(false)}
          />
        )}

        {/* Edit Bucket Modal */}
        {selectedBucket && (
          <EditBucket
            visible={showEditBucket}
            bucket={selectedBucket}
            suggestedAmount={editSuggestedAmount}
            onClose={() => {
              setShowEditBucket(false);
              setSelectedBucket(null);
              setEditSuggestedAmount(undefined);
            }}
          />
        )}

        {/* Edit Expense Modal */}
        {selectedExpense && (
          <EditExpense
            visible={showEditExpense}
            expense={selectedExpense.expense}
            bucket={selectedExpense.bucket}
            onClose={() => {
              setShowEditExpense(false);
              setSelectedExpense(null);
            }}
          />
        )}

        {/* Daily Prompt Modal */}
        <DailyPromptModal />

        {/* Growth Letter Overlay — appears when unread letter exists */}
        <GrowthLetterOverlay />
      </View>
    </AuthGate>
    </AuthProvider>
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    position: 'relative' as any,
  },
  navContainer: {
    position: 'fixed' as any,
    bottom: 'env(safe-area-inset-bottom, 12px)' as any,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(92, 138, 122, 0.4)' as any,
    backdropFilter: 'blur(20px) saturate(180%)' as any,
    WebkitBackdropFilter: 'blur(20px) saturate(180%)' as any,
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)' as any,
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    alignItems: 'center',
    gap: 4,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
  },
  tabActive: {
    opacity: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(92, 138, 122, 0.4)' as any,
    backdropFilter: 'blur(20px) saturate(180%)' as any,
    WebkitBackdropFilter: 'blur(20px) saturate(180%)' as any,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)' as any,
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
  },
  buttonIconWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
  },
});

export default App;
