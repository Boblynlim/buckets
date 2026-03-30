import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';

// ─── Shared: Letter Reading View ────────────────────────────────────────────

const LetterReadingView: React.FC<{
  letter: any;
  onClose: () => void;
  phase: 'reading' | 'closing';
}> = ({ letter, onClose, phase }) => {
  const seasonColors = [
    'rgba(92,138,122,0.12)',
    'rgba(184,152,106,0.12)',
    'rgba(138,133,112,0.12)',
    'rgba(168,120,92,0.12)',
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(61,50,41,0.4)',
        backdropFilter: 'blur(4px)',
        cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#F5EDD8',
          borderRadius: 8,
          padding: '32px 28px 28px',
          maxWidth: 380,
          width: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
          cursor: 'default',
          position: 'relative',
          animation: phase === 'closing'
            ? 'glCloseLetter 0.4s ease forwards'
            : 'glLetterExpand 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), 97% 100%, 93% calc(100% - 3px), 88% 100%, 83% calc(100% - 2px), 78% 100%, 72% calc(100% - 5px), 67% 100%, 61% calc(100% - 2px), 55% 100%, 49% calc(100% - 4px), 43% 100%, 37% calc(100% - 2px), 30% 100%, 24% calc(100% - 5px), 18% 100%, 12% calc(100% - 2px), 6% 100%, 0 calc(100% - 4px))',
        }}
      >
        {/* Tape */}
        <div style={{
          position: 'absolute',
          top: -6,
          left: '50%',
          marginLeft: -24,
          width: 48,
          height: 14,
          background: 'rgba(92,138,122,0.3)',
          borderRadius: 2,
          transform: 'rotate(1deg)',
        }} />

        {/* Header */}
        <div style={{
          fontFamily: 'Merchant',
          fontSize: 11,
          color: '#B5AFA5',
          textTransform: 'uppercase' as const,
          letterSpacing: 2,
          marginBottom: 6,
          animation: 'glFadeInText 0.5s ease 0.2s both',
        }}>
          your story so far
        </div>

        {/* Date */}
        <div style={{
          fontFamily: 'Merchant',
          fontSize: 11,
          color: '#C2BDB0',
          marginBottom: 20,
          animation: 'glFadeInText 0.5s ease 0.3s both',
        }}>
          {new Date(letter.createdAt).toLocaleDateString('en-SG', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          {letter.promptsUsed > 0 && ` · from ${letter.promptsUsed} reflections`}
        </div>

        {/* Letter content */}
        <div style={{
          fontFamily: 'Merchant',
          fontSize: 15,
          color: '#3D2E23',
          lineHeight: '24px',
          marginBottom: 24,
          animation: 'glFadeInText 0.6s ease 0.4s both',
          whiteSpace: 'pre-wrap' as const,
        }}>
          {letter.content}
        </div>

        {/* Seasons */}
        {letter.seasons && letter.seasons.length > 0 && (
          <div style={{
            borderTop: '1px solid rgba(139,112,89,0.12)',
            paddingTop: 16,
            animation: 'glFadeInText 0.6s ease 0.6s both',
          }}>
            <div style={{
              fontFamily: 'Merchant',
              fontSize: 10,
              color: '#B5AFA5',
              textTransform: 'uppercase' as const,
              letterSpacing: 2,
              marginBottom: 12,
            }}>
              seasons
            </div>

            {letter.seasons.map((season: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  marginBottom: 10,
                  animation: `glFadeInText 0.4s ease ${0.7 + i * 0.15}s both`,
                }}
              >
                <div style={{
                  width: 8,
                  minHeight: 8,
                  borderRadius: 4,
                  marginTop: 6,
                  background: seasonColors[i % seasonColors.length],
                  border: `2px solid ${['#5C8A7A', '#B8986A', '#8A8570', '#A0785C'][i % 4]}`,
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{
                    fontFamily: 'Merchant',
                    fontSize: 14,
                    color: '#3D2E23',
                    fontWeight: '500',
                  }}>
                    {season.name}
                  </div>
                  <div style={{
                    fontFamily: 'Merchant',
                    fontSize: 12,
                    color: '#8B7059',
                    lineHeight: '18px',
                    marginTop: 2,
                  }}>
                    {season.summary}
                  </div>
                  <div style={{
                    fontFamily: 'Merchant',
                    fontSize: 10,
                    color: '#C2BDB0',
                    marginTop: 2,
                  }}>
                    {season.startMonth}{season.endMonth ? ` → ${season.endMonth}` : ' → now'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Close hint */}
        <div style={{
          textAlign: 'center' as const,
          marginTop: 20,
          fontFamily: 'Merchant',
          fontSize: 11,
          color: '#C2BDB0',
          animation: 'glFadeInText 0.5s ease 1s both',
        }}>
          tap outside to close
        </div>
      </div>
    </div>
  );
};

// ─── Overlay: "You've got mail" notification ────────────────────────────────

export const GrowthLetterOverlay: React.FC = () => {
  const [phase, setPhase] = useState<'hidden' | 'envelope' | 'reading' | 'closing' | 'dismissed'>('hidden');
  const [ready, setReady] = useState(false);

  const { user: currentUser } = useAuth();

  const hasUnread = useQuery(
    api.growthLetters.hasUnread,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  const letter = useQuery(
    api.growthLetters.getLatest,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  const markAsRead = useMutation(api.growthLetters.markAsRead);

  // Inject animations
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'growth-letter-styles';
    style.textContent = `
      @keyframes glEnvelopeSlideIn {
        0% { opacity: 0; transform: translateY(20px) rotate(2deg) scale(0.9); }
        60% { opacity: 1; transform: translateY(-4px) rotate(2deg) scale(1.02); }
        100% { opacity: 1; transform: translateY(0) rotate(2deg) scale(1); }
      }
      @keyframes glEnvelopeFloat {
        0%, 100% { transform: translateY(0) rotate(2deg); }
        50% { transform: translateY(-3px) rotate(2deg); }
      }
      @keyframes glEnvelopeGlow {
        0%, 100% { box-shadow: 0 4px 16px rgba(92,138,122,0.15); }
        50% { box-shadow: 0 4px 24px rgba(92,138,122,0.3); }
      }
      @keyframes glEnvelopeDismiss {
        0% { opacity: 1; transform: rotate(2deg) scale(1) translateY(0); }
        100% { opacity: 0; transform: rotate(8deg) scale(0.7) translateY(20px); }
      }
      @keyframes glLetterExpand {
        0% { transform: scale(0.7) translateY(0); opacity: 0.9; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes glCloseLetter {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(0.8) translateY(40px); opacity: 0; }
      }
      @keyframes glFadeInText {
        0% { opacity: 0; transform: translateY(8px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes glSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    if (!document.getElementById('growth-letter-styles')) {
      document.head.appendChild(style);
    }
    return () => { document.getElementById('growth-letter-styles')?.remove(); };
  }, []);

  // Show envelope after a delay when there's an unread letter
  useEffect(() => {
    if (hasUnread && letter && !letter.isRead && phase === 'hidden') {
      // Random delay between 5-15 seconds for the surprise feel
      const delay = 5000 + Math.random() * 10000;
      const timer = setTimeout(() => {
        setPhase('envelope');
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [hasUnread, letter, phase]);

  const handleOpenEnvelope = () => {
    if (!letter) return;
    if (!letter.isRead) {
      markAsRead({ letterId: letter._id });
    }
    setPhase('reading');
  };

  const handleClose = () => {
    setPhase('closing');
    setTimeout(() => setPhase('dismissed'), 400);
  };

  const handleDismissEnvelope = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhase('dismissed');
  };

  if (!currentUser || phase === 'hidden') return null;

  // Dismissed animation
  if (phase === 'dismissed') {
    return null;
  }

  // Reading the letter
  if (phase === 'reading' || phase === 'closing') {
    if (!letter) return null;
    return <LetterReadingView letter={letter} onClose={handleClose} phase={phase} />;
  }

  // Envelope notification — bottom-left, like a piece of mail that just arrived
  return (
    <div
      onClick={handleOpenEnvelope}
      style={{
        position: 'fixed',
        bottom: 90,
        left: 16,
        zIndex: 5000,
        cursor: 'pointer',
        animation: 'glEnvelopeSlideIn 0.6s ease both, glEnvelopeFloat 3s ease-in-out 1s infinite',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Envelope body */}
      <div style={{
        background: 'linear-gradient(135deg, #F5EDD8 0%, #EDE4D0 100%)',
        borderRadius: 8,
        padding: '14px 16px 12px',
        width: 200,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        border: '1px solid rgba(139,112,89,0.12)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'glEnvelopeGlow 3s ease-in-out 1s infinite',
      }}>
        {/* Flap triangle */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 28,
          background: 'linear-gradient(180deg, rgba(92,138,122,0.06) 0%, transparent 100%)',
          clipPath: 'polygon(0 0, 50% 24px, 100% 0)',
        }} />

        {/* Wax seal */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          marginLeft: -10,
          width: 20,
          height: 20,
          borderRadius: 10,
          background: 'radial-gradient(circle at 40% 40%, #7DA99A, #5C8A7A)',
          boxShadow: '0 2px 6px rgba(92,138,122,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          <span style={{ fontSize: 10, lineHeight: 1 }}>☕</span>
        </div>

        {/* Content */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontFamily: 'Merchant',
            fontSize: 10,
            color: '#B5AFA5',
            textTransform: 'uppercase' as const,
            letterSpacing: 1.5,
            marginBottom: 4,
          }}>
            you've got mail
          </div>
          <div style={{
            fontFamily: 'Merchant',
            fontSize: 13,
            color: '#3D2E23',
            lineHeight: '18px',
          }}>
            a letter about your journey
          </div>
          <div style={{
            fontFamily: 'Merchant',
            fontSize: 11,
            color: '#5C8A7A',
            marginTop: 6,
            fontWeight: '500',
          }}>
            open ↗
          </div>
        </div>

        {/* Dismiss X */}
        <div
          onClick={handleDismissEnvelope}
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            fontFamily: 'Merchant',
            fontSize: 14,
            color: '#C2BDB0',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '2px 4px',
            zIndex: 2,
          }}
        >
          ×
        </div>
      </div>

      {/* Unread dot */}
      <div style={{
        position: 'absolute',
        top: -3,
        right: -3,
        width: 10,
        height: 10,
        borderRadius: 5,
        background: '#5C8A7A',
        border: '2px solid #EAE3D5',
      }} />
    </div>
  );
};

// ─── Settings Section: Matches groupCard/groupRow pattern from Settings ─────

export const GrowthLetterSettings: React.FC = () => {
  const [phase, setPhase] = useState<'idle' | 'reading' | 'closing'>('idle');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const { user: currentUser } = useAuth();

  const letter = useQuery(
    api.growthLetters.getLatest,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  const markAsRead = useMutation(api.growthLetters.markAsRead);
  const generateLetter = useAction(api.growthLetters.generate);

  // Inject animations (same stylesheet, won't duplicate)
  useEffect(() => {
    if (document.getElementById('growth-letter-styles')) return;
    const style = document.createElement('style');
    style.id = 'growth-letter-styles';
    style.textContent = `
      @keyframes glLetterExpand {
        0% { transform: scale(0.7) translateY(0); opacity: 0.9; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes glCloseLetter {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(0.8) translateY(40px); opacity: 0; }
      }
      @keyframes glFadeInText {
        0% { opacity: 0; transform: translateY(8px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes glSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const handleOpen = () => {
    if (!letter) return;
    if (!letter.isRead) {
      markAsRead({ letterId: letter._id });
    }
    setPhase('reading');
  };

  const handleClose = () => {
    setPhase('closing');
    setTimeout(() => setPhase('idle'), 400);
  };

  const handleGenerate = async () => {
    if (!currentUser) return;
    setGenerating(true);
    setError('');
    try {
      await generateLetter({ userId: currentUser._id });
    } catch (e: any) {
      setError(e.message || 'Failed to generate letter');
    } finally {
      setGenerating(false);
    }
  };

  if (!currentUser) return null;

  const dateStr = letter
    ? new Date(letter.createdAt).toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const seasonCount = letter?.seasons?.length || 0;

  return (
    <>
      {/* Reading overlay */}
      {(phase === 'reading' || phase === 'closing') && letter && (
        <LetterReadingView letter={letter} onClose={handleClose} phase={phase} />
      )}

      {/* Section: matches Settings page structure */}
      <View style={settingsStyles.section}>
        <View style={settingsStyles.sectionHeaderRow}>
          <Text style={settingsStyles.sectionHeader}>GROWTH LETTERS</Text>
          {letter && !generating && (
            <TouchableOpacity onPress={handleGenerate}>
              <Text style={settingsStyles.headerAction}>Generate New</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={settingsStyles.groupCard}>
          {letter ? (
            <Pressable
              style={settingsStyles.groupRow}
              onPress={handleOpen}
            >
              <View style={{ flex: 1 }}>
                <Text style={settingsStyles.groupRowTitle}>Your Story So Far</Text>
                <Text style={settingsStyles.groupRowSub} numberOfLines={2}>
                  {letter.content.slice(0, 100)}...
                </Text>
                <Text style={settingsStyles.groupRowMeta}>
                  {dateStr}
                  {seasonCount > 0 && ` · ${seasonCount} season${seasonCount > 1 ? 's' : ''}`}
                  {` · ${letter.promptsUsed} reflections`}
                </Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>
          ) : (
            <Pressable
              style={settingsStyles.groupRow}
              onPress={generating ? undefined : handleGenerate}
            >
              <View style={{ flex: 1 }}>
                <Text style={settingsStyles.groupRowTitle}>
                  {generating ? 'Writing your letter...' : 'Growth Letter'}
                </Text>
                <Text style={settingsStyles.groupRowSub}>
                  {generating
                    ? 'This may take a moment'
                    : 'A personal reflection on your financial journey'}
                </Text>
              </View>
              {generating ? (
                <View style={settingsStyles.spinner} />
              ) : (
                <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
              )}
            </Pressable>
          )}
        </View>

        {error ? (
          <Text style={settingsStyles.errorText}>{error}</Text>
        ) : null}
      </View>
    </>
  );
};

const settingsStyles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '500',
    color: '#7A6E62',
    fontFamily: 'Merchant',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  headerAction: {
    fontSize: 15,
    color: '#5C8A7A',
    fontWeight: '500',
    fontFamily: 'Merchant',
    lineHeight: 15,
  },
  groupCard: {
    backgroundColor: '#F5F0E7',
    borderRadius: 20,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    cursor: 'pointer' as any,
  },
  groupRowTitle: {
    fontSize: 18,
    color: '#3D3229',
    fontFamily: 'Merchant',
  },
  groupRowSub: {
    fontSize: 15,
    color: '#7A6E62',
    fontFamily: 'Merchant',
    marginTop: 2,
  },
  groupRowMeta: {
    fontSize: 13,
    color: '#A89E92',
    fontFamily: 'Merchant',
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#B85C4A',
    fontFamily: 'Merchant',
    marginTop: 8,
    marginHorizontal: 20,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(92,138,122,0.3)',
    borderTopColor: '#5C8A7A',
  },
});
