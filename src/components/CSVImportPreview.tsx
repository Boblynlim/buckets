import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { X, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react-native';
import type { Bucket } from '../types';
import type { CSVExpense } from '../utils/csvExport';
import { getCupForBucketId } from '../constants/bucketIcons';

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

  // Update local state when parsedExpenses prop changes
  useEffect(() => {
    console.log('CSVImportPreview: parsedExpenses changed, count:', parsedExpenses.length);
    setExpenses(parsedExpenses);
  }, [parsedExpenses]);

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

  // Float invalid rows to the top so the user can fix them without scrolling.
  // Each row keeps its original index so bucket edits patch the right expense.
  const orderedRows = expenses
    .map((expense, originalIndex) => ({
      expense,
      originalIndex,
      error: validationErrors[originalIndex],
    }))
    .sort((a, b) => {
      if ((a.error !== null) === (b.error !== null)) return a.originalIndex - b.originalIndex;
      return a.error !== null ? -1 : 1;
    });

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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#2D2D2D" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Import</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Banner */}
        <View style={[styles.statusBanner, hasErrors ? styles.errorBanner : styles.successBanner]}>
          {hasErrors ? (
            <>
              <AlertCircle size={18} color="#DC2626" strokeWidth={2} />
              <Text style={styles.statusText}>
                {errorCount} {errorCount === 1 ? 'transaction has' : 'transactions have'} invalid bucket{errorCount === 1 ? '' : 's'}. Fix {errorCount === 1 ? 'it' : 'them'} below.
              </Text>
            </>
          ) : (
            <>
              <CheckCircle size={18} color="#10B981" strokeWidth={2} />
              <Text style={styles.statusText}>
                All {expenses.length} transaction{expenses.length === 1 ? '' : 's'} ready to import
              </Text>
            </>
          )}
        </View>

        {/* Scrollable Content Wrapper */}
        <View style={styles.scrollWrapper}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
          {orderedRows.map(({ expense, originalIndex, error }) => {
            const index = originalIndex;
            const hasError = error !== null;
            const isDropdownOpen = showDropdownForIndex === index;

            return (
              <View key={index} style={styles.expenseRow}>
                <View style={styles.expenseHeader}>
                  <Text style={styles.expenseDate}>{expense.date}</Text>
                  <Text style={styles.expenseAmount}>${expense.amount.toFixed(2)}</Text>
                </View>

                <Text style={styles.expenseNote}>{expense.note}</Text>

                {/* Tags */}
                <View style={styles.tagsRow}>
                  {expense.isNecessary ? (
                    <View style={styles.necessaryTag}>
                      <Text style={styles.necessaryTagText}>NECESSARY</Text>
                    </View>
                  ) : (
                    <View style={expense.worthIt ? styles.worthItTag : styles.notWorthItTag}>
                      <Text style={expense.worthIt ? styles.worthItTagText : styles.notWorthItTagText}>
                        {expense.worthIt ? 'WORTH IT' : 'NOT WORTH IT'}
                      </Text>
                    </View>
                  )}
                </View>

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
                    <ChevronDown
                      size={14}
                      color={hasError ? '#DC2626' : '#8A8478'}
                      strokeWidth={2}
                    />
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
                        <Image
                          source={getCupForBucketId(bucket._id, bucket.icon)}
                          style={styles.bucketCup}
                          resizeMode="contain"
                        />
                        <Text style={styles.dropdownItemText}>{bucket.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          </ScrollView>
        </View>

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
              Import {expenses.length} Transaction{expenses.length === 1 ? '' : 's'}
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
    backgroundColor: '#EAE3D5',
    height: '100vh' as any,
    display: 'flex' as any,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexShrink: 0,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: '#3D3229',
    fontFamily: 'Merchant',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 10,
    flexShrink: 0,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
  },
  successBanner: {
    backgroundColor: '#ECFDF5',
  },
  statusText: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Merchant',
    color: '#2D2D2D',
    lineHeight: 21,
  },
  scrollWrapper: {
    flex: 1,
    overflow: 'hidden' as any,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 300,
    overflow: 'visible' as any,
  },
  expenseRow: {
    backgroundColor: '#F5F0E7',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'visible' as any,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  expenseDate: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#8A8478',
  },
  expenseAmount: {
    fontSize: 22,
    fontFamily: 'Merchant Copy',
    color: '#2D2D2D',
    fontWeight: '500',
    letterSpacing: 0,
  },
  expenseNote: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: '#2D2D2D',
    marginBottom: 12,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  worthItTag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#a0d0c0',
    borderWidth: 1,
    borderColor: '#8ac4b2',
  },
  worthItTagText: {
    fontSize: 11,
    fontFamily: 'Merchant',
    fontWeight: '600',
    letterSpacing: 0.6,
    color: '#245045',
  },
  notWorthItTag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(212,184,154,0.3)',
    borderWidth: 1,
    borderColor: '#c9a882',
  },
  notWorthItTagText: {
    fontSize: 11,
    fontFamily: 'Merchant',
    fontWeight: '600',
    letterSpacing: 0.6,
    color: '#a08060',
  },
  necessaryTag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(61,50,41,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(61,50,41,0.15)',
  },
  necessaryTagText: {
    fontSize: 11,
    fontFamily: 'Merchant',
    fontWeight: '600',
    letterSpacing: 0.6,
    color: 'rgba(61,50,41,0.4)',
  },
  bucketSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bucketLabel: {
    fontSize: 17,
    fontFamily: 'Merchant',
    color: '#8A8478',
  },
  bucketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bucketPillError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  bucketText: {
    fontSize: 17,
    fontFamily: 'Merchant',
    color: '#2D2D2D',
  },
  bucketTextError: {
    color: '#DC2626',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#DC2626',
    marginTop: 10,
    fontStyle: 'italic',
  },
  dropdown: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bucketCup: {
    width: 28,
    height: 28,
  },
  dropdownItemText: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: '#2D2D2D',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#EAE3D5',
    flexShrink: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#E8E6E3',
  },
  cancelButtonText: {
    fontSize: 18,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: '#8A8478',
  },
  importButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#5C8A7A',
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: 18,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
