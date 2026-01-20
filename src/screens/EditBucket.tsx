import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
// Navigation imports handled conditionally below
import type { RouteProp } from '@react-navigation/native';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import type { Bucket } from '../types';

type EditBucketRouteProp = RouteProp<{ EditBucket: { bucket: Bucket } }, 'EditBucket'>;

interface EditBucketProps {
  visible?: boolean;
  bucket?: Bucket;
  onClose?: () => void;
}

export const EditBucket: React.FC<EditBucketProps> = (props) => {
  // Safely get navigation (will be null on web)
  let route: any = null;
  let navigation: any = null;

  try {
    const { useRoute, useNavigation } = require('@react-navigation/native');
    route = useRoute<EditBucketRouteProp>();
    navigation = useNavigation();
  } catch (error) {
    // Not in navigation context (web) - use props instead
  }

  // Support both prop-based (web/modal) and route-based (mobile navigation) usage
  const bucket = props.bucket || route?.params?.bucket;
  const visible = props.visible !== undefined ? props.visible : true;
  const onClose = props.onClose || (() => navigation?.goBack());

  if (!bucket) {
    return null;
  }

  const bucketMode = bucket.bucketMode || 'spend'; // Default to spend for legacy buckets
  const [name, setName] = useState(bucket.name);
  const [allocationType, setAllocationType] = useState<'amount' | 'percentage'>(
    bucket.allocationType || 'amount'
  );
  const [allocationValue, setAllocationValue] = useState(
    (bucket.plannedAmount || bucket.plannedPercent || bucket.allocationValue || 0).toString()
  );
  const [targetAmount, setTargetAmount] = useState(
    (bucket.targetAmount || 0).toString()
  );
  const [alertThreshold, setAlertThreshold] = useState(
    bucket.alertThreshold.toString()
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateBucket = useMutation(api.buckets.update);
  const removeBucket = useMutation(api.buckets.remove);

  const isValid = bucketMode === 'spend'
    ? name.trim() &&
      allocationValue &&
      parseFloat(allocationValue) > 0 &&
      alertThreshold &&
      parseFloat(alertThreshold) >= 0 &&
      parseFloat(alertThreshold) <= 100
    : name.trim() &&
      targetAmount &&
      parseFloat(targetAmount) > 0 &&
      alertThreshold &&
      parseFloat(alertThreshold) >= 0 &&
      parseFloat(alertThreshold) <= 100;

  const handleSave = async () => {
    if (!isValid) {
      alert('Please fill in all fields correctly');
      return;
    }

    try {
      const baseParams = {
        bucketId: bucket._id as any,
        name: name.trim(),
        bucketMode,
        alertThreshold: parseFloat(alertThreshold),
        color: bucket.color,
      };

      let updateParams;
      if (bucketMode === 'spend') {
        updateParams = {
          ...baseParams,
          allocationType,
          ...(allocationType === 'amount'
            ? { plannedAmount: parseFloat(allocationValue) }
            : { plannedPercent: parseFloat(allocationValue) }
          ),
        };
      } else {
        updateParams = {
          ...baseParams,
          targetAmount: parseFloat(targetAmount),
        };
      }

      await updateBucket(updateParams);

      alert(`Bucket "${name}" updated successfully!`);

      // Close modal or navigate back
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to update bucket:', error);
      alert(error.message || 'Failed to update bucket. Please try again.');
    }
  };

  const handleDelete = () => {
    // Always show custom modal for better web compatibility
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);

    try {
      await removeBucket({ bucketId: bucket._id as any });

      alert(`Bucket "${bucket.name}" deleted successfully`);

      // Close modal or navigate back
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to delete bucket:', error);
      alert(error.message || 'Failed to delete bucket. Please try again.');
    }
  };

  const content = (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Bucket</Text>
          <TouchableOpacity onPress={handleSave} disabled={!isValid}>
            <Text
              style={[
                styles.saveButton,
                !isValid && styles.saveButtonDisabled,
              ]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bucket Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Bucket Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={bucketMode === 'spend' ? 'e.g., Groceries' : 'e.g., Emergency Fund'}
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Bucket Type (read-only) */}
        <View style={styles.section}>
          <Text style={styles.label}>Bucket Type</Text>
          <View style={styles.readOnlyContainer}>
            <Text style={styles.readOnlyText}>
              {bucketMode === 'spend' ? 'Spend Bucket' : 'Save Bucket'}
            </Text>
          </View>
          <Text style={styles.helperText}>
            {bucketMode === 'spend'
              ? 'Track monthly spending against a budget'
              : 'Save toward a specific goal'}
          </Text>
        </View>

        {/* Allocation Type (Spend mode only) */}
        {bucketMode === 'spend' && (
        <View style={styles.section}>
          <Text style={styles.label}>Allocation Type</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segment,
                allocationType === 'amount' && styles.segmentActive,
              ]}
              onPress={() => setAllocationType('amount')}>
              <Text
                style={[
                  styles.segmentText,
                  allocationType === 'amount' && styles.segmentTextActive,
                ]}>
                Fixed Amount
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                allocationType === 'percentage' && styles.segmentActive,
              ]}
              onPress={() => setAllocationType('percentage')}>
              <Text
                style={[
                  styles.segmentText,
                  allocationType === 'percentage' && styles.segmentTextActive,
                ]}>
                Percentage
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Allocation Value (Spend mode only) */}
        {bucketMode === 'spend' && (
        <View style={styles.section}>
          <Text style={styles.label}>
            {allocationType === 'amount' ? 'Amount per Month' : 'Percentage of Income'}
          </Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>
              {allocationType === 'amount' ? '$' : '%'}
            </Text>
            <TextInput
              style={styles.amountInput}
              value={allocationValue}
              onChangeText={setAllocationValue}
              keyboardType="decimal-pad"
              placeholder={allocationType === 'amount' ? '0.00' : '0'}
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
        </View>
        )}

        {/* Target Amount (Save mode only) */}
        {bucketMode === 'save' && (
        <View style={styles.section}>
          <Text style={styles.label}>Target Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={targetAmount}
              onChangeText={setTargetAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
          <Text style={styles.hint}>
            How much do you want to save in this bucket?
          </Text>
        </View>
        )}

        {/* Alert Threshold */}
        <View style={styles.section}>
          <Text style={styles.label}>Low Balance Alert (%)</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>%</Text>
            <TextInput
              style={styles.amountInput}
              value={alertThreshold}
              onChangeText={setAlertThreshold}
              keyboardType="decimal-pad"
              placeholder="20"
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
          <Text style={styles.hint}>
            Alert when {alertThreshold || '0'}% of budget is spent
          </Text>
        </View>

        {/* Current Balance Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Current Balance</Text>
          <Text style={styles.infoValue}>${(bucket.currentBalance || 0).toFixed(2)}</Text>
        </View>

        {/* Delete Button */}
        <View style={styles.deleteSection}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Bucket</Text>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>
            This action cannot be undone
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Bucket?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete "{bucket.name}"?
              {(bucket.currentBalance || 0) > 0 && ` This bucket has $${(bucket.currentBalance || 0).toFixed(2)} remaining.`}
              {' '}This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={confirmDelete}>
                <Text style={styles.modalButtonTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // If visible prop is provided (web), wrap in Modal
  if (onClose) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}>
        {content}
      </Modal>
    );
  }

  // Otherwise return content directly (native navigation)
  return content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
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
  title: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  cancelButton: {
    fontSize: 14,
    color: theme.colors.primary,
    fontFamily: getFontFamily('regular'),
  },
  saveButton: {
    fontSize: 14,
    color: theme.colors.primary,
    fontFamily: getFontFamily('bold'),
  },
  saveButtonDisabled: {
    color: theme.colors.textTertiary,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: 20,
    padding: 18,
  },
  label: {
    fontSize: 13,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: getFontFamily('regular'),
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
  },
  segmentTextActive: {
    color: theme.colors.textOnPrimary,
    fontFamily: getFontFamily('bold'),
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant Copy, monospace',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '400',
    color: theme.colors.text,
    fontFamily: 'Merchant Copy, monospace',
    paddingVertical: 12,
    minHeight: 24,
  },
  hint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    marginTop: 8,
  },
  readOnlyContainer: {
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  readOnlyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
  },
  infoSection: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: theme.colors.purple100,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: theme.colors.primary,
  },
  deleteSection: {
    marginHorizontal: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textOnPrimary,
  },
  deleteHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: getFontFamily('regular'),
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.border,
  },
  modalButtonDelete: {
    backgroundColor: theme.colors.danger,
  },
  modalButtonTextCancel: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  modalButtonTextDelete: {
    fontSize: 14,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textOnPrimary,
  },
});
