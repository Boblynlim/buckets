import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import { FileText, TrendingUp, Calendar, ChevronRight } from 'lucide-react-native';
import type { Report } from '../types';

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser);

  // Get reports
  const reports = useQuery(
    api.reports.getByUser,
    currentUser ? { userId: currentUser._id, reportType: activeTab } : 'skip',
  );

  // Generate report mutation
  const generateWeekly = useMutation(api.reports.generateWeeklyReport);
  const generateMonthly = useMutation(api.reports.generateMonthlyReport);

  const handleGenerateReport = async () => {
    if (!currentUser) return;

    setIsGenerating(true);
    try {
      if (activeTab === 'weekly') {
        await generateWeekly({ userId: currentUser._id });
      } else {
        await generateMonthly({ userId: currentUser._id });
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If a report is selected, show detail view
  if (selectedReport) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedReport(null)}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.reportTitle}>
              {selectedReport.reportType === 'weekly' ? 'Weekly' : 'Monthly'} Report
            </Text>
            <Text style={styles.reportDate}>
              {new Date(selectedReport.periodStart).toLocaleDateString()} -{' '}
              {new Date(selectedReport.periodEnd).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.content}>
            {/* Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.summaryText}>{selectedReport.summary}</Text>
            </View>

            {/* Wins */}
            {selectedReport.wins.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎉 Wins</Text>
                {selectedReport.wins.map((win, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.listItemText}>{win}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Concerns */}
            {selectedReport.concerns.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚠️ Concerns</Text>
                {selectedReport.concerns.map((concern, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.listItemText}>{concern}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Spending Analysis */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Spending Breakdown</Text>
              <View style={styles.card}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Spent</Text>
                  <Text style={styles.statValueLarge}>
                    ${selectedReport.spendingAnalysis.totalSpent.toFixed(2)}
                  </Text>
                </View>

                {selectedReport.spendingAnalysis.comparisonToPrevious && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>vs Previous Period</Text>
                    <Text
                      style={[
                        styles.statValue,
                        {
                          color:
                            selectedReport.spendingAnalysis.comparisonToPrevious.change > 0
                              ? theme.colors.error
                              : theme.colors.success,
                        },
                      ]}>
                      {selectedReport.spendingAnalysis.comparisonToPrevious.change > 0 ? '+' : ''}
                      {selectedReport.spendingAnalysis.comparisonToPrevious.percentChange.toFixed(1)}%
                    </Text>
                  </View>
                )}

                <Text style={styles.subsectionTitle}>Top Categories</Text>
                {selectedReport.spendingAnalysis.topCategories.slice(0, 5).map((cat, index) => (
                  <View key={index} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{cat.category}</Text>
                    <View style={styles.categoryStats}>
                      <Text style={styles.categoryPercent}>{cat.percentOfTotal.toFixed(0)}%</Text>
                      <Text style={styles.categoryAmount}>${cat.amount.toFixed(2)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Happiness Analysis */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Happiness Analysis</Text>
              <View style={styles.card}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Average Happiness</Text>
                  <Text style={styles.statValueLarge}>
                    {selectedReport.happinessAnalysis.averageHappiness.toFixed(1)}/5
                  </Text>
                </View>

                {selectedReport.happinessAnalysis.topHappyCategories.length > 0 && (
                  <>
                    <Text style={styles.subsectionTitle}>Top Joy Categories</Text>
                    {selectedReport.happinessAnalysis.topHappyCategories.map((cat, index) => (
                      <View key={index} style={styles.categoryRow}>
                        <Text style={styles.categoryName}>{cat.category}</Text>
                        <Text style={styles.categoryAmount}>
                          {cat.avgHappiness.toFixed(1)}/5 · {cat.roi.toFixed(3)} joy/$
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>

            {/* Bucket Performance */}
            {selectedReport.bucketPerformance.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bucket Performance</Text>
                {selectedReport.bucketPerformance.map((bucket, index) => (
                  <View key={index} style={styles.bucketCard}>
                    <View style={styles.bucketHeader}>
                      <Text style={styles.bucketName}>{bucket.bucketName}</Text>
                      <Text
                        style={[
                          styles.bucketStatus,
                          {
                            color:
                              bucket.status === 'on-track'
                                ? theme.colors.success
                                : bucket.status === 'over-budget'
                                ? theme.colors.error
                                : theme.colors.textSecondary,
                          },
                        ]}>
                        {bucket.status}
                      </Text>
                    </View>
                    <View style={styles.bucketStats}>
                      <Text style={styles.bucketStat}>
                        Planned: ${bucket.planned.toFixed(2)}
                      </Text>
                      <Text style={styles.bucketStat}>
                        Funded: ${bucket.funded.toFixed(2)}
                      </Text>
                      <Text style={styles.bucketStat}>
                        Spent: ${bucket.spent.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Insights */}
            {selectedReport.insights.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💡 Insights</Text>
                {selectedReport.insights.map((insight, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.listItemText}>{insight}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {selectedReport.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 Recommendations</Text>
                {selectedReport.recommendations.map((rec, index) => (
                  <View key={index} style={styles.listItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.listItemText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List view
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Reports</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'weekly' && styles.tabActive]}
          onPress={() => setActiveTab('weekly')}>
          <Calendar size={18} color={activeTab === 'weekly' ? theme.colors.primary : theme.colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
            Weekly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'monthly' && styles.tabActive]}
          onPress={() => setActiveTab('monthly')}>
          <TrendingUp size={18} color={activeTab === 'monthly' ? theme.colors.primary : theme.colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.tabText, activeTab === 'monthly' && styles.tabTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
      </View>

      {/* Generate Button */}
      <View style={styles.generateContainer}>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateReport}
          disabled={isGenerating}>
          {isGenerating ? (
            <ActivityIndicator color={theme.colors.background} />
          ) : (
            <>
              <FileText size={20} color={theme.colors.background} strokeWidth={2} />
              <Text style={styles.generateButtonText}>
                Generate {activeTab === 'weekly' ? 'Weekly' : 'Monthly'} Report
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {!reports && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}

          {reports && reports.length === 0 && (
            <View style={styles.emptyState}>
              <FileText size={64} color={theme.colors.textSecondary} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                No {activeTab} reports yet. Generate your first report to see insights!
              </Text>
            </View>
          )}

          {reports && reports.length > 0 && (
            <>
              {reports.map((report) => (
                <TouchableOpacity
                  key={report._id}
                  style={styles.reportCard}
                  onPress={() => setSelectedReport(report)}>
                  <View style={styles.reportCardHeader}>
                    <Text style={styles.reportCardTitle}>
                      {new Date(report.periodStart).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      -{' '}
                      {new Date(report.periodEnd).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <ChevronRight size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  </View>

                  <Text style={styles.reportCardSummary} numberOfLines={2}>
                    {report.summary}
                  </Text>

                  <View style={styles.reportCardStats}>
                    <View style={styles.reportCardStat}>
                      <Text style={styles.reportCardStatLabel}>Spent</Text>
                      <Text style={styles.reportCardStatValue}>
                        ${report.spendingAnalysis.totalSpent.toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.reportCardStat}>
                      <Text style={styles.reportCardStatLabel}>Happiness</Text>
                      <Text style={styles.reportCardStatValue}>
                        {report.happinessAnalysis.averageHappiness.toFixed(1)}/5
                      </Text>
                    </View>
                    <View style={styles.reportCardStat}>
                      <Text style={styles.reportCardStatLabel}>Insights</Text>
                      <Text style={styles.reportCardStatValue}>
                        {report.insights.length}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    letterSpacing: -1.2,
  },
  backButton: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.primary,
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 32,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.backgroundLight,
  },
  tabActive: {
    backgroundColor: theme.colors.purple100,
  },
  tabText: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
  },
  generateContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
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
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    marginTop: 16,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  reportCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportCardTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  reportCardSummary: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  reportCardStats: {
    flexDirection: 'row',
    gap: 20,
  },
  reportCardStat: {
    flex: 1,
  },
  reportCardStatLabel: {
    fontSize: 12,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  reportCardStatValue: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    lineHeight: 24,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 15,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  statValueLarge: {
    fontSize: 24,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.primary,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryName: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    flex: 1,
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryPercent: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
    minWidth: 40,
    textAlign: 'right',
  },
  categoryAmount: {
    fontSize: 14,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
    minWidth: 80,
    textAlign: 'right',
  },
  bucketCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bucketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bucketName: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  bucketStatus: {
    fontSize: 13,
    fontFamily: getFontFamily('bold'),
    textTransform: 'capitalize',
  },
  bucketStats: {
    flexDirection: 'row',
    gap: 16,
  },
  bucketStat: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingRight: 20,
  },
  bulletPoint: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
    marginRight: 12,
    marginTop: 2,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    lineHeight: 22,
  },
});
