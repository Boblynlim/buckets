import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../theme';
import { FileText, TrendingUp, ArrowLeft, Trash2, Fingerprint, ArrowUpRight, ThumbsUp, Lightbulb, MessageCircle } from 'lucide-react-native';
import type { Report } from '../types';
import { SwipeableReport } from '../components/SwipeableReport';
import { PotteryLoader } from '../components/PotteryLoader';

interface ReportsProps {
  onReportSelected?: (isSelected: boolean) => void;
}

export const Reports: React.FC<ReportsProps> = ({ onReportSelected }) => {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { user: currentUser } = useAuth();

  const reports = useQuery(
    api.reports.getByUser,
    currentUser ? { userId: currentUser._id, reportType: 'monthly' } : 'skip',
  );

  const generateReport = useAction(api.reportsNew.generateMonthlyReport);
  const deleteReport = useMutation(api.reports.remove);

  React.useEffect(() => {
    if (onReportSelected) {
      onReportSelected(selectedReport !== null);
    }
  }, [selectedReport, onReportSelected]);

  const handleGenerateReport = async () => {
    if (!currentUser) return;

    setIsGenerating(true);
    try {
      await generateReport({ userId: currentUser._id });
      alert('Monthly report generated!');
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      const msg = error?.message || 'Unknown error';
      const clean = msg.includes('invalid x-api-key') || msg.includes('authentication_error')
        ? 'AI service key is expired or invalid.'
        : msg.includes('Uncaught Error:')
        ? msg.split('Uncaught Error:').pop()!.split('\n')[0].trim()
        : msg;
      alert(`Failed to generate report: ${clean}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteReport = async (report: Report) => {
    try {
      await deleteReport({ reportId: report._id as any });
      if (selectedReport?._id === report._id) {
        setSelectedReport(null);
      }
    } catch (error: any) {
      console.error('Failed to delete report:', error);
      Alert.alert('Error', 'Failed to delete report');
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <PotteryLoader message="Loading reports..." />
      </SafeAreaView>
    );
  }

  // ── Detail View ───────────────────────────────────────────────────────────
  if (selectedReport) {
    // Parse worthItIntelligence from goalPulse (reused schema field)
    const worthIt = selectedReport.goalPulse as {
      worthItPercent?: number;
      notWorthItTotal?: number;
      topNotWorthItCategories?: string[];
      insight?: string;
    } | undefined;

    // Shifts from patternsAndFlags.trends
    const shifts = selectedReport.patternsAndFlags?.trends || [];

    // Nudges from wins (reused schema field)
    const nudges = selectedReport.wins || [];

    // One thing from reflectionPrompts[0]
    const oneThing = selectedReport.reflectionPrompts?.[0] || '';

    // Lifestyle fingerprint from vibeCheck
    const fingerprint = selectedReport.vibeCheck || '';

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
                onPress={() => setSelectedReport(null)}
                style={styles.backButtonContainer}
              >
                <ArrowLeft size={20} color={theme.colors.primary} strokeWidth={2} />
                <Text style={styles.backButton}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web') {
                    if (window.confirm('Delete this report?')) {
                      handleDeleteReport(selectedReport);
                    }
                  } else {
                    Alert.alert('Delete Report', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteReport(selectedReport) },
                    ]);
                  }
                }}
                style={styles.deleteButton}
              >
                <Trash2 size={18} color="#8E8E93" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.reportHeaderContent}>
              <Text style={styles.reportTitle}>Monthly Report</Text>
              <Text style={styles.reportDate}>
                {new Date(selectedReport.periodStart).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            {/* Lifestyle Fingerprint */}
            {fingerprint ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Fingerprint size={20} color="#245045" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Lifestyle Fingerprint</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardBody}>{fingerprint}</Text>
                </View>
              </View>
            ) : null}

            {/* Worth-It Intelligence */}
            {worthIt && worthIt.worthItPercent !== undefined ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThumbsUp size={20} color="#245045" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Worth-It Intelligence</Text>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{worthIt.worthItPercent}%</Text>
                    <Text style={styles.statLabel}>worth it</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#c9a882' }]}>
                      ${worthIt.notWorthItTotal?.toFixed(0)}
                    </Text>
                    <Text style={styles.statLabel}>regret spend</Text>
                  </View>
                </View>

                {/* Top not-worth-it categories */}
                {worthIt.topNotWorthItCategories && worthIt.topNotWorthItCategories.length > 0 && (
                  <View style={styles.tagRow}>
                    {worthIt.topNotWorthItCategories.map((cat, i) => (
                      <View key={i} style={styles.notWorthItTag}>
                        <Text style={styles.notWorthItTagText}>{cat}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* AI insight */}
                {worthIt.insight ? (
                  <View style={[styles.card, { marginTop: 12 }]}>
                    <Text style={styles.cardBody}>{worthIt.insight}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Shifts */}
            {shifts.length > 0 && shifts[0] !== 'Not enough months of data to detect shifts yet.' ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <TrendingUp size={20} color="#245045" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Shifts</Text>
                </View>
                <View style={styles.card}>
                  {shifts.map((shift, i) => (
                    <View key={i} style={styles.bulletItem}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{shift}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Nudges */}
            {nudges.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Lightbulb size={20} color="#245045" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Nudges</Text>
                </View>
                <View style={styles.card}>
                  {nudges.map((nudge, i) => (
                    <View key={i} style={styles.bulletItem}>
                      <ArrowUpRight size={14} color="#8ac0ae" strokeWidth={2.5} style={{ marginTop: 3 }} />
                      <Text style={styles.bulletText}>{nudge}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* One Thing */}
            {oneThing ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MessageCircle size={20} color="#245045" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>One Thing</Text>
                </View>
                <View style={styles.oneThingCard}>
                  <Text style={styles.oneThingText}>{oneThing}</Text>
                </View>
              </View>
            ) : null}

            {/* Bucket Health section removed — not useful since almost all show as low */}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── List View ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Reports</Text>
      </View>
      {/* Generate Button */}
      <View style={styles.generateContainer}>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateReport}
          disabled={isGenerating}>
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
              <Text style={styles.generateButtonText}>Generating...</Text>
            </>
          ) : (
            <>
              <FileText size={20} color={theme.colors.background} strokeWidth={2} />
              <Text style={styles.generateButtonText}>
                Generate Monthly Report
              </Text>
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
          {!reports && (
            <PotteryLoader />
          )}

          {reports && reports.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>no reports yet</Text>
              <Text style={styles.emptyText}>
                tap generate to see your first month unfold
              </Text>
            </View>
          )}

          {reports && reports.length > 0 && (
            <>
              {reports.map((report) => (
                <SwipeableReport
                  key={report._id}
                  report={report}
                  onPress={() => setSelectedReport(report)}
                  onDelete={() => handleDeleteReport(report)}
                />
              ))}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    marginBottom: 20,
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: '500',
    color: theme.colors.text,
    fontFamily: 'Merchant',
    letterSpacing: -1.2,
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

  // ── Detail Header ───────────────────────────────────────────────────────
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
    fontWeight: '500',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportHeaderContent: {
    gap: 4,
  },
  reportTitle: {
    fontSize: 26,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: theme.colors.text,
    letterSpacing: -0.8,
  },
  reportDate: {
    fontSize: 17,
    fontFamily: 'Merchant Copy',
    color: theme.colors.textSecondary,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardBody: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: theme.colors.text,
    lineHeight: 24,
  },

  // ── Stats Row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'Merchant Copy',
    color: '#8ac0ae',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Tags ──────────────────────────────────────────────────────────────────
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  notWorthItTag: {
    backgroundColor: 'rgba(212,184,154,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,168,130,0.3)',
  },
  notWorthItTagText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#a08060',
  },

  // ── Bullets ───────────────────────────────────────────────────────────────
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8ac0ae',
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: theme.colors.text,
    lineHeight: 24,
  },

  // ── One Thing ─────────────────────────────────────────────────────────────
  oneThingCard: {
    backgroundColor: 'rgba(160,208,192,0.12)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(138,192,174,0.25)',
  },
  oneThingText: {
    fontSize: 20,
    fontFamily: 'Merchant',
    color: '#245045',
    lineHeight: 28,
    fontStyle: 'italic',
  },
});
