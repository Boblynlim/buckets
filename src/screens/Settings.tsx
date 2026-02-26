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
  Trash2,
} from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import type { Bucket } from '../types';
import { SwipeableRow } from '../components/SwipeableRow';
import { Toast } from '../components/Toast';
import { CSVImportPreview } from '../components/CSVImportPreview';
import {
  exportExpensesToCSV,
  generateCSVTemplate,
  downloadCSV,
  parseCSVToExpenses,
  type CSVExpense,
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
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [parsedExpenses, setParsedExpenses] = useState<CSVExpense[]>([]);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'loading'>('success');

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
  const resetAllData = useMutation(api.reset.deleteAllUserData);
  const removeBucket = useMutation(api.buckets.remove);
  const calculateDistribution = useMutation(api.distribution.calculateDistribution);

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

  const showToast = (message: string, type: 'success' | 'error' | 'loading') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleDownloadTemplate = () => {
    try {
      const template = generateCSVTemplate(allBuckets || []);
      downloadCSV(template, 'buckets_import_template.csv');
      showToast('Downloaded CSV template with your bucket names', 'success');
    } catch (error) {
      showToast('Failed to download template', 'error');
      console.error('Template error:', error);
    }
  };

  const handleImportCSV = async (csvText: string) => {
    console.log('handleImportCSV called with CSV text length:', csvText?.length);

    if (!currentUser || allBuckets.length === 0) {
      showToast('Please create buckets first', 'error');
      return;
    }

    try {
      // Parse CSV
      console.log('Parsing CSV with', allBuckets.length, 'buckets');
      const parsed = parseCSVToExpenses(csvText, allBuckets);
      console.log('Parsed expenses:', parsed.length);

      if (parsed.length === 0) {
        showToast('No valid expenses found in CSV', 'error');
        return;
      }

      // Show preview modal
      setParsedExpenses(parsed);
      setShowImport(false);
      setShowImportPreview(true);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      console.error('Import error:', error);
      showToast(errorMessage, 'error');
    }
  };

  const handleConfirmImport = async (expenses: CSVExpense[]) => {
    if (!currentUser) return;

    try {
      // Show loading toast
      showToast('Importing transactions...', 'loading');

      // Convert to format expected by bulkImport mutation
      // Create bucket name map with normalized keys (lowercase, trimmed)
      const bucketNameMap = new Map(
        allBuckets.map(b => [b.name.toLowerCase().trim(), b._id]),
      );

      const expensesToImport = expenses.map(exp => {
        const normalizedBucketName = exp.bucket.toLowerCase().trim();
        const bucketId = bucketNameMap.get(normalizedBucketName);

        if (!bucketId) {
          console.error(`Cannot find bucket ID for: "${exp.bucket}" (normalized: "${normalizedBucketName}")`);
          console.error('Available buckets:', Array.from(bucketNameMap.keys()));
          throw new Error(`Unknown bucket: ${exp.bucket}`);
        }

        return {
          bucketId,
          amount: exp.amount,
          date: new Date(exp.date).getTime(),
          note: exp.note,
          worthRating: exp.worthRating,
          alignmentRating: exp.alignmentRating,
          category: exp.category,
          merchant: exp.merchant,
          needsVsWants: exp.needsVsWants,
        };
      });

      // Import via mutation
      const results = await bulkImport({
        userId: currentUser._id,
        expenses: expensesToImport,
      });

      // Show success/error based on results
      if (results.failed === 0) {
        showToast(`Successfully imported ${results.success} transactions!`, 'success');
      } else {
        showToast(`Imported ${results.success}, failed ${results.failed}. Check console for errors.`, 'error');
        console.error('Import errors:', results.errors);
      }

      setShowImportPreview(false);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      console.error('Import error:', error);
      showToast(errorMessage, 'error');
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

  const handleDeleteBucket = async (bucket: Bucket) => {
    if (!currentUser) return;

    const hasBalance = (bucket.currentBalance || 0) > 0;
    const confirmMessage = hasBalance
      ? `Delete "${bucket.name}"?\n\nThis bucket has $${(bucket.currentBalance || 0).toFixed(2)} remaining.\n\nThis action cannot be undone.`
      : `Delete "${bucket.name}"?\n\nThis action cannot be undone.`;

    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

    try {
      await removeBucket({ bucketId: bucket._id as any });
    } catch (error: any) {
      console.error('Failed to delete bucket:', error);
      alert(`Error: ${error?.message || 'Failed to delete bucket. Please try again.'}`);
    }
  };

  const handleResetAllData = async () => {
    if (!currentUser) return;

    const confirmed = confirm(
      '⚠️ WARNING: This will permanently delete ALL your data including:\n\n' +
      '• All buckets\n' +
      '• All income entries\n' +
      '• All expenses\n' +
      '• All recurring expenses\n' +
      '• All chat history\n' +
      '• All memories\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you absolutely sure you want to continue?'
    );

    if (!confirmed) return;

    // Double confirmation
    const doubleConfirm = confirm(
      'This is your last chance!\n\n' +
      'Type "DELETE" in your mind and click OK to proceed with deleting ALL data.'
    );

    if (!doubleConfirm) return;

    try {
      const result = await resetAllData({ userId: currentUser._id });

      alert(
        `✅ All data has been deleted!\n\n` +
        `Deleted:\n` +
        `• ${result.deletedCounts.buckets} buckets\n` +
        `• ${result.deletedCounts.income} income entries\n` +
        `• ${result.deletedCounts.expenses} expenses\n` +
        `• ${result.deletedCounts.recurringExpenses} recurring expenses\n` +
        `• ${result.deletedCounts.conversations} conversations\n` +
        `• ${result.deletedCounts.memories} memories\n\n` +
        `Your app has been reset to a clean slate.`
      );

      // Reload the page to refresh the UI
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to reset data:', error);
      alert(`Error: ${error?.message || 'Failed to reset data. Please try again.'}`);
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
            <View style={styles.headerButtonsRow}>
              <TouchableOpacity
                onPress={async () => {
                  if (!currentUser) return;
                  try {
                    showToast('Applying allocations...', 'loading');
                    await calculateDistribution({ userId: currentUser._id });
                    showToast('All bucket allocations and save contributions have been updated!', 'success');
                  } catch (error: any) {
                    showToast(error.message || 'Failed to apply allocations', 'error');
                  }
                }}
              >
                <Text style={styles.refreshButton}>↻ Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSetIncome}>
                <Text style={styles.addButton}>+ Add</Text>
              </TouchableOpacity>
            </View>
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
            <SwipeableRow
              key={bucket._id}
              onDelete={() => handleDeleteBucket(bucket)}
            >
              <Pressable
                style={styles.bucketRow}
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
            </SwipeableRow>
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

          <Pressable style={styles.row} onPress={handleResetAllData}>
            <View style={styles.rowLeft}>
              <View style={styles.iconContainer}>
                <Trash2 size={22} color="#FF3B30" strokeWidth={2} />
              </View>
              <Text style={[styles.rowTitle, styles.dangerText]}>Reset All Data</Text>
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
                console.log('Import CSV button clicked');
                // Create file input for web
                if (typeof document !== 'undefined') {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv';
                  input.onchange = (e: any) => {
                    console.log('File selected');
                    const file = e.target?.files?.[0];
                    if (file) {
                      console.log('Reading file:', file.name, 'size:', file.size);
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const csvText = event.target?.result as string;
                        console.log('File read successfully, length:', csvText?.length);
                        handleImportCSV(csvText);
                      };
                      reader.onerror = (error) => {
                        console.error('FileReader error:', error);
                        showToast('Failed to read file', 'error');
                      };
                      reader.readAsText(file);
                    } else {
                      console.log('No file selected');
                    }
                  };
                  input.click();
                } else {
                  Alert.alert(
                    'Import CSV',
                    'CSV import is only available on web',
                  );
                }
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
                • Date: YYYY-MM-DD format (e.g., 2024-01-15){'\n'}
                • Bucket: Must match your bucket names exactly{'\n'}
                • Amount: Number without $ (e.g., 42.50){'\n'}
                • Note: Description (use quotes if contains commas){'\n'}
                • Happiness Rating: Number from 1-5{'\n'}
                • Category: Optional (e.g., Food & Dining){'\n'}
                • Merchant: Optional (e.g., Whole Foods){'\n'}
                • Needs vs Wants: Optional - "need" or "want"
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* CSV Import Preview */}
      <CSVImportPreview
        visible={showImportPreview}
        parsedExpenses={parsedExpenses}
        availableBuckets={allBuckets}
        onClose={() => setShowImportPreview(false)}
        onConfirmImport={handleConfirmImport}
      />

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
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
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  refreshButton: {
    fontSize: 13,
    color: '#4747FF',
    fontWeight: '500',
    fontFamily: 'Merchant, monospace',
    lineHeight: 15,
  },
  addButton: {
    fontSize: 13,
    color: '#4747FF',
    fontWeight: '500',
    fontFamily: 'Merchant, monospace',
    lineHeight: 15,
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
  bucketRow: {
    backgroundColor: '#FDFCFB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
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
    fontSize: 18,
    color: '#2D2D2D',
    fontWeight: '400',
    fontFamily: 'Merchant, monospace',
  },
  rowSubtitle: {
    fontSize: 15,
    color: '#8A8478',
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 3,
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
  dangerText: {
    color: '#FF3B30',
  },
});
