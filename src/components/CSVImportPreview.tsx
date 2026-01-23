import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { X, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react-native';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import type { Bucket } from '../types';
import type { CSVExpense } from '../utils/csvExport';

interface CSVImportPreviewProps {
  visible: boolean;
  parsedExpenses: CSVExpense[];
  availableBuckets: Bucket[];
  onClose: () => void;
  onConfirmImport: (expenses: CSVExpense[]) => void;
}

export const CSVImportPreview: React.FC<CSVImportPreviewProps> = ({
  visible,
  parsedExpenses,
  availableBuckets,
  onClose,
  onConfirmImport,
}) => {
  const [expenses, setExpenses] = useState<CSVExpense[]>(parsedExpenses);
  const [showDropdownForIndex, setShowDropdownForIndex] = useState<number | null>(null);

  // Check which buckets don't exist (normalize with lowercase and trim)
  const bucketNameMap = new Map(availableBuckets.map(b => [b.name.toLowerCase().trim(), b.name]));

  const validationErrors = expenses.map((exp, idx) => {
    const normalizedBucketName = exp.bucket.toLowerCase().trim();
    const bucketExists = bucketNameMap.has(normalizedBucketName);
    if (!bucketExists) {
      console.log(`Bucket not found: "${exp.bucket}" (normalized: "${normalizedBucketName}")`);
      console.log('Available buckets:', Array.from(bucketNameMap.keys()));
    }
    return bucketExists ? null : `Bucket "${exp.bucket}" not found`;
  });

  const hasErrors = validationErrors.some(e => e !== null);
  const errorCount = validationErrors.filter(e => e !== null).length;

  const handleBucketChange = (index: number, newBucketName: string) => {
    const newExpenses = [...expenses];
    newExpenses[index] = { ...newExpenses[index], bucket: newBucketName };
    setExpenses(newExpenses);
    setShowDropdownForIndex(null);
  };

  const handleImport = () => {
    onConfirmImport(expenses);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Import</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Banner */}
        <View style={[styles.statusBanner, hasErrors ? styles.errorBanner : styles.successBanner]}>
          {hasErrors ? (
            <>
              <AlertCircle size={20} color="#DC2626" strokeWidth={2} />
              <Text style={styles.statusText}>
                {errorCount} {errorCount === 1 ? 'transaction has' : 'transactions have'} invalid bucket{errorCount === 1 ? '' : 's'}. Fix {errorCount === 1 ? 'it' : 'them'} below.
              </Text>
            </>
          ) : (
            <>
              <CheckCircle size={20} color="#10B981" strokeWidth={2} />
              <Text style={styles.statusText}>
                All {expenses.length} transactions ready to import
              </Text>
            </>
          )}
        </View>

        {/* Preview List */}
        <ScrollView style={styles.scrollView}>
          {expenses.map((expense, index) => {
            const hasError = validationErrors[index] !== null;
            const isDropdownOpen = showDropdownForIndex === index;

            return (
              <View key={index} style={styles.expenseRow}>
                <View style={styles.expenseHeader}>
                  <Text style={styles.expenseDate}>{expense.date}</Text>
                  <Text style={styles.expenseAmount}>${expense.amount.toFixed(2)}</Text>
                </View>

                <Text style={styles.expenseNote}>{expense.note}</Text>

                {/* Bucket Selector */}
                <View style={styles.bucketSelector}>
                  <Text style={styles.bucketLabel}>Bucket:</Text>
                  <Pressable
                    style={[
                      styles.bucketPill,
                      hasError && styles.bucketPillError,
                    ]}
                    onPress={() => setShowDropdownForIndex(isDropdownOpen ? null : index)}
                  >
                    <Text style={[styles.bucketText, hasError && styles.bucketTextError]}>
                      {expense.bucket}
                    </Text>
                    <ChevronDown size={16} color={hasError ? '#DC2626' : theme.colors.textSecondary} strokeWidth={2} />
                  </Pressable>
                </View>

                {hasError && (
                  <Text style={styles.errorText}>{validationErrors[index]}</Text>
                )}

                {/* Dropdown */}
                {isDropdownOpen && (
                  <View style={styles.dropdown}>
                    {availableBuckets.map((bucket) => (
                      <TouchableOpacity
                        key={bucket._id}
                        style={styles.dropdownItem}
                        onPress={() => handleBucketChange(index, bucket.name)}
                      >
                        <View style={[styles.bucketDot, { backgroundColor: bucket.color }]} />
                        <Text style={styles.dropdownItemText}>{bucket.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importButton, hasErrors && styles.importButtonDisabled]}
            onPress={handleImport}
            disabled={hasErrors}
          >
            <Text style={styles.importButtonText}>
              Import {expenses.length} {expenses.length === 1 ? 'Transaction' : 'Transactions'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
  },
  successBanner: {
    backgroundColor: '#ECFDF5',
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  expenseRow: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseDate: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  expenseAmount: {
    fontSize: 18,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.text,
    fontWeight: '500',
  },
  expenseNote: {
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    marginBottom: 12,
  },
  bucketSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bucketLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
  },
  bucketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.purple100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bucketPillError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  bucketText: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
  },
  bucketTextError: {
    color: '#DC2626',
  },
  errorText: {
    fontSize: 13,
    fontFamily: getFontFamily('regular'),
    color: '#DC2626',
    marginTop: 8,
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  bucketDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textSecondary,
  },
  importButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: '#FFFFFF',
  },
});
