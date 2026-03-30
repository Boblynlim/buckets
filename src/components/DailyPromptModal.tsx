import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';

const getCategoryEmoji = (category: string) => {
  switch (category) {
    case 'goal': return '🎯';
    case 'preference': return '❤️';
    case 'reflection': return '🤔';
    case 'habit': return '🔄';
    case 'happiness': return '😊';
    default: return '💭';
  }
};

export const DailyPromptModal: React.FC = () => {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Inject note animations
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'cup-note-styles';
    style.textContent = `
      @keyframes noteSlideIn {
        0% { opacity: 0; transform: rotate(-2deg) translateY(-20px) scale(0.9); }
        60% { opacity: 1; transform: rotate(-2deg) translateY(4px) scale(1.01); }
        100% { opacity: 1; transform: rotate(-2deg) translateY(0) scale(1); }
      }
      @keyframes noteExpand {
        0% { transform: rotate(-2deg) scale(1); }
        100% { transform: rotate(-1deg) scale(1); }
      }
      @keyframes notePulse {
        0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
        50% { box-shadow: 0 4px 20px rgba(92,138,122,0.2); }
      }
      @keyframes noteDismiss {
        0% { opacity: 1; transform: rotate(-2deg) scale(1) translateY(0); }
        100% { opacity: 0; transform: rotate(-8deg) scale(0.8) translateY(-30px); }
      }
      .cup-note-input::placeholder { color: rgba(139,112,89,0.4); }
      .cup-note-input:focus { outline: none; border-color: #5C8A7A !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('cup-note-styles')?.remove(); };
  }, []);

  const { user: currentUser } = useAuth();

  const todayPrompt = useQuery(
    api.dailyPrompts.getTodayPrompt,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  const answerPrompt = useMutation(api.dailyPrompts.answerPrompt);
  const dismissPrompt = useMutation(api.dailyPrompts.dismissPrompt);
  const generatePrompt = useMutation(api.dailyPrompts.generateDailyPrompt);

  useEffect(() => {
    if (currentUser && todayPrompt === null) {
      generatePrompt({ userId: currentUser._id }).catch(err => {
        console.error('Failed to generate prompt:', err);
      });
    }
  }, [currentUser, todayPrompt, generatePrompt]);

  const handleSubmit = async () => {
    if (!todayPrompt || !answer.trim()) return;
    setIsSubmitting(true);
    try {
      await answerPrompt({ promptId: todayPrompt._id, answer: answer.trim() });
      setAnswer('');
      setDismissed(true);
    } catch (error: any) {
      console.error('Failed to answer prompt:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (!todayPrompt) return;
    setDismissed(true);
    setTimeout(async () => {
      try {
        await dismissPrompt({ promptId: todayPrompt._id });
      } catch (error) {
        console.error('Failed to dismiss prompt:', error);
      }
    }, 400);
  };

  if (!ready || !todayPrompt || todayPrompt.isAnswered || dismissed) {
    if (dismissed) {
      // Show dismiss animation briefly
      return (
        <div style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          right: 20,
          zIndex: 900,
          animation: 'noteDismiss 0.4s ease forwards',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: '#F5EDD8',
            borderRadius: 4,
            padding: 16,
            width: 56,
            height: 56,
          }} />
        </div>
      );
    }
    return null;
  }

  const emoji = getCategoryEmoji(todayPrompt.category);
  const question = todayPrompt.question;

  // Collapsed: small parchment note peeking out
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          right: 20,
          zIndex: 900,
          cursor: 'pointer',
          animation: 'noteSlideIn 0.5s ease both, notePulse 3s ease-in-out 1s infinite',
          transform: 'rotate(-2deg)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Tape strip */}
        <div style={{
          position: 'absolute',
          top: -6,
          left: 16,
          width: 40,
          height: 14,
          background: 'rgba(92,138,122,0.35)',
          borderRadius: 2,
          transform: 'rotate(3deg)',
          zIndex: 1,
        }} />

        <div style={{
          background: '#F5EDD8',
          borderRadius: 4,
          padding: '14px 16px 12px',
          width: 180,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          borderBottom: '2px solid rgba(0,0,0,0.04)',
          // Torn bottom edge
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), 97% 100%, 93% calc(100% - 3px), 88% 100%, 83% calc(100% - 2px), 78% 100%, 72% calc(100% - 4px), 67% 100%, 61% calc(100% - 2px), 55% 100%, 49% calc(100% - 3px), 43% 100%, 37% calc(100% - 2px), 30% 100%, 24% calc(100% - 4px), 18% 100%, 12% calc(100% - 2px), 6% 100%, 0 calc(100% - 3px))',
        }}>
          <div style={{
            fontFamily: 'Merchant Copy',
            fontSize: 13,
            color: '#8B7059',
            marginBottom: 6,
          }}>
            {emoji} daily question
          </div>
          <div style={{
            fontFamily: 'Merchant Copy',
            fontSize: 14,
            color: '#3D2E23',
            lineHeight: '18px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as any,
          }}>
            {question}
          </div>
        </div>
      </div>
    );
  }

  // Expanded: full note with input
  return (
    <div style={{
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 20px)',
      right: 16,
      zIndex: 900,
      animation: 'noteExpand 0.3s ease both',
      transform: 'rotate(-1deg)',
    }}>
      {/* Tape strip */}
      <div style={{
        position: 'absolute',
        top: -6,
        left: 20,
        width: 48,
        height: 14,
        background: 'rgba(92,138,122,0.35)',
        borderRadius: 2,
        transform: 'rotate(2deg)',
        zIndex: 1,
      }} />

      <div style={{
        background: '#F5EDD8',
        borderRadius: 6,
        padding: '18px 18px 14px',
        width: 280,
        maxWidth: 'calc(100vw - 40px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
        // Torn bottom edge
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), 97% 100%, 93% calc(100% - 3px), 88% 100%, 83% calc(100% - 2px), 78% 100%, 72% calc(100% - 5px), 67% 100%, 61% calc(100% - 2px), 55% 100%, 49% calc(100% - 4px), 43% 100%, 37% calc(100% - 2px), 30% 100%, 24% calc(100% - 5px), 18% 100%, 12% calc(100% - 2px), 6% 100%, 0 calc(100% - 4px))',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}>
          <span style={{
            fontFamily: 'Merchant Copy',
            fontSize: 12,
            color: '#8B7059',
            textTransform: 'uppercase' as const,
            letterSpacing: 1,
          }}>
            {emoji} daily question
          </span>
          <span
            onClick={handleDismiss}
            style={{
              fontFamily: 'Merchant',
              fontSize: 18,
              color: '#B5AFA5',
              cursor: 'pointer',
              lineHeight: '1',
              padding: '0 2px',
            }}
          >
            ×
          </span>
        </div>

        {/* Question */}
        <div style={{
          fontFamily: 'Merchant Copy',
          fontSize: 16,
          color: '#3D2E23',
          lineHeight: '22px',
          marginBottom: 14,
        }}>
          {question}
        </div>

        {/* Faint ruled lines behind textarea */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <textarea
            className="cup-note-input"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              // Auto-expand
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            placeholder="Write here..."
            rows={3}
            style={{
              width: '100%',
              minHeight: 66,
              maxHeight: 200,
              overflowY: 'auto' as const,
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(139,112,89,0.15)',
              borderRadius: 4,
              padding: '10px 12px',
              fontFamily: 'Merchant Copy',
              fontSize: 15,
              color: '#3D2E23',
              resize: 'none' as const,
              lineHeight: '22px',
              boxSizing: 'border-box' as const,
              // Ruled lines
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 21px, rgba(139,112,89,0.08) 21px, rgba(139,112,89,0.08) 22px)',
              backgroundPositionY: 9,
            }}
          />
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span
            onClick={handleDismiss}
            style={{
              fontFamily: 'Merchant',
              fontSize: 13,
              color: '#B5AFA5',
              cursor: 'pointer',
            }}
          >
            skip
          </span>
          <span
            onClick={(!answer.trim() || isSubmitting) ? undefined : handleSubmit}
            style={{
              fontFamily: 'Merchant',
              fontSize: 13,
              fontWeight: 600,
              color: (!answer.trim() || isSubmitting) ? '#B5AFA5' : '#5C8A7A',
              cursor: (!answer.trim() || isSubmitting) ? 'default' : 'pointer',
            }}
          >
            {isSubmitting ? 'saving...' : 'done ✓'}
          </span>
        </div>
      </div>
    </div>
  );
};
