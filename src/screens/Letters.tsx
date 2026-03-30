import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { PotteryLoader } from '../components/PotteryLoader';

interface LettersProps {
  onLetterSelected?: (isSelected: boolean) => void;
}

export const Letters: React.FC<LettersProps> = ({ onLetterSelected }) => {
  const [selectedLetter, setSelectedLetter] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { user: currentUser } = useAuth();

  const letters = useQuery(
    api.growthLetters.getAll,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  const generateLetter = useAction(api.growthLetters.generate);
  const markAsRead = useMutation(api.growthLetters.markAsRead);

  React.useEffect(() => {
    if (onLetterSelected) {
      onLetterSelected(selectedLetter !== null);
    }
  }, [selectedLetter, onLetterSelected]);

  const handleGenerate = async () => {
    if (!currentUser) return;
    setIsGenerating(true);
    try {
      await generateLetter({ userId: currentUser._id });
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      alert(`Failed to generate letter: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectLetter = (letter: any) => {
    if (!letter.isRead) {
      markAsRead({ letterId: letter._id });
    }
    setSelectedLetter(letter);
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <PotteryLoader message="Loading letters..." />
      </SafeAreaView>
    );
  }

  // ── Detail View ───────────────────────────────────────────────────────────
  if (selectedLetter) {
    const seasonColors = ['#5C8A7A', '#B8986A', '#8A8570', '#A0785C'];

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderTop}>
              <TouchableOpacity
                onPress={() => setSelectedLetter(null)}
                style={styles.backButtonContainer}
              >
                <ArrowLeft size={20} color={theme.colors.primary} strokeWidth={2} />
                <Text style={styles.backButton}>Back</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.letterHeaderContent}>
              <Text style={styles.letterTitle}>Your Story So Far</Text>
              <Text style={styles.letterDate}>
                {new Date(selectedLetter.createdAt).toLocaleDateString('en-SG', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {selectedLetter.promptsUsed > 0 && ` · from ${selectedLetter.promptsUsed} reflections`}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            {/* Letter content */}
            <Text style={styles.letterBody}>{selectedLetter.content}</Text>

            {/* Seasons */}
            {selectedLetter.seasons && selectedLetter.seasons.length > 0 && (
              <View style={styles.seasonsSection}>
                <Text style={styles.seasonsLabel}>SEASONS</Text>
                {selectedLetter.seasons.map((season: any, i: number) => (
                  <View key={i} style={styles.seasonRow}>
                    <View style={[styles.seasonDot, { backgroundColor: seasonColors[i % seasonColors.length] }]} />
                    <View style={styles.seasonContent}>
                      <Text style={styles.seasonName}>{season.name}</Text>
                      <Text style={styles.seasonSummary}>{season.summary}</Text>
                      <Text style={styles.seasonDates}>
                        {season.startMonth}{season.endMonth ? ` → ${season.endMonth}` : ' → now'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── List View ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Letters</Text>
      </View>

      {/* Generate Button */}
      <View style={styles.generateContainer}>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <div style={{
                width: 20, height: 20,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
              <Text style={styles.generateButtonText}>Writing...</Text>
            </>
          ) : (
            <>
              <Mail size={20} color={theme.colors.background} strokeWidth={2} />
              <Text style={styles.generateButtonText}>Generate Growth Letter</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listContent}>
          {!letters && <PotteryLoader />}

          {letters && letters.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>no letters yet</Text>
              <Text style={styles.emptyText}>
                tap generate to receive your first growth letter
              </Text>
            </View>
          )}

          {letters && letters.length > 0 && (
            <>
              {letters.map((letter: any) => {
                const seasonCount = letter.seasons?.length || 0;

                // ── Unread: sealed envelope ──
                if (!letter.isRead) {
                  return (
                    <Pressable
                      key={letter._id}
                      style={styles.sealedCard}
                      onPress={() => handleSelectLetter(letter)}
                    >
                      {/* Envelope flap — triangle at top */}
                      <View style={styles.envelopeFlap} />
                      <View style={styles.sealedContent}>
                        <Text style={styles.sealedTitle}>A letter for you</Text>
                        <Text style={styles.sealedDate}>
                          {new Date(letter.createdAt).toLocaleDateString('en-SG', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      {/* Wax seal — centered vertically, protruding right */}
                      <View style={styles.waxSealContainer}>
                        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                          {/* Irregular wax blob */}
                          <path d="M22 2c3 0 5.5 1.2 7.5 2.5 2.2 1.4 4.5 1.8 6.5 3.5 2 1.7 3.2 4 3.8 6.5.6 2.5.2 5-.2 7.5-.4 2.5-.2 5-1.5 7-1.3 2-3.5 3.2-5.5 4.5-2 1.3-3.8 3-6 3.8-2.2.8-4.8.7-7 .7s-4.8.1-7-.7c-2.2-.8-4-2.5-6-3.8-2-1.3-4.2-2.5-5.5-4.5-1.3-2-1.1-4.5-1.5-7-.4-2.5-.8-5-.2-7.5.6-2.5 1.8-4.8 3.8-6.5 2-1.7 4.3-2.1 6.5-3.5C12.5 3.2 15 2 18 2c1.3 0 2.7 0 4 0z"
                            fill="#8B3A3A" />
                          {/* Highlight */}
                          <ellipse cx="18" cy="16" rx="6" ry="4" fill="#A04848" opacity="0.6" />
                          {/* Stamp impression — B for Buckets */}
                          <text x="22" y="26" textAnchor="middle" fontSize="14" fontFamily="Merchant" fontWeight="700" fill="#5C1E1E" opacity="0.7">B</text>
                        </svg>
                      </View>
                    </Pressable>
                  );
                }

                // ── Read: open letter card ──
                return (
                  <Pressable
                    key={letter._id}
                    style={styles.letterCard}
                    onPress={() => handleSelectLetter(letter)}
                  >
                    <View style={styles.letterCardContent}>
                      <Text style={styles.letterCardMeta}>
                        {new Date(letter.createdAt).toLocaleDateString('en-SG', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.letterCardPreview} numberOfLines={2}>
                        {letter.content.slice(0, 120)}...
                      </Text>
                      <Text style={styles.letterCardMeta}>
                        {seasonCount > 0 && `${seasonCount} season${seasonCount > 1 ? 's' : ''} · `}
                        {`${letter.promptsUsed} reflections`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    maxHeight: '100vh' as any,
  },
  pageHeader: {
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    fontWeight: '500',
  },
  generateContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 12,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  generateButtonText: {
    fontSize: 18,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  detailScrollContent: {
    paddingBottom: 60,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Merchant',
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // ── Sealed Envelope (unread) ────────────────────────────────────────────
  sealedCard: {
    backgroundColor: '#E8DFD0',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D4C9B8',
    overflow: 'visible' as any,
    position: 'relative',
    minHeight: 80,
    justifyContent: 'center',
  },
  envelopeFlap: {
    position: 'absolute',
    top: -1,
    left: 16,
    right: 16,
    height: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 20,
    borderBottomColor: '#DDD4C4',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopWidth: 0,
    borderStyle: 'solid',
    // Trapezoid shape via border trick
  },
  sealedContent: {
    paddingRight: 30,
  },
  sealedTitle: {
    fontSize: 18,
    fontFamily: 'Merchant',
    fontStyle: 'italic',
    color: '#6B5E50',
    marginBottom: 4,
  },
  sealedDate: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: '#A09686',
  },
  waxSealContainer: {
    position: 'absolute',
    right: -12,
    top: '50%' as any,
    marginTop: -22,
    zIndex: 2,
  },

  // ── Letter Card (read) ────────────────────────────────────────────────
  letterCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  letterCardContent: {
    flex: 1,
  },
  letterCardPreview: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  letterCardMeta: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
  },

  // ── Detail View ─────────────────────────────────────────────────────────
  detailHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.primary,
  },
  letterHeaderContent: {
    gap: 4,
  },
  letterTitle: {
    fontSize: 26,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    fontWeight: '500',
  },
  letterDate: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
  },
  letterBody: {
    fontSize: 17,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    lineHeight: 28,
    marginBottom: 28,
    marginTop: 20,
  },

  // ── Seasons ─────────────────────────────────────────────────────────────
  seasonsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 20,
  },
  seasonsLabel: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  seasonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  seasonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  seasonContent: {
    flex: 1,
  },
  seasonName: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  seasonSummary: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 2,
  },
  seasonDates: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: theme.colors.textTertiary,
  },
});
