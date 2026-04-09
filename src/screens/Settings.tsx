import React, { useState, useEffect } from 'react';
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
  Image,
  TextInput,
} from 'react-native';
import {
  ChevronRight,
  Heart,
  X,
  FolderPlus,
} from 'lucide-react-native';
import { useQuery, useMutation, useAction, useConvex } from 'convex/react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import type { Bucket } from '../types';
import { getCupForBucketId, registerCupAssignments } from '../constants/bucketIcons';
import { PotteryLoader } from '../components/PotteryLoader';
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
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed as checkPushSubscribed,
} from '../utils/pushNotifications';

interface SettingsProps {
  navigation?: any;
  onAddBucket?: () => void;
  onEditBucket?: (bucket: Bucket) => void;
  onSetIncome?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToLetters?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  navigation,
  onAddBucket,
  onEditBucket,
  onSetIncome,
  onNavigateToReports,
  onNavigateToLetters,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showManageBuckets, setShowManageBuckets] = useState(false);
  const [parsedExpenses, setParsedExpenses] = useState<CSVExpense[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSelectedIds, setNewGroupSelectedIds] = useState<Set<string>>(new Set());
  // For editing group membership
  const [editingGroupMembership, setEditingGroupMembership] = useState<string | null>(null);
  const [editMembershipSelectedIds, setEditMembershipSelectedIds] = useState<Set<string>>(new Set());

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'loading'>(
    'success',
  );

  // Change passcode state
  const [showChangePasscode, setShowChangePasscode] = useState(false);
  const [currentPc, setCurrentPc] = useState('');
  const [newPc, setNewPc] = useState('');
  const [confirmPc, setConfirmPc] = useState('');
  const [pcError, setPcError] = useState('');
  const [pcSubmitting, setPcSubmitting] = useState(false);

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const convex = useConvex();

  // Get current user and buckets from Convex
  const { user: currentUser, sessionToken, logout } = useAuth();
  const changePasscodeAction = useAction(api.auth.changePasscode);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const expenses = useQuery(
    api.expenses.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const currentMonthStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const incomeEntries = useQuery(
    api.monthlyIncome.getByMonth,
    currentUser ? { userId: currentUser._id, month: currentMonthStr } : 'skip',
  );
  const groups = useQuery(
    api.groups.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );
  const bulkImport = useMutation(api.expenses.bulkImport);
  const generateReport = useAction(api.reportsNew.generateMonthlyReport);
  const resetAllData = useMutation(api.reset.deleteAllUserData);
  const removeBucket = useMutation(api.buckets.remove);
  const calculateDistribution = useMutation(
    api.distribution.calculateDistribution,
  );
  const createGroup = useMutation(api.groups.create);
  const updateGroup = useMutation(api.groups.update);
  const removeGroup = useMutation(api.groups.remove);
  const assignBucketToGroup = useMutation(api.groups.assignBucket);

  // Check push notification status
  useEffect(() => {
    setPushSupported(isPushSupported());
    checkPushSubscribed().then(setPushEnabled);
  }, []);

  const handleTogglePush = async (value: boolean) => {
    if (!currentUser) return;
    setPushLoading(true);
    try {
      if (value) {
        const success = await subscribeToPush(currentUser._id, convex);
        setPushEnabled(success);
        if (!success) {
          Alert.alert('Permission Denied', 'Please enable notifications in your browser settings.');
        }
      } else {
        await unsubscribeFromPush(convex);
        setPushEnabled(false);
      }
    } catch (error) {
      console.error('Push toggle error:', error);
    }
    setPushLoading(false);
  };

  const allBuckets = buckets || [];
  const allExpenses = expenses || [];
  const allIncomeEntries = incomeEntries || [];

  registerCupAssignments(allBuckets.map(b => b._id));

  // Calculate total monthly income from per-month entries
  const monthlyIncome = allIncomeEntries
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

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'loading',
  ) => {
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
    console.log(
      'handleImportCSV called with CSV text length:',
      csvText?.length,
    );

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
          console.error(
            `Cannot find bucket ID for: "${exp.bucket}" (normalized: "${normalizedBucketName}")`,
          );
          console.error('Available buckets:', Array.from(bucketNameMap.keys()));
          throw new Error(`Unknown bucket: ${exp.bucket}`);
        }

        return {
          bucketId,
          amount: exp.amount,
          date: new Date(exp.date).getTime(),
          note: exp.note,
          worthIt: exp.worthIt ?? false,
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
        showToast(
          `Imported ${results.success} transactions! Generating report...`,
          'success',
        );
      } else {
        showToast(
          `Imported ${results.success}, failed ${results.failed}. Check console for errors.`,
          'error',
        );
        console.error('Import errors:', results.errors);
      }

      setShowImportPreview(false);

      // Auto-generate monthly report after successful import
      if (currentUser && results.success > 0) {
        try {
          await generateReport({ userId: currentUser._id });
          showToast('Monthly report generated!', 'success');
        } catch (reportError) {
          console.error('Report generation failed:', reportError);
          // Don't show error toast - import succeeded, report is secondary
        }
      }
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
      ? `Delete "${bucket.name}"?\n\nThis bucket has $${(
          bucket.currentBalance || 0
        ).toFixed(2)} remaining.\n\nThis action cannot be undone.`
      : `Delete "${bucket.name}"?\n\nThis action cannot be undone.`;

    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

    try {
      await removeBucket({ bucketId: bucket._id as any });
    } catch (error: any) {
      console.error('Failed to delete bucket:', error);
      alert(
        `Error: ${
          error?.message || 'Failed to delete bucket. Please try again.'
        }`,
      );
    }
  };

  const handleChangePasscode = async () => {
    setPcError('');
    if (!currentPc || !newPc || !confirmPc) {
      setPcError('Please fill in all fields');
      return;
    }
    if (newPc.length !== 6 || !/^\d{6}$/.test(newPc)) {
      setPcError('Passcode must be exactly 6 digits');
      return;
    }
    if (newPc !== confirmPc) {
      setPcError('New passcodes do not match');
      return;
    }
    if (!sessionToken) return;
    setPcSubmitting(true);
    try {
      await changePasscodeAction({
        sessionToken,
        currentPasscode: currentPc,
        newPasscode: newPc,
      });
      setCurrentPc('');
      setNewPc('');
      setConfirmPc('');
      setShowChangePasscode(false);
      setToastMessage('Passcode changed successfully');
      setToastType('success');
      setToastVisible(true);
    } catch (err: any) {
      const msg = err?.data || err?.message || 'Failed to change passcode';
      const clean = typeof msg === 'string' && msg.includes('Uncaught Error:')
        ? msg.split('Uncaught Error:').pop()!.split('\n')[0].trim()
        : typeof msg === 'string' ? msg : 'Failed to change passcode';
      setPcError(clean);
    } finally {
      setPcSubmitting(false);
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
        'Are you absolutely sure you want to continue?',
    );

    if (!confirmed) return;

    // Double confirmation
    const doubleConfirm = confirm(
      'This is your last chance!\n\n' +
        'Type "DELETE" in your mind and click OK to proceed with deleting ALL data.',
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
          `Your app has been reset to a clean slate.`,
      );

      // Reload the page to refresh the UI
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to reset data:', error);
      alert(
        `Error: ${error?.message || 'Failed to reset data. Please try again.'}`,
      );
    }
  };

  // Show loading state
  if (currentUser === undefined || buckets === undefined) {
    return (
      <SafeAreaView style={styles.loadingWrapper}>
        <PotteryLoader message="Loading settings..." />
      </SafeAreaView>
    );
  }

  const totalAllocation = allBuckets.reduce(
    (sum, bucket) => {
      if (bucket.bucketMode === 'save') {
        // For save buckets, show monthly contribution, not total goal
        return sum + (bucket.contributionAmount || 0);
      }
      // For spend/recurring buckets, show planned monthly amount
      return sum + (bucket.plannedAmount || 0);
    },
    0,
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Group 1: Your Budget */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>YOUR BUDGET</Text>
          </View>

          <View style={styles.groupCard}>
            <Pressable style={styles.groupRow} onPress={handleSetIncome}>
              <View style={{flex: 1}}>
                <Text style={styles.groupRowTitle}>Income</Text>
                <Text style={styles.groupRowSub}>
                  {monthlyIncome > 0
                    ? `$${monthlyIncome.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}/month`
                    : 'No income set'}
                </Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>

            <View style={styles.groupRowDivider} />

            <Pressable style={styles.groupRow} onPress={() => setShowManageBuckets(true)}>
              <View style={styles.rowLeft}>
                <View style={styles.bucketStackPreview}>
                  {allBuckets.slice(0, 3).map((bucket, i) => (
                    <Image
                      key={bucket._id}
                      source={getCupForBucketId(bucket._id, bucket.icon)}
                      style={[
                        styles.bucketStackImage,
                        { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i },
                      ]}
                      resizeMode="contain"
                    />
                  ))}
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.groupRowTitle}>Buckets</Text>
                  <Text style={styles.groupRowSub}>
                    {allBuckets.length} bucket{allBuckets.length !== 1 ? 's' : ''} · $
                    {totalAllocation.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}/mo
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>

            <View style={styles.groupRowDivider} />

            <Pressable
              style={styles.groupRow}
              onPress={() => {
                if (onNavigateToReports) {
                  onNavigateToReports();
                } else {
                  navigation?.navigate('Reports');
                }
              }}
            >
              <View style={{flex: 1}}>
                <Text style={styles.groupRowTitle}>Reports</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>

            <View style={styles.groupRowDivider} />

            <Pressable
              style={styles.groupRow}
              onPress={() => {
                if (onNavigateToLetters) {
                  onNavigateToLetters();
                } else {
                  navigation?.navigate('Letters');
                }
              }}
            >
              <View style={{flex: 1}}>
                <Text style={styles.groupRowTitle}>Letters</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Group 2: Data & Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>DATA & PREFERENCES</Text>
          </View>

          <View style={styles.groupCard}>
            <Pressable style={styles.groupRow} onPress={() => setShowNotifications(true)}>
              <Text style={styles.groupRowTitle}>Notifications</Text>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>

            <View style={styles.groupRowDivider} />

            <Pressable style={styles.groupRow} onPress={() => setShowImport(true)}>
              <Text style={styles.groupRowTitle}>Import Data</Text>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>

            <View style={styles.groupRowDivider} />

            <Pressable style={styles.groupRow} onPress={() => setShowExport(true)}>
              <Text style={styles.groupRowTitle}>Export Data</Text>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>

            <View style={styles.groupRowDivider} />

            <Pressable style={styles.groupRow} onPress={handleResetAllData}>
              <Text style={[styles.groupRowTitle, styles.dangerText]}>Reset All Data</Text>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Group 3: Account */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>ACCOUNT</Text>
          </View>

          <View style={styles.groupCard}>
            {currentUser?.email && (
              <>
                <View style={styles.groupRow}>
                  <Text style={styles.groupRowTitle}>{currentUser.email}</Text>
                </View>
                <View style={styles.groupRowDivider} />
              </>
            )}

            <Pressable style={styles.groupRow} onPress={() => {
              setPcError('');
              setCurrentPc('');
              setNewPc('');
              setConfirmPc('');
              setShowChangePasscode(true);
            }}>
              <Text style={styles.groupRowTitle}>Change Passcode</Text>
              <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
            </Pressable>

            <View style={styles.groupRowDivider} />

            <Pressable style={styles.groupRow} onPress={logout}>
              <Text style={[styles.groupRowTitle, styles.dangerText]}>Log Out</Text>
            </Pressable>
          </View>
        </View>

        {/* Version */}
        <View style={styles.footer}>
          <Text style={styles.version}>Kamidana v1.0.0</Text>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Made with </Text>
            <Heart size={14} color="#5C8A7A" fill="#5C8A7A" strokeWidth={0} />
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
            {!pushSupported && (
              <View style={styles.settingItem}>
                <Text style={styles.settingDescription}>
                  Push notifications are not supported in this browser. Try using Chrome or Edge.
                </Text>
              </View>
            )}

            {pushSupported && (
              <>
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Push Notifications</Text>
                    <Text style={styles.settingDescription}>
                      Receive alerts for low balances, reports, and reminders
                    </Text>
                  </View>
                  <Switch
                    value={pushEnabled}
                    onValueChange={handleTogglePush}
                    disabled={pushLoading}
                    trackColor={{
                      false: theme.colors.border,
                      true: '#8ac0ae',
                    }}
                    ios_backgroundColor={theme.colors.border}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {pushEnabled && (
                  <View style={styles.settingItem}>
                    <Text style={[styles.settingDescription, { color: '#8ac0ae' }]}>
                      Notifications are enabled. You'll receive alerts for low bucket balances, monthly reports, and spending reminders.
                    </Text>
                  </View>
                )}
              </>
            )}
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
                      console.log(
                        'Reading file:',
                        file.name,
                        'size:',
                        file.size,
                      );
                      const reader = new FileReader();
                      reader.onload = event => {
                        const csvText = event.target?.result as string;
                        console.log(
                          'File read successfully, length:',
                          csvText?.length,
                        );
                        handleImportCSV(csvText);
                      };
                      reader.onerror = error => {
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
                • Date: YYYY-MM-DD format (e.g., 2024-01-15){'\n'}• Bucket: Must
                match your bucket names exactly{'\n'}• Amount: Number without $
                (e.g., 42.50){'\n'}• Note: Description (use quotes if contains
                commas){'\n'}• Happiness Rating: Number from 1-5{'\n'}•
                Category: Optional (e.g., Food & Dining){'\n'}• Merchant:
                Optional (e.g., Whole Foods){'\n'}• Needs vs Wants: Optional -
                "need" or "want"
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Manage Buckets Modal */}
      <Modal
        visible={showManageBuckets}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowManageBuckets(false);
          setCreatingGroup(false);
          setEditingGroupMembership(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              if (creatingGroup) { setCreatingGroup(false); return; }
              if (editingGroupMembership) { setEditingGroupMembership(null); return; }
              setShowManageBuckets(false);
            }}>
              <X size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {creatingGroup ? 'New Group' : editingGroupMembership ? 'Edit Group' : 'Manage Buckets'}
            </Text>
            {!creatingGroup && !editingGroupMembership ? (
              <TouchableOpacity
                onPress={() => {
                  setShowManageBuckets(false);
                  handleAddBucket();
                }}
              >
                <Text style={styles.addButton}>+ Add</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Create Group flow — name + multi-select buckets */}
          {creatingGroup ? (
            <ScrollView style={styles.modalContent}>
              <View style={styles.mbCreateSection}>
                <Text style={styles.mbCreateLabel}>Group name</Text>
                <TextInput
                  style={styles.mbCreateInput}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="e.g. Essentials, Fun, Savings..."
                  placeholderTextColor="#A09686"
                  autoFocus
                />
              </View>

              <View style={styles.mbCreateSection}>
                <Text style={styles.mbCreateLabel}>Select buckets</Text>
                <View style={styles.manageBucketsList}>
                  {allBuckets.map((bucket, i) => {
                    const selected = newGroupSelectedIds.has(bucket._id);
                    const existingGroup = bucket.groupId ? (groups || []).find(g => g._id === bucket.groupId) : null;
                    const isAlreadyGrouped = !!existingGroup;
                    return (
                      <Pressable
                        key={bucket._id}
                        style={[
                          styles.manageBucketRow,
                          i < allBuckets.length - 1 && styles.manageBucketRowBorder,
                          isAlreadyGrouped && { opacity: 0.4 },
                        ]}
                        onPress={() => {
                          if (isAlreadyGrouped) return;
                          const next = new Set(newGroupSelectedIds);
                          if (selected) next.delete(bucket._id); else next.add(bucket._id);
                          setNewGroupSelectedIds(next);
                        }}
                        disabled={isAlreadyGrouped}
                      >
                        <View style={styles.rowLeft}>
                          <View style={[styles.mbCheckbox, selected && styles.mbCheckboxChecked, isAlreadyGrouped && { borderColor: '#C4B9AD' }]}>
                            {selected && <Text style={styles.mbCheckmark}>✓</Text>}
                          </View>
                          <Image
                            source={getCupForBucketId(bucket._id, bucket.icon)}
                            style={styles.bucketCupImage}
                            resizeMode="contain"
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.rowTitle, isAlreadyGrouped && { color: '#A09686' }]}>{bucket.name}</Text>
                            {isAlreadyGrouped && (
                              <Text style={{ fontSize: 12, color: '#B5A999', fontFamily: 'Merchant Copy', marginTop: 1 }}>
                                in {existingGroup.name}
                              </Text>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.mbCreateButton, (!newGroupName.trim() || newGroupSelectedIds.size === 0) && styles.mbCreateButtonDisabled]}
                onPress={async () => {
                  if (!currentUser || !newGroupName.trim() || newGroupSelectedIds.size === 0) return;
                  const groupId = await createGroup({ userId: currentUser._id, name: newGroupName.trim() });
                  for (const bucketId of newGroupSelectedIds) {
                    await assignBucketToGroup({ bucketId: bucketId as any, groupId });
                  }
                  setCreatingGroup(false);
                  setNewGroupName('');
                  setNewGroupSelectedIds(new Set());
                }}
              >
                <Text style={styles.mbCreateButtonText}>
                  Create Group{newGroupSelectedIds.size > 0 ? ` with ${newGroupSelectedIds.size} bucket${newGroupSelectedIds.size > 1 ? 's' : ''}` : ''}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          ) : editingGroupMembership ? (() => {
            // Edit group membership — same multi-select but for an existing group
            const allGroups = groups || [];
            const group = allGroups.find(g => g._id === editingGroupMembership);
            if (!group) return null;
            return (
              <ScrollView style={styles.modalContent}>
                <View style={styles.mbCreateSection}>
                  <Text style={styles.mbCreateLabel}>Group name</Text>
                  {editingGroupId === group._id ? (
                    <TextInput
                      style={styles.mbCreateInput}
                      value={editingGroupName}
                      onChangeText={setEditingGroupName}
                      autoFocus
                      onBlur={async () => {
                        const trimmed = editingGroupName.trim();
                        if (trimmed && trimmed !== group.name) {
                          await updateGroup({ groupId: group._id, name: trimmed });
                        }
                        setEditingGroupId(null);
                      }}
                      onSubmitEditing={async () => {
                        const trimmed = editingGroupName.trim();
                        if (trimmed && trimmed !== group.name) {
                          await updateGroup({ groupId: group._id, name: trimmed });
                        }
                        setEditingGroupId(null);
                      }}
                    />
                  ) : (
                    <Pressable onPress={() => { setEditingGroupId(group._id); setEditingGroupName(group.name); }}>
                      <Text style={styles.mbCreateInputDisplay}>{group.name}</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.mbCreateSection}>
                  <Text style={styles.mbCreateLabel}>Buckets in this group</Text>
                  <View style={styles.manageBucketsList}>
                    {allBuckets.map((bucket, i) => {
                      const selected = editMembershipSelectedIds.has(bucket._id);
                      const otherGroup = bucket.groupId && bucket.groupId !== editingGroupMembership
                        ? (groups || []).find(g => g._id === bucket.groupId)
                        : null;
                      const isInOtherGroup = !!otherGroup;
                      return (
                        <Pressable
                          key={bucket._id}
                          style={[
                            styles.manageBucketRow,
                            i < allBuckets.length - 1 && styles.manageBucketRowBorder,
                            isInOtherGroup && { opacity: 0.4 },
                          ]}
                          onPress={() => {
                            if (isInOtherGroup) return;
                            const next = new Set(editMembershipSelectedIds);
                            if (selected) next.delete(bucket._id); else next.add(bucket._id);
                            setEditMembershipSelectedIds(next);
                          }}
                          disabled={isInOtherGroup}
                        >
                          <View style={styles.rowLeft}>
                            <View style={[styles.mbCheckbox, selected && styles.mbCheckboxChecked, isInOtherGroup && { borderColor: '#C4B9AD' }]}>
                              {selected && <Text style={styles.mbCheckmark}>✓</Text>}
                            </View>
                            <Image
                              source={getCupForBucketId(bucket._id, bucket.icon)}
                              style={styles.bucketCupImage}
                              resizeMode="contain"
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.rowTitle, isInOtherGroup && { color: '#A09686' }]}>{bucket.name}</Text>
                              {isInOtherGroup && (
                                <Text style={{ fontSize: 12, color: '#B5A999', fontFamily: 'Merchant Copy', marginTop: 1 }}>
                                  in {otherGroup.name}
                                </Text>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.mbCreateButton}
                  onPress={async () => {
                    // Assign selected buckets to this group, unassign deselected ones
                    for (const bucket of allBuckets) {
                      const shouldBeInGroup = editMembershipSelectedIds.has(bucket._id);
                      const isInGroup = bucket.groupId === editingGroupMembership;
                      if (shouldBeInGroup && !isInGroup) {
                        await assignBucketToGroup({ bucketId: bucket._id as any, groupId: group._id });
                      } else if (!shouldBeInGroup && isInGroup) {
                        await assignBucketToGroup({ bucketId: bucket._id as any, groupId: undefined });
                      }
                    }
                    setEditingGroupMembership(null);
                    setEditingGroupId(null);
                  }}
                >
                  <Text style={styles.mbCreateButtonText}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mbDeleteGroupButton}
                  onPress={async () => {
                    const bucketCount = allBuckets.filter(b => b.groupId === group._id).length;
                    const msg = bucketCount > 0
                      ? `Delete "${group.name}"?\n\n${bucketCount} bucket${bucketCount > 1 ? 's' : ''} will be ungrouped.`
                      : `Delete "${group.name}"?`;
                    if (!confirm(msg)) return;
                    await removeGroup({ groupId: group._id });
                    setEditingGroupMembership(null);
                  }}
                >
                  <Text style={styles.mbDeleteGroupText}>Delete Group</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            );
          })() : (
            /* Main bucket list view */
            <ScrollView style={styles.modalContent}>
              {allBuckets.length === 0 ? (
                <View style={styles.manageBucketsEmpty}>
                  <Text style={styles.manageBucketsEmptyText}>
                    No buckets yet
                  </Text>
                  <Text style={styles.manageBucketsEmptySubtext}>
                    Create your first bucket to start budgeting
                  </Text>
                </View>
              ) : (() => {
                const allGroups = groups || [];
                const groupBuckets = new Map<string, Bucket[]>();
                const ungrouped: Bucket[] = [];
                for (const g of allGroups) {
                  groupBuckets.set(g._id, []);
                }
                for (const bucket of allBuckets) {
                  if (bucket.groupId && groupBuckets.has(bucket.groupId)) {
                    groupBuckets.get(bucket.groupId)!.push(bucket);
                  } else {
                    ungrouped.push(bucket);
                  }
                }

                const renderBucketRow = (bucket: Bucket, isLast: boolean) => (
                  <SwipeableRow
                    key={bucket._id}
                    onDelete={() => handleDeleteBucket(bucket)}
                    containerStyle={styles.swipeableCompact}
                  >
                    <Pressable
                      style={[
                        styles.manageBucketRow,
                        !isLast && styles.manageBucketRowBorder,
                      ]}
                      onPress={() => {
                        setShowManageBuckets(false);
                        handleEditBucket(bucket);
                      }}
                    >
                      <View style={styles.rowLeft}>
                        <Image
                          source={getCupForBucketId(bucket._id, bucket.icon)}
                          style={styles.bucketCupImage}
                          resizeMode="contain"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{bucket.name}</Text>
                          <Text style={styles.rowSubtitle}>
                            {bucket.bucketMode === 'save'
                              ? bucket.contributionType === 'percentage'
                                ? `${bucket.contributionPercent || 0}% of income · goal $${(bucket.targetAmount || 0).toLocaleString()}`
                                : bucket.contributionAmount
                                  ? `$${bucket.contributionAmount.toLocaleString()} per month · goal $${(bucket.targetAmount || 0).toLocaleString()}`
                                  : `goal $${(bucket.targetAmount || 0).toLocaleString()}`
                              : bucket.allocationType === 'percentage'
                                ? `${bucket.plannedPercent || 0}% per month`
                                : `$${(bucket.plannedAmount || 0).toLocaleString()} per month`}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={20} color="#d1d1d6" strokeWidth={2} />
                    </Pressable>
                  </SwipeableRow>
                );

                return (
                  <View>
                    {/* Groups */}
                    {allGroups.map(group => {
                      const buckets = groupBuckets.get(group._id) || [];
                      return (
                        <View key={group._id} style={styles.mbGroupCard}>
                          <Pressable
                            style={styles.mbGroupHeader}
                            onPress={() => {
                              setEditingGroupMembership(group._id);
                              const memberIds = new Set(
                                allBuckets.filter(b => b.groupId === group._id).map(b => b._id)
                              );
                              setEditMembershipSelectedIds(memberIds);
                            }}
                          >
                            <Text style={styles.mbGroupName}>{group.name}</Text>
                            <Text style={styles.mbGroupCount}>{buckets.length}</Text>
                          </Pressable>
                          {buckets.map((bucket, i) => renderBucketRow(bucket, i === buckets.length - 1))}
                        </View>
                      );
                    })}

                    {/* Ungrouped buckets */}
                    {ungrouped.length > 0 && (
                      <View style={styles.manageBucketsList}>
                        {allGroups.length > 0 && (
                          <View style={styles.mbUngroupedHeader}>
                            <Text style={styles.mbUngroupedLabel}>Ungrouped</Text>
                          </View>
                        )}
                        {ungrouped.map((bucket, i) => renderBucketRow(bucket, i === ungrouped.length - 1))}
                      </View>
                    )}

                    {/* New Group button */}
                    <TouchableOpacity
                      style={styles.mbAddGroup}
                      onPress={() => {
                        setNewGroupName('');
                        setNewGroupSelectedIds(new Set());
                        setCreatingGroup(true);
                      }}
                    >
                      <FolderPlus size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                      <Text style={styles.mbAddGroupText}>New Group</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
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

      {/* Change Passcode Modal */}
      <Modal
        visible={showChangePasscode}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowChangePasscode(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChangePasscode(false)}>
              <X size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Passcode</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={styles.settingTitle}>Current Passcode</Text>
              <TextInput
                style={styles.textInputField}
                value={currentPc}
                onChangeText={(t) => { setCurrentPc(t.replace(/[^0-9]/g, '').slice(0, 6)); setPcError(''); }}
                placeholder="Enter current 6-digit passcode"
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <View>
              <Text style={styles.settingTitle}>New Passcode</Text>
              <TextInput
                style={styles.textInputField}
                value={newPc}
                onChangeText={(t) => { setNewPc(t.replace(/[^0-9]/g, '').slice(0, 6)); setPcError(''); }}
                placeholder="6 digits"
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <View>
              <Text style={styles.settingTitle}>Confirm New Passcode</Text>
              <TextInput
                style={styles.textInputField}
                value={confirmPc}
                onChangeText={(t) => { setConfirmPc(t.replace(/[^0-9]/g, '').slice(0, 6)); setPcError(''); }}
                placeholder="Repeat new passcode"
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            {pcError !== '' && (
              <Text style={{ color: '#C0392B', fontSize: 14, fontFamily: 'DM Sans' }}>{pcError}</Text>
            )}

            <TouchableOpacity
              style={[styles.saveButton, pcSubmitting && { opacity: 0.5 }]}
              onPress={handleChangePasscode}
              disabled={pcSubmitting}
            >
              <Text style={styles.saveButtonText}>
                {pcSubmitting ? 'Saving...' : 'Update Passcode'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
  loadingWrapper: {
    flex: 1,
    backgroundColor: '#EAE3D5',
    minHeight: '100vh' as any,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#3D3229',
    fontFamily: 'Merchant',
    letterSpacing: -1.2,
  },
  section: {
    marginBottom: 24,
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
    fontSize: 15,
    color: '#5C8A7A',
    fontWeight: '500',
    fontFamily: 'Merchant',
    lineHeight: 15,
  },
  addButton: {
    fontSize: 15,
    color: '#5C8A7A',
    fontWeight: '500',
    fontFamily: 'Merchant',
    lineHeight: 15,
  },
  row: {
    backgroundColor: '#F5F0E7',
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
    backgroundColor: '#F5F0E7',
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
  bucketCupImage: {
    width: 28,
    height: 28,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 20,
    color: '#3D3229',
    fontWeight: '400',
    fontFamily: 'Merchant',
  },
  rowSubtitle: {
    fontSize: 17,
    color: '#7A6E62',
    fontFamily: 'Merchant Copy',
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
    fontSize: 15,
    color: '#7A6E62',
    fontFamily: 'Merchant',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 15,
    color: '#7A6E62',
    fontFamily: 'Merchant',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant',
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
    fontSize: 16,
    fontFamily: 'Merchant',
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
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
  },
  exportDescription: {
    fontSize: 18,
    fontFamily: 'Merchant',
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
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 4,
  },
  exportOptionDescription: {
    fontSize: 15,
    fontFamily: 'Merchant',
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
    fontSize: 18,
    fontFamily: 'Merchant',
    color: theme.colors.text,
    marginBottom: 8,
  },
  importInstructionsText: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  dangerText: {
    color: '#FF3B30',
  },
  bucketStackPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bucketStackImage: {
    width: 22,
    height: 22,
  },
  swipeableCompact: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
  },
  manageBucketsList: {
    backgroundColor: '#F5F0E7',
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  manageBucketRow: {
    backgroundColor: '#F5F0E7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    cursor: 'pointer' as any,
  },
  manageBucketRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8C8',
  },
  manageBucketsEmpty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  manageBucketsEmptyText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#3D3229',
    fontFamily: 'Merchant',
  },
  manageBucketsEmptySubtext: {
    fontSize: 16,
    color: '#7A6E62',
    fontFamily: 'Merchant',
  },
  // Manage Buckets — group sections
  mbGroupCard: {
    backgroundColor: '#F5F0E7',
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  mbGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8C8',
  },
  mbGroupName: {
    fontSize: 15,
    color: '#7A6E62',
    fontFamily: 'Merchant',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mbGroupNameInput: {
    fontSize: 15,
    color: '#3D3229',
    fontFamily: 'Merchant',
    fontWeight: '500',
    flex: 1,
    paddingVertical: 0,
    outlineStyle: 'none' as any,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3229',
  },
  mbGroupDelete: {
    padding: 4,
    marginLeft: 8,
  },
  mbGroupEmpty: {
    fontSize: 15,
    color: '#A09686',
    fontFamily: 'Merchant',
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mbUngroupedHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8C8',
  },
  mbUngroupedLabel: {
    fontSize: 15,
    color: '#7A6E62',
    fontFamily: 'Merchant',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mbAddGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5CFC4',
    borderStyle: 'dashed',
  },
  mbAddGroupText: {
    fontSize: 16,
    color: '#7A6E62',
    fontFamily: 'Merchant',
  },
  mbGroupCount: {
    fontSize: 15,
    color: '#A09686',
    fontFamily: 'Merchant Copy',
  },
  // Create/edit group flow
  mbCreateSection: {
    marginTop: 20,
  },
  mbCreateLabel: {
    fontSize: 15,
    color: '#7A6E62',
    fontFamily: 'Merchant',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  mbCreateInput: {
    fontSize: 18,
    color: '#3D3229',
    fontFamily: 'Merchant',
    backgroundColor: '#F5F0E7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    outlineStyle: 'none' as any,
  },
  mbCreateInputDisplay: {
    fontSize: 18,
    color: '#3D3229',
    fontFamily: 'Merchant',
    backgroundColor: '#F5F0E7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden' as any,
  },
  mbCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C8C0B4',
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    marginRight: 10,
  },
  mbCheckboxChecked: {
    backgroundColor: '#3D3229',
    borderColor: '#3D3229',
  },
  mbCheckmark: {
    fontSize: 15,
    color: '#FAF8F4',
    fontWeight: '700',
    lineHeight: 15,
  },
  mbCreateButton: {
    backgroundColor: '#3D3229',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as any,
    marginTop: 24,
  },
  mbCreateButtonDisabled: {
    opacity: 0.4,
  },
  mbCreateButtonText: {
    fontSize: 17,
    color: '#FAF8F4',
    fontFamily: 'Merchant',
    fontWeight: '500',
  },
  mbDeleteGroupButton: {
    alignItems: 'center' as any,
    paddingVertical: 14,
    marginTop: 12,
  },
  mbDeleteGroupText: {
    fontSize: 16,
    color: '#C0564E',
    fontFamily: 'Merchant',
  },
  // Group card styles (settings main page)
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
    fontFamily: 'Merchant Copy',
    marginTop: 2,
  },
  groupRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0D8C8',
    marginHorizontal: 18,
  },
  textInputField: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0D8C8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'DM Sans',
    color: '#1A1A1A',
    marginTop: 6,
  },
  saveButton: {
    backgroundColor: '#5C8A7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
    fontFamily: 'Merchant',
  },
});
