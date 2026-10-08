/**
 * Moru (formerly Buckets) - Web Version
 */

import React, { useState, useEffect, useMemo } from 'react';
import { register as registerServiceWorker } from './src/serviceWorkerRegistration';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { PotteryLoader } from './src/components/PotteryLoader';
import { ConvexProvider, useAction } from 'convex/react';
import { api } from './convex/_generated/api';
import {
} from 'lucide-react';
import { convexClient } from './src/lib/convex';
import { AuthProvider, useAuth } from './src/lib/AuthContext';
import { Home } from './src/screens/home/Home.web';
import { Checkin } from './src/screens/checkin/Checkin.web';
import { COLORS, SAFE_TOP, useHomeStyles } from './src/screens/home/homeStyles';
import { playClink, playTap, playUnlock } from './src/utils/cupClink';
import { AddBucket } from './src/screens/AddBucket';
import { AddExpense } from './src/screens/AddExpense';
import { Settings } from './src/screens/Settings';
import { IncomeManagement } from './src/screens/IncomeManagement';
import { EditBucket } from './src/screens/EditBucket';
import { EditExpense } from './src/screens/EditExpense';
import { ReviewQueue } from './src/screens/ReviewQueue.web';
import { Drawer } from './src/components/Drawer';
import { IslandNote } from './src/components/IslandNote.web';
import { MoruLogo, MoruSplash } from './src/components/MoruLogo';
import { Dock } from './src/components/Dock.web';
import { theme } from './src/theme';
import type { Bucket, Expense } from './src/types';

type Screen = 'buckets' | 'settings' | 'review';

// Cup images for the shelf — all 15 cups fill a 5x5 grid
const CUBBY_IMG = require('./assets/images/shelf.png');

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

  const hasUsersAction = useAction(api.auth.hasUsersWithPasscode);

  // Check if this is first-time setup or returning user
  useEffect(() => {
    hasUsersAction({}).then((has: boolean) => {
      setIsSetup(!has);
      setCheckingSetup(false);
    }).catch(() => setCheckingSetup(false));
  }, [hasUsersAction]);

  useHomeStyles();
  useEffect(() => { if (success) playUnlock(); }, [success]);

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


  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#F3F0EA',
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

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  const keyCup = (d: string) => {
    const mod: any = SHELF_CUPS[(Number(d) + 1) % SHELF_CUPS.length];
    return typeof mod === 'string' ? mod : mod?.default ?? '';
  };
  const statusText = checkingSetup ? '' :
    isLockScreen ? 'Enter your passcode' :
    authStep === 'email' ? (isSetup ? 'Create your account' : 'Look after your money, one cup at a time') :
    isSetup && !isConfirming ? 'Choose your own 6-digit code' :
    isSetup && isConfirming ? 'Tap the same code again' :
    'Enter your passcode';
  const linkStyle: React.CSSProperties = {
    appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer',
    color: COLORS.muted, fontSize: 14, minHeight: 44, fontFamily: 'inherit',
  };
  const inputStyle: React.CSSProperties = {
    appearance: 'none', border: 0, background: 'transparent', width: '100%', boxSizing: 'border-box', height: 54, fontSize: 16,
    padding: '0 18px', outline: 'none', fontFamily: 'inherit', color: COLORS.ink, display: 'block',
  };

  // One wooden cubby carries through both steps. On the email step it's a
  // quiet display (cups set in one by one, a paper name card underneath);
  // on the passcode step the same cubby becomes the keypad.
  const keypad = isLockScreen || authStep === 'passcode';
  const cubbyWidth = keypad ? 300 : 236;

  const cubby = (
    <div style={{ position: 'relative', width: '100%', maxWidth: cubbyWidth, alignSelf: 'center', transition: 'max-width .8s cubic-bezier(0.16,0.9,0.4,1)', filter: 'drop-shadow(0 14px 22px rgba(45,28,16,0.18))' }}>
      <img src={typeof CUBBY_IMG === 'string' ? CUBBY_IMG : CUBBY_IMG?.default} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
      <div style={{ position: 'absolute', top: '3.5%', left: '4%', right: '4%', bottom: '3%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: '3% 2.5%' }}>
        {KEYS.map((d, i) =>
          d === '' ? <span key={i} /> : d === 'del' ? (
            keypad ? (
              <button key={i} type="button" className="bk-fade" onClick={() => { playTap(); handleDelete(); }} aria-label="Delete"
                style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'inherit' }}>
                Delete
              </button>
            ) : <span key={i} />
          ) : (
            <button key={i} type="button" className="bk-key" aria-label={keypad ? d : undefined} aria-hidden={keypad ? undefined : true} tabIndex={keypad ? 0 : -1}
              onClick={() => { playClink(d); if (keypad) handleDigit(d); }}
              style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: '10% 10% 4%', position: 'relative', top: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transition: 'top .5s cubic-bezier(0.16,0.9,0.4,1)' }}>
              <span style={{ position: 'absolute', top: '8%', left: '10%', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.8)', opacity: keypad ? 1 : 0, transition: `opacity .6s ease ${keypad ? 0.25 + i * 0.03 : 0}s` }}>{d}</span>
              <img className="bk-set" src={keyCup(d)} alt=""
                style={{ width: '82%', height: '78%', objectFit: 'contain', objectPosition: 'bottom', filter: 'drop-shadow(0 3px 3px rgba(40,22,10,0.35))', animationDelay: `${0.25 + i * 0.07}s` }} />
            </button>
          )
        )}
      </div>
    </div>
  );

  const dots = (
    <div className="bk-fade" style={{ display: 'flex', gap: 14, justifyContent: 'center' }} aria-live="polite" aria-label={`${currentCode.length} of 6 digits`}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: 999,
          background: i < currentCode.length ? (error ? '#A0563F' : COLORS.ink) : 'transparent',
          boxShadow: `inset 0 0 0 1.5px ${error ? '#A0563F' : i < currentCode.length ? COLORS.ink : '#CFC6B8'}`,
          transition: 'background .25s ease, box-shadow .25s ease',
        }} />
      ))}
    </div>
  );

  // A little paper card under the cubby, like the label on a shelf.
  // Name and email: one white card, like the Settings groups. Rows split by a hairline.
  const nameCard = (
    <div className="bk-card" style={{ alignSelf: 'center', width: '100%', background: COLORS.sheet, borderRadius: 18, boxShadow: `inset 0 0 0 1px ${COLORS.hairline}`, overflow: 'hidden' }}>
      {isSetup && (
        <input className="auth-input" type="text" placeholder="Name" aria-label="Your name" value={name} autoComplete="given-name"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
          style={{ ...inputStyle, boxShadow: `inset 0 -1px 0 ${COLORS.hairline}` }} />
      )}
      <input className="auth-input" type="email" placeholder="Email" aria-label="Email" value={email} autoComplete="email"
        onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()} style={inputStyle} />
    </div>
  );

  return (
    <div className="bk-root bk-scroll" style={{ position: 'fixed', inset: 0, overflowY: 'auto', scrollbarWidth: 'none' as any }}>
      <style>{`.bk-key:active { top: 3px; transition-duration: .15s; }
        .auth-input::placeholder { color: #A89E92; }
        @keyframes bkSet { from { opacity: 0; transform: translateY(-14px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
        .bk-set { animation: bkSet .9s cubic-bezier(0.16,0.9,0.4,1) backwards; }
        @keyframes bkCard { from { opacity: 0; transform: translateY(8px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
        .bk-card { animation: bkCard .8s cubic-bezier(0.16,0.9,0.4,1) .9s backwards; }
        .bk-fade { animation: bkFade .6s ease .3s backwards; }
        @media (prefers-reduced-motion: reduce) { .bk-set, .bk-card, .bk-fade { animation: none; } }`}</style>
      <div style={{ maxWidth: 340, minHeight: '100%', margin: '0 auto', boxSizing: 'border-box', padding: `calc(${SAFE_TOP} + 12px) 24px calc(env(safe-area-inset-bottom, 0px) + 28px)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        <div className="bk-step" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <MoruLogo width={124} />
          <span key={statusText} className="bk-fade-in" style={{ fontSize: 15, color: COLORS.muted, minHeight: 20 }}>{statusText}</span>
          {error !== '' && <span key={error} className="bk-step" style={{ fontSize: 14, color: COLORS.rust }}>{error}</span>}
        </div>

        {keypad && dots}
        {keypad && isSetup && !isLockScreen && (
          <span key={isConfirming ? 'c' : 's'} className="bk-fade-in" style={{ fontSize: 13, color: COLORS.faint, textAlign: 'center', marginTop: -14 }}>
            {isConfirming ? 'Just to be sure you remember it' : 'Make one up. You\u2019ll use it to open Moru'}
          </span>
        )}
        {cubby}

        {!keypad && (
          <>
            {nameCard}
            <button type="button" className="bk-btn bk-fade" style={{ animationDelay: '1.1s' }} onClick={handleEmailSubmit}>Continue</button>
            {!checkingSetup && (
              <button type="button" style={{ ...linkStyle, alignSelf: 'center' }} onClick={() => {
                setIsSetup(!isSetup); setIsConfirming(false); setPasscode(''); setConfirmPasscode(''); setEmail(''); setName(''); setError('');
              }}>
                {isSetup ? 'Already have an account? Log in' : 'New here? Sign up'}
              </button>
            )}
          </>
        )}

        {keypad && !isLockScreen && (
          <button type="button" style={linkStyle} onClick={() => {
            setAuthStep('email'); setPasscode(''); setConfirmPasscode(''); setIsConfirming(false); setError('');
          }}>Back to email</button>
        )}
      </div>

      {submitting && (
        <div className="bk-scrim" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(243,240,234,0.7)', zIndex: 10 }}>
          <PotteryLoader message="Opening..." />
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
  const [showCheckin, setShowCheckin] = useState(false);

  // Opened from the payday notification (/?checkin=1): go straight to the check-in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkin') === '1') {
      setShowCheckin(true);
      params.delete('checkin');
      const rest = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
  }, []);

  // Register service worker for PWA functionality
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker();
    }
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
        return <Home onOpenCheckin={() => setShowCheckin(true)} onOpenQueue={() => setCurrentScreen('review')} onEditExpense={handleEditExpense} />;
      case 'settings':
        return (
          <Settings
            onAddBucket={() => setShowAddBucket(true)}
            onEditBucket={handleEditBucket}
            onSetIncome={() => setShowIncomeManagement(true)}
            onNavigateToReviewQueue={() => setCurrentScreen('review')}
          />
        );
      case 'review':
        return <ReviewQueue onBack={() => setCurrentScreen('settings')} />;
      default:
        return <Home onOpenCheckin={() => setShowCheckin(true)} onOpenQueue={() => setCurrentScreen('review')} onEditExpense={handleEditExpense} />;
    }
  };

  return (
    <ConvexProvider client={convexClient}>
    <MoruSplash />
    <AuthProvider>
    <AuthGate>
      <View style={styles.container}>
        <View style={styles.content}>{renderScreen()}</View>

        {/* iPhones with a Dynamic Island: tap the island to note a spend. */}
        {!showCheckin && !showAddExpense && <IslandNote />}

        {/* Bottom bar: Home, Settings, and + to log something by hand. */}
        {!showCheckin && (
          <Dock
            screen={currentScreen === 'buckets' ? 'home' : 'settings'}
            onScreen={(sc) => setCurrentScreen(sc === 'home' ? 'buckets' : 'settings')}
            onAdd={() => setShowAddExpense(true)}
            onCheckin={() => setShowCheckin(true)}
          />
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

        {showCheckin && <Checkin onClose={() => setShowCheckin(false)} />}
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
