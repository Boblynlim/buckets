import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import {
  DollarSign,
  ChevronRight,
  Bell,
  BarChart3,
  Info,
  Heart,
  X,
  FileText,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import type { Bucket } from '../types';
import {
  exportExpensesToCSV,
  generateCSVTemplate,
  downloadCSV,
  parseCSVToExpenses,
} from '../utils/csvExport';

interface SettingsProps {
  navigation?: any;
  onAddBucket?: () => void;
  onEditBucket?: (bucket: Bucket) => void;
  onSetIncome?: () => void;
  onNavigateToReports?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  navigation,
  onAddBucket,
  onEditBucket,
  onSetIncome,
  onNavigateToReports,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Notification settings
  const [lowBalanceAlerts, setLowBalanceAlerts] = useState(true);
  const [spendingReminders, setSpendingReminders] = useState(true);
  const [monthlyReports, setMonthlyReports] = useState(false);

  // Rollover settings
  const [autoRollover, setAutoRollover] = useState(true);
  // Get current user and buckets from Convex
  const currentUser = useQuery(api.users.getCurrentUser);
  const initDemoUser = useMutation(api.users.initDemoUser);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const expenses = useQuery(
    api.expenses.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const incomeEntries = useQuery(
    api.income.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const bulkImport = useMutation(api.expenses.bulkImport);
  const manualRollover = useMutation(api.rollover.manualRollover);

  // Initialize demo user if needed
  React.useEffect(() => {
    if (currentUser === null) {
      console.log('No user found in Settings, initializing...');
      initDemoUser().catch(err => {
        console.error('Error initializing demo user:', err);
      });
    }
  }, [currentUser, initDemoUser]);

  const allBuckets = buckets || [];
  const allExpenses = expenses || [];
  const allIncomeEntries = incomeEntries || [];

  // Calculate total monthly income (sum of recurring income)
  const monthlyIncome = allIncomeEntries
    .filter(income => income.isRecurring)
    .reduce((sum, income) => sum + income.amount, 0);

  const handleExportCSV = () => {
    if (!currentUser || allBuckets.length === 0 || allExpenses.length === 0) {
      Alert.alert('No Data', 'No expenses to export');
      return;
    }

    try {
      const csv = exportExpensesToCSV(allExpenses, allBuckets);
      const filename = `buckets_expenses_${
        new Date().toISOString().split('T')[0]
      }.csv`;

      downloadCSV(csv, filename);
      Alert.alert(
        'Success',
        `Exported ${allExpenses.length} expenses to ${filename}`,
      );
      setShowExport(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
      console.error('Export error:', error);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const template = generateCSVTemplate();
      downloadCSV(template, 'buckets_import_template.csv');
      Alert.alert('Success', 'Downloaded CSV template');
    } catch (error) {
      Alert.alert('Error', 'Failed to download template');
      console.error('Template error:', error);
    }
  };

  const handleImportCSV = async (csvText: string) => {
    if (!currentUser || allBuckets.length === 0) {
      Alert.alert('Error', 'Please create buckets first');
      return;
    }

    try {
      // Parse CSV
      const parsedExpenses = parseCSVToExpenses(csvText, allBuckets);

      if (parsedExpenses.length === 0) {
        Alert.alert('Error', 'No valid expenses found in CSV');
        return;
      }

      // Convert to format expected by bulkImport mutation
      const bucketNameMap = new Map(
        allBuckets.map(b => [b.name.toLowerCase(), b._id]),
      );
      const expensesToImport = parsedExpenses.map(exp => ({
        bucketId: bucketNameMap.get(exp.bucket.toLowerCase())!,
        amount: exp.amount,
        date: new Date(exp.date).getTime(),
        note: exp.note,
        happinessRating: exp.happinessRating,
        category: exp.category,
        merchant: exp.merchant,
        needsVsWants: exp.needsVsWants,
      }));

      // Import via mutation
      const results = await bulkImport({
        userId: currentUser._id,
        expenses: expensesToImport,
      });

      const message = `Imported: ${results.success}\nFailed: ${results.failed}${
        results.errors.length > 0
          ? '\n\nErrors:\n' + results.errors.slice(0, 5).join('\n')
          : ''
      }`;

      Alert.alert('Import Results', message);
      setShowImport(false);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
      console.error('Import error:', error);
    }
  };

  const handleAddBucket = () => {
    if (onAddBucket) {
      onAddBucket();
    } else {
      alert('Use the + button at the bottom to add a bucket');
    }
  };

  const handleEditBucket = (bucket: Bucket) => {
    if (onEditBucket) {
      onEditBucket(bucket);
    } else {
      alert(
        `Edit bucket: ${bucket.name}\n\n(Edit functionality coming soon for web!)`,
      );
    }
  };

  const handleSetIncome = () => {
    if (onSetIncome) {
      onSetIncome();
    } else {
      alert(
        'Income management coming soon for web!\n\nFor now, use the native app to set income.',
      );
    }
  };

  // Show loading state
  if (currentUser === undefined || buckets === undefined) {
    return (
      <SafeAreaView style={styles.loadingWrapper}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalAllocation = allBuckets.reduce(
    (sum, bucket) => sum + bucket.allocationValue,
    0,
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Settings</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>

        {/* Income Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>INCOME</Text>
            <TouchableOpacity onPress={handleSetIncome}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <Pressable style={styles.row} onPress={handleSetIncome}>
            <View style={styles.rowLeft}>
              <View style={styles.iconContainer}>
                <DollarSign size={22} color="#34C759" strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.rowTitle}>Monthly Income</Text>
                <Text style={styles.rowSubtitle}>
                  {monthlyIncome > 0
                    ? `$${monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month`
                    : 'No recurring income set'}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Buckets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>BUCKETS</Text>
            <TouchableOpacity onPress={handleAddBucket}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {allBuckets.map(bucket => (
            <Pressable
              key={bucket._id}
              style={styles.row}
              onPress={() => handleEditBucket(bucket)}
            >
              <View style={styles.rowLeft}>
                <View
                  style={[styles.bucketDot, { backgroundColor: bucket.color }]}
                />
                <View>
                  <Text style={styles.rowTitle}>{bucket.name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {bucket.allocationType === 'percentage'
                      ? `${bucket.allocationValue}%`
                      : `$${bucket.allocationValue}`}{' '}
                    per month
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
            </Pressable>
          ))}
        </View>

        {/* Monthly Rollover Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>MONTHLY ROLLOVER</Text>
            {!autoRollover && (
              <TouchableOpacity
                onPress={async () => {
                  if (!currentUser) return;
                  try {
                    const result = await manualRollover({
                      userId: currentUser._id,
                    });
                    Alert.alert(
                      'Rollover Complete',
                      `Processed ${result.bucketsProcessed} buckets successfully.`
                    );
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Failed to perform rollover');
                  }
                }}
              >
                <Text style={styles.addButton}>Trigger Now</Text>
              </TouchableOpacity>
            )}
            {autoRollover && <View style={{width: 40}} />}
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconContainer}>
                <BarChart3 size={22} color="#FF9500" strokeWidth={2} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.rowTitle}>Automatic Rollover</Text>
                <Text style={styles.rowSubtitle}>
                  {autoRollover
                    ? 'Runs automatically on 1st of month'
                    : 'Manual mode - trigger when ready'}
                </Text>
              </View>
            </View>
            <Switch
              value={autoRollover}
              onValueChange={setAutoRollover}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              ios_backgroundColor={theme.colors.border}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* General Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>GENERAL</Text>
            <View style={{width: 40}} />
          </View>

          <Pressable
            style={styles.row}
            onPress={() => {
              if (onNavigateToReports) {
                onNavigateToReports();
              } else {
                navigation?.navigate('Reports');
              }
            }}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconContainer}>
                <FileText size={22} color="#4747FF" strokeWidth={2} />
              </View>
              <Text style={styles.rowTitle}>Reports</Text>
            </View>
            <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
          </Pressable>

          <Pressable
            style={styles.row}
            onPress={() => setShowNotifications(true)}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconContainer}>
                <Bell size={22} color="#FF9500" strokeWidth={2} />
              </View>
              <Text style={styles.rowTitle}>Notifications</Text>
            </View>
            <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
          </Pressable>

          <Pressable style={styles.row} onPress={() => setShowImport(true)}>
            <View style={styles.rowLeft}>
              <View style={styles.iconContainer}>
                <BarChart3 size={22} color="#34C759" strokeWidth={2} />
              </View>
              <Text style={styles.rowTitle}>Import Data</Text>
            </View>
            <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
          </Pressable>

          <Pressable style={styles.row} onPress={() => setShowExport(true)}>
            <View style={styles.rowLeft}>
              <View style={styles.iconContainer}>
                <BarChart3 size={22} color="#4747FF" strokeWidth={2} />
              </View>
              <Text style={styles.rowTitle}>Export Data</Text>
            </View>
            <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Version */}
        <View style={styles.footer}>
          <Text style={styles.version}>Buckets v1.0.0</Text>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Made with </Text>
            <Heart size={14} color="#4747FF" fill="#4747FF" strokeWidth={0} />
            <Text style={styles.footerText}> by jaz</Text>
          </View>
        </View>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNotifications(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <X size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Low Balance Alerts</Text>
                <Text style={styles.settingDescription}>
                  Get notified when a bucket is running low
                </Text>
              </View>
              <Switch
                value={lowBalanceAlerts}
                onValueChange={setLowBalanceAlerts}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                ios_backgroundColor={theme.colors.border}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Spending Reminders</Text>
                <Text style={styles.settingDescription}>
                  Daily reminders to log your expenses
                </Text>
              </View>
              <Switch
                value={spendingReminders}
                onValueChange={setSpendingReminders}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                ios_backgroundColor={theme.colors.border}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Monthly Reports</Text>
                <Text style={styles.settingDescription}>
                  Get a summary of your spending each month
                </Text>
              </View>
              <Switch
                value={monthlyReports}
                onValueChange={setMonthlyReports}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                ios_backgroundColor={theme.colors.border}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Export Data Modal */}
      <Modal
        visible={showExport}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowExport(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowExport(false)}>
              <X size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Export Data</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.exportDescription}>
              Export your financial data in various formats for backup or
              analysis.
            </Text>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={handleExportCSV}
            >
              <View style={styles.exportOptionContent}>
                <Text style={styles.exportOptionTitle}>Export as CSV</Text>
                <Text style={styles.exportOptionDescription}>
                  Spreadsheet-friendly format for all transactions (
                  {allExpenses.length} expenses)
                </Text>
              </View>
              <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => {
                Alert.alert('Export JSON', 'JSON export coming soon!');
              }}
            >
              <View style={styles.exportOptionContent}>
                <Text style={styles.exportOptionTitle}>Export as JSON</Text>
                <Text style={styles.exportOptionDescription}>
                  Complete data export including all metadata
                </Text>
              </View>
              <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => {
                Alert.alert('Export PDF', 'PDF report coming soon!');
              }}
            >
              <View style={styles.exportOptionContent}>
                <Text style={styles.exportOptionTitle}>
                  Export as PDF Report
                </Text>
                <Text style={styles.exportOptionDescription}>
                  Formatted monthly spending report
                </Text>
              </View>
              <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Import Data Modal */}
      <Modal
        visible={showImport}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowImport(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowImport(false)}>
              <X size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Import Data</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.exportDescription}>
              Import your transactions from a CSV file. Make sure your CSV file
              matches the template format.
            </Text>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={handleDownloadTemplate}
            >
              <View style={styles.exportOptionContent}>
                <Text style={styles.exportOptionTitle}>
                  Download CSV Template
                </Text>
                <Text style={styles.exportOptionDescription}>
                  Get a sample CSV file with the correct format
                </Text>
              </View>
              <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => {
                Alert.alert(
                  'Import CSV',
                  'Select a CSV file to import (coming soon!)',
                );
              }}
            >
              <View style={styles.exportOptionContent}>
                <Text style={styles.exportOptionTitle}>Import from CSV</Text>
                <Text style={styles.exportOptionDescription}>
                  Upload your transactions CSV file
                </Text>
              </View>
              <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.importInstructions}>
              <Text style={styles.importInstructionsTitle}>
                CSV Format Requirements:
              </Text>
              <Text style={styles.importInstructionsText}>
                • date: YYYY-MM-DD format{'\n'}• amount: Number (e.g., 42.50)
                {'\n'}• bucket: Name of bucket (must match existing bucket)
                {'\n'}• note: Description of transaction{'\n'}• happinessRating:
                Number from 1-5
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3F0',
    maxHeight: '100vh' as any,
  },
  loadingWrapper: {
    flex: 1,
    backgroundColor: '#F5F3F0',
    minHeight: '100vh' as any,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
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
    color: '#2D2D2D',
    fontFamily: 'Merchant, monospace',
    letterSpacing: -1.2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8A8478',
    fontFamily: 'Merchant, monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  addButton: {
    fontSize: 13,
    color: '#4747FF',
    fontWeight: '500',
    fontFamily: 'Merchant, monospace',
  },
  row: {
    backgroundColor: '#FDFCFB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginHorizontal: 20,
    borderRadius: 20,
    marginBottom: 10,
    cursor: 'pointer' as any,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bucketDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    color: '#2D2D2D',
    fontWeight: '400',
    fontFamily: 'Merchant, monospace',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#8A8478',
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 2,
  },
  footer: {
    paddingVertical: 40,
    paddingBottom: 100,
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  version: {
    fontSize: 13,
    color: '#8A8478',
    fontFamily: 'Merchant, monospace',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#8A8478',
    fontFamily: 'Merchant, monospace',
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
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  exportDescription: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginTop: 20,
    marginBottom: 24,
    lineHeight: 22,
  },
  exportOption: {
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exportOptionContent: {
    flex: 1,
    marginRight: 12,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    marginBottom: 4,
  },
  exportOptionDescription: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    flexWrap: 'wrap',
  },
  importInstructions: {
    marginTop: 24,
    padding: 16,
    backgroundColor: theme.colors.purple100,
    borderRadius: 12,
  },
  importInstructionsTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 8,
  },
  importInstructionsText: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
