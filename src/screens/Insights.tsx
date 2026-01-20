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
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import { TrendingUp, PiggyBank, Smile } from 'lucide-react-native';

export const Insights: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'emergency' | 'happiness'>('recommendations');

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser);

  // Get recommendations
  const spendingRecs = useQuery(
    api.recommendations.getSpendingBucketRecommendations,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  const emergencyRecs = useQuery(
    api.recommendations.getEmergencyFundRecommendation,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  const happinessROI = useQuery(
    api.recommendations.getHappinessROI,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  const needsVsWants = useQuery(
    api.tagging.getNeedsVsWants,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  if (!currentUser || !spendingRecs || !emergencyRecs || !happinessROI || !needsVsWants) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Insights</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recommendations' && styles.tabActive]}
          onPress={() => setActiveTab('recommendations')}
        >
          <TrendingUp size={18} color={activeTab === 'recommendations' ? theme.colors.primary : theme.colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}>
            Recommendations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'emergency' && styles.tabActive]}
          onPress={() => setActiveTab('emergency')}
        >
          <PiggyBank size={18} color={activeTab === 'emergency' ? theme.colors.primary : theme.colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.tabText, activeTab === 'emergency' && styles.tabTextActive]}>
            Emergency Fund
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'happiness' && styles.tabActive]}
          onPress={() => setActiveTab('happiness')}
        >
          <Smile size={18} color={activeTab === 'happiness' ? theme.colors.primary : theme.colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.tabText, activeTab === 'happiness' && styles.tabTextActive]}>
            Happiness ROI
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Spending Recommendations */}
        {activeTab === 'recommendations' && (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Bucket Recommendations</Text>
            <Text style={styles.sectionDescription}>
              Based on your spending patterns over the last {spendingRecs.hasData ? spendingRecs.monthsAnalyzed || 3 : 3} months
            </Text>

            {spendingRecs.hasData && spendingRecs.buckets && (
              <>
                {Object.entries(spendingRecs.buckets).map(([bucketId, data]: [string, any]) => (
                  <View key={bucketId} style={styles.card}>
                    <Text style={styles.cardTitle}>{data.bucketName}</Text>

                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Current planned:</Text>
                      <Text style={styles.statValue}>${data.currentPlanned.toFixed(2)}</Text>
                    </View>

                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Median spend:</Text>
                      <Text style={styles.statValue}>${data.medianSpend.toFixed(2)}/mo</Text>
                    </View>

                    <View style={[styles.statRow, styles.recommendedRow]}>
                      <Text style={styles.statLabelBold}>Recommended:</Text>
                      <Text style={styles.statValueBold}>${data.recommended.toFixed(2)}</Text>
                    </View>

                    <Text style={styles.hint}>15% buffer above median spend</Text>
                  </View>
                ))}
              </>
            )}

            {(!spendingRecs.hasData || !spendingRecs.buckets || Object.keys(spendingRecs.buckets).length === 0) && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Add more expenses to get personalized recommendations
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Emergency Fund */}
        {activeTab === 'emergency' && (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Emergency Fund Goals</Text>
            <Text style={styles.sectionDescription}>
              Build a safety net for unexpected expenses
            </Text>

            {emergencyRecs.hasData && (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  Your avg monthly essentials: <Text style={styles.infoValueText}>${emergencyRecs.avgMonthlyNeeds?.toFixed(2)}</Text>
                </Text>
                <Text style={styles.infoText}>
                  Your avg total spending: <Text style={styles.infoValueText}>${emergencyRecs.avgMonthlyTotal?.toFixed(2)}</Text>
                </Text>
              </View>
            )}

            {emergencyRecs.recommendations && (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🎯 Starter Goal</Text>
                  <Text style={styles.emergencyAmount}>
                    ${emergencyRecs.recommendations.starter.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.emergencyDescription}>
                    {emergencyRecs.recommendations.starter.description}
                  </Text>
                </View>

                {emergencyRecs.recommendations.threeMonths && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>✅ Recommended Goal</Text>
                    <Text style={styles.emergencyAmount}>
                      ${emergencyRecs.recommendations.threeMonths.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.emergencyDescription}>
                      {emergencyRecs.recommendations.threeMonths.description}
                    </Text>
                  </View>
                )}

                {emergencyRecs.recommendations.sixMonths && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>💪 Stretch Goal</Text>
                    <Text style={styles.emergencyAmount}>
                      ${emergencyRecs.recommendations.sixMonths.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.emergencyDescription}>
                      {emergencyRecs.recommendations.sixMonths.description}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Happiness ROI */}
        {activeTab === 'happiness' && (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Happiness per Dollar</Text>
            <Text style={styles.sectionDescription}>
              Which categories bring you the most joy?
            </Text>

            {/* Needs vs Wants */}
            <View style={styles.needsWantsCard}>
              <Text style={styles.cardTitle}>Needs vs Wants</Text>
              <View style={styles.needsWantsRow}>
                <View style={styles.needsWantsItem}>
                  <Text style={styles.needsWantsLabel}>Needs</Text>
                  <Text style={styles.needsWantsValue}>${needsVsWants.needs.toFixed(2)}</Text>
                  <Text style={styles.needsWantsPercent}>{needsVsWants.needsPercent.toFixed(0)}%</Text>
                </View>
                <View style={styles.needsWantsItem}>
                  <Text style={styles.needsWantsLabel}>Wants</Text>
                  <Text style={styles.needsWantsValue}>${needsVsWants.wants.toFixed(2)}</Text>
                  <Text style={styles.needsWantsPercent}>{needsVsWants.wantsPercent.toFixed(0)}%</Text>
                </View>
              </View>
            </View>

            {/* Happiness ROI by Category */}
            {happinessROI.map((item, index) => (
              <View key={index} style={styles.roiCard}>
                <View style={styles.roiHeader}>
                  <Text style={styles.roiCategory}>{item.category}</Text>
                  <Text style={styles.roiScore}>{item.happinessPerDollar.toFixed(3)} joy/$</Text>
                </View>
                <View style={styles.roiStats}>
                  <Text style={styles.roiStat}>Spent: ${item.totalSpent.toFixed(2)}</Text>
                  <Text style={styles.roiStat}>Avg happiness: {item.avgHappiness.toFixed(1)}/5</Text>
                  <Text style={styles.roiStat}>{item.count} transactions</Text>
                </View>
              </View>
            ))}

            {happinessROI.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Add expenses with happiness ratings to see your happiness ROI
                </Text>
              </View>
            )}
          </View>
        )}
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  content: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
  },
  statLabelBold: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  statValueBold: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
  },
  recommendedRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  hint: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emergencyAmount: {
    fontSize: 36,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  emergencyDescription: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  infoCard: {
    backgroundColor: theme.colors.purple100,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    marginBottom: 4,
  },
  infoValueText: {
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
  },
  needsWantsCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  needsWantsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  needsWantsItem: {
    flex: 1,
    alignItems: 'center',
  },
  needsWantsLabel: {
    fontSize: 13,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  needsWantsValue: {
    fontSize: 24,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
    marginBottom: 4,
  },
  needsWantsPercent: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.primary,
  },
  roiCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  roiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roiCategory: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  roiScore: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.primary,
  },
  roiStats: {
    flexDirection: 'row',
    gap: 16,
  },
  roiStat: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant, monospace',
  },
});
