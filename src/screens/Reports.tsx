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
import { FileText, TrendingUp, Calendar, ChevronRight, ArrowLeft, TrendingDown, Sparkles, AlertCircle, Target, Award } from 'lucide-react-native';
import type { Report } from '../types';

interface ReportsProps {
  onReportSelected?: (isSelected: boolean) => void;
}

export const Reports: React.FC<ReportsProps> = ({ onReportSelected }) => {
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

  // Notify parent when report selection changes
  React.useEffect(() => {
    if (onReportSelected) {
      onReportSelected(selectedReport !== null);
    }
  }, [selectedReport, onReportSelected]);

  const handleGenerateReport = async () => {
    if (!currentUser) return;

    setIsGenerating(true);
    try {
      if (activeTab === 'weekly') {
        await generateWeekly({ userId: currentUser._id });
        alert(`Weekly report generated successfully!`);
      } else {
        await generateMonthly({ userId: currentUser._id });
        alert(`Monthly report generated successfully!`);
      }
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      alert(`Failed to generate report: ${error.message || 'Unknown error'}. Check console for details.`);
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity
              onPress={() => setSelectedReport(null)}
              style={styles.backButtonContainer}
            >
              <ArrowLeft size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={styles.backButton}>Back</Text>
            </TouchableOpacity>

            <View style={styles.reportHeaderContent}>
              <Text style={styles.reportTitle}>
                {selectedReport.reportType === 'weekly' ? 'Weekly' : 'Monthly'} Report
              </Text>
              <Text style={styles.reportDate}>
                {new Date(selectedReport.periodStart).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })} - {new Date(selectedReport.periodEnd).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            {/* Summary Hero Section */}
            <View style={styles.summaryHero}>
              <View style={styles.summaryIconContainer}>
                <FileText size={24} color="#4747FF" strokeWidth={2} />
              </View>
              <Text style={styles.summaryText}>{selectedReport.summary}</Text>
            </View>

            {/* Key Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <View style={styles.metricIconContainer}>
                  <TrendingUp size={20} color="#4747FF" strokeWidth={2} />
                </View>
                <Text style={styles.metricValue}>
                  ${selectedReport.spendingAnalysis.totalSpent.toFixed(0)}
                </Text>
                <Text style={styles.metricLabel}>Total Spent</Text>
                {selectedReport.spendingAnalysis.comparisonToPrevious && (
                  <View style={[
                    styles.metricBadge,
                    {
                      backgroundColor: selectedReport.spendingAnalysis.comparisonToPrevious.change > 0
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(34, 197, 94, 0.1)',
                    }
                  ]}>
                    <Text style={[
                      styles.metricBadgeText,
                      {
                        color: selectedReport.spendingAnalysis.comparisonToPrevious.change > 0
                          ? '#EF4444'
                          : '#22C55E',
                      }
                    ]}>
                      {selectedReport.spendingAnalysis.comparisonToPrevious.change > 0 ? '+' : ''}
                      {selectedReport.spendingAnalysis.comparisonToPrevious.percentChange.toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricIconContainer}>
                  <Sparkles size={20} color="#4747FF" strokeWidth={2} />
                </View>
                <Text style={styles.metricValue}>
                  {selectedReport.happinessAnalysis.averageHappiness.toFixed(1)}
                </Text>
                <Text style={styles.metricLabel}>Happiness</Text>
                <View style={styles.happinessStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <View
                      key={star}
                      style={[
                        styles.star,
                        star <= Math.round(selectedReport.happinessAnalysis.averageHappiness) && styles.starFilled
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Wins & Concerns */}
            {(selectedReport.wins.length > 0 || selectedReport.concerns.length > 0) && (
              <View style={styles.section}>
                {selectedReport.wins.length > 0 && (
                  <View style={styles.winsCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.iconBadgeSuccess}>
                          <Award size={18} color="#22C55E" strokeWidth={2} />
                        </View>
                        <Text style={styles.cardHeaderTitle}>Wins</Text>
                      </View>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{selectedReport.wins.length}</Text>
                      </View>
                    </View>
                    <View style={styles.cardContent}>
                      {selectedReport.wins.map((win, index) => (
                        <View key={index} style={styles.listItemModern}>
                          <View style={styles.listItemDot} />
                          <Text style={styles.listItemTextModern}>{win}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {selectedReport.concerns.length > 0 && (
                  <View style={styles.concernsCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.iconBadgeWarning}>
                          <AlertCircle size={18} color="#F59E0B" strokeWidth={2} />
                        </View>
                        <Text style={styles.cardHeaderTitle}>Concerns</Text>
                      </View>
                      <View style={[styles.badge, styles.badgeWarning]}>
                        <Text style={styles.badgeTextWarning}>{selectedReport.concerns.length}</Text>
                      </View>
                    </View>
                    <View style={styles.cardContent}>
                      {selectedReport.concerns.map((concern, index) => (
                        <View key={index} style={styles.listItemModern}>
                          <View style={[styles.listItemDot, styles.listItemDotWarning]} />
                          <Text style={styles.listItemTextModern}>{concern}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Spending Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Spending Breakdown</Text>

              <View style={styles.categoryCard}>
                {selectedReport.spendingAnalysis.topCategories.slice(0, 5).map((cat, index) => {
                  const percentage = cat.percentOfTotal;
                  return (
                    <View key={index} style={styles.categoryItem}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName}>{cat.category}</Text>
                        <View style={styles.categoryValues}>
                          <Text style={styles.categoryPercent}>{percentage.toFixed(0)}%</Text>
                          <Text style={styles.categoryAmount}>${cat.amount.toFixed(2)}</Text>
                        </View>
                      </View>
                      <View style={styles.progressBarContainer}>
                        <View
                          style={[
                            styles.progressBar,
                            { width: `${percentage}%` }
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Happiness Analysis */}
            {selectedReport.happinessAnalysis.topHappyCategories.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Joy Categories</Text>

                <View style={styles.joyCard}>
                  {selectedReport.happinessAnalysis.topHappyCategories.map((cat, index) => (
                    <View key={index} style={styles.joyItem}>
                      <View style={styles.joyLeft}>
                        <Text style={styles.joyCategory}>{cat.category}</Text>
                        <View style={styles.joyMetrics}>
                          <View style={styles.joyMetric}>
                            <Text style={styles.joyMetricValue}>{cat.avgHappiness.toFixed(1)}</Text>
                            <Text style={styles.joyMetricLabel}>/5</Text>
                          </View>
                          <View style={styles.joyDivider} />
                          <View style={styles.joyMetric}>
                            <Text style={styles.joyMetricValue}>{cat.roi.toFixed(3)}</Text>
                            <Text style={styles.joyMetricLabel}>joy/$</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.joyRank}>
                        <Text style={styles.joyRankText}>#{index + 1}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Bucket Performance */}
            {selectedReport.bucketPerformance.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bucket Performance</Text>

                {selectedReport.bucketPerformance.map((bucket, index) => {
                  const spentPercentage = (bucket.spent / bucket.funded) * 100;
                  const isOverBudget = bucket.status === 'over-budget';
                  const isOnTrack = bucket.status === 'on-track';

                  return (
                    <View key={index} style={styles.bucketCardModern}>
                      <View style={styles.bucketCardHeader}>
                        <Text style={styles.bucketNameModern}>{bucket.bucketName}</Text>
                        <View style={[
                          styles.bucketStatusBadge,
                          isOverBudget && styles.bucketStatusBadgeOver,
                          isOnTrack && styles.bucketStatusBadgeOn,
                        ]}>
                          <Text style={[
                            styles.bucketStatusText,
                            isOverBudget && styles.bucketStatusTextOver,
                            isOnTrack && styles.bucketStatusTextOn,
                          ]}>
                            {bucket.status.replace('-', ' ')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.bucketProgressContainer}>
                        <View style={styles.bucketProgressBar}>
                          <View
                            style={[
                              styles.bucketProgressFill,
                              { width: `${Math.min(spentPercentage, 100)}%` },
                              isOverBudget && styles.bucketProgressFillOver,
                            ]}
                          />
                        </View>
                        <Text style={styles.bucketProgressText}>
                          {spentPercentage.toFixed(0)}%
                        </Text>
                      </View>

                      <View style={styles.bucketStatsRow}>
                        <View style={styles.bucketStatItem}>
                          <Text style={styles.bucketStatLabel}>Planned</Text>
                          <Text style={styles.bucketStatValue}>${bucket.planned.toFixed(0)}</Text>
                        </View>
                        <View style={styles.bucketStatDivider} />
                        <View style={styles.bucketStatItem}>
                          <Text style={styles.bucketStatLabel}>Funded</Text>
                          <Text style={styles.bucketStatValue}>${bucket.funded.toFixed(0)}</Text>
                        </View>
                        <View style={styles.bucketStatDivider} />
                        <View style={styles.bucketStatItem}>
                          <Text style={styles.bucketStatLabel}>Spent</Text>
                          <Text style={[
                            styles.bucketStatValue,
                            isOverBudget && styles.bucketStatValueOver,
                          ]}>
                            ${bucket.spent.toFixed(0)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Insights */}
            {selectedReport.insights.length > 0 && (
              <View style={styles.section}>
                <View style={styles.cardHeaderInline}>
                  <View style={styles.iconBadgeInfo}>
                    <Target size={18} color="#4747FF" strokeWidth={2} />
                  </View>
                  <Text style={styles.sectionTitle}>Insights</Text>
                </View>

                <View style={styles.insightsCard}>
                  {selectedReport.insights.map((insight, index) => (
                    <View key={index} style={styles.insightItem}>
                      <View style={styles.insightNumber}>
                        <Text style={styles.insightNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.insightText}>{insight}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Recommendations */}
            {selectedReport.recommendations.length > 0 && (
              <View style={styles.section}>
                <View style={styles.cardHeaderInline}>
                  <View style={styles.iconBadgeInfo}>
                    <Sparkles size={18} color="#4747FF" strokeWidth={2} />
                  </View>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                </View>

                <View style={styles.recommendationsCard}>
                  {selectedReport.recommendations.map((rec, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <View style={styles.recommendationDot} />
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    maxHeight: '100vh' as any,
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
    fontFamily: 'Merchant, monospace',
    letterSpacing: -1.2,
  },
  detailHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButton: {
    fontSize: 16,
    fontFamily: 'Merchant, monospace',
    color: theme.colors.primary,
    fontWeight: '500',
  },
  reportHeaderContent: {
    gap: 4,
  },
  reportTitle: {
    fontSize: 32,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.text,
    letterSpacing: -0.8,
  },
  reportDate: {
    fontSize: 15,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.textSecondary,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: theme.colors.purple100,
  },
  tabText: {
    fontSize: 15,
    fontFamily: 'Merchant, monospace',
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    fontWeight: '500',
    color: theme.colors.primary,
  },
  generateContainer: {
    paddingHorizontal: 20,
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
    fontSize: 16,
    fontFamily: 'Merchant, monospace',
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
    fontFamily: 'Merchant, monospace',
    marginTop: 16,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Merchant, monospace',
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
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.text,
  },
  reportCardSummary: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  reportCardStats: {
    flexDirection: 'row',
    gap: 20,
  },
  reportCardStat: {
    flex: 1,
  },
  reportCardStatLabel: {
    fontSize: 13,
    fontFamily: 'Merchant, monospace',
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportCardStatValue: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '500',
    color: theme.colors.text,
  },

  // Detail View Styles
  summaryHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 71, 255, 0.1)',
    shadowColor: '#4747FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 17,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
    lineHeight: 26,
  },

  metricsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 32,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: 'Merchant, monospace',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metricBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  metricBadgeText: {
    fontSize: 13,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
  },
  happinessStars: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  star: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(71, 71, 255, 0.2)',
  },
  starFilled: {
    backgroundColor: '#4747FF',
  },

  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 12,
    letterSpacing: -0.5,
  },

  winsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  concernsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.text,
  },
  iconBadgeSuccess: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeWarning: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeInfo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: '#22C55E',
  },
  badgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  badgeTextWarning: {
    color: '#F59E0B',
  },
  cardContent: {
    gap: 12,
  },
  listItemModern: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  listItemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginTop: 7,
  },
  listItemDotWarning: {
    backgroundColor: '#F59E0B',
  },
  listItemTextModern: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
    lineHeight: 24,
  },

  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 16,
  },
  categoryItem: {
    gap: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.text,
    flex: 1,
  },
  categoryValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  categoryPercent: {
    fontSize: 15,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.primary,
    minWidth: 40,
    textAlign: 'right',
  },
  categoryAmount: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '500',
    color: theme.colors.text,
    minWidth: 80,
    textAlign: 'right',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4747FF',
    borderRadius: 4,
  },

  joyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  joyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  joyLeft: {
    flex: 1,
    gap: 8,
  },
  joyCategory: {
    fontSize: 16,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.text,
  },
  joyMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  joyMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  joyMetricValue: {
    fontSize: 15,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.primary,
  },
  joyMetricLabel: {
    fontSize: 13,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.textSecondary,
  },
  joyDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  joyRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joyRankText: {
    fontSize: 13,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.primary,
  },

  bucketCardModern: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bucketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bucketNameModern: {
    fontSize: 18,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.text,
    flex: 1,
  },
  bucketStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
  },
  bucketStatusBadgeOver: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  bucketStatusBadgeOn: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  bucketStatusText: {
    fontSize: 13,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  bucketStatusTextOver: {
    color: '#EF4444',
  },
  bucketStatusTextOn: {
    color: '#22C55E',
  },
  bucketProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  bucketProgressBar: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bucketProgressFill: {
    height: '100%',
    backgroundColor: '#4747FF',
    borderRadius: 6,
  },
  bucketProgressFillOver: {
    backgroundColor: '#EF4444',
  },
  bucketProgressText: {
    fontSize: 14,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.text,
    minWidth: 40,
    textAlign: 'right',
  },
  bucketStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  bucketStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  bucketStatLabel: {
    fontSize: 12,
    fontFamily: 'Merchant, monospace',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bucketStatValue: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.text,
  },
  bucketStatValueOver: {
    color: '#EF4444',
  },
  bucketStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },

  cardHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  insightNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  insightNumberText: {
    fontSize: 13,
    fontFamily: 'Merchant Copy, monospace',
    fontWeight: '600',
    color: theme.colors.primary,
  },
  insightText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
    lineHeight: 24,
  },

  recommendationsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  recommendationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4747FF',
    marginTop: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
    lineHeight: 24,
  },
});
