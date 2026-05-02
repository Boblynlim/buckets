import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Pressable,
} from 'react-native';
// Navigation imports handled conditionally below
import type { RouteProp } from '@react-navigation/native';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import type { Bucket } from '../types';
import { Drawer } from '../components/Drawer';
import { getCupForBucketId } from '../constants/bucketIcons';

type EditBucketRouteProp = RouteProp<{ EditBucket: { bucket: Bucket } }, 'EditBucket'>;

interface EditBucketProps {
  visible?: boolean;
  bucket?: Bucket;
  suggestedAmount?: number;
  onClose?: () => void;
}

export const EditBucket: React.FC<EditBucketProps> = (props) => {
  // Safely get navigation (will be null on web)
  let route: any = null;
  let navigation: any = null;

  try {
    const { useRoute, useNavigation } = require('@react-navigation/native');
    route = useRoute() as EditBucketRouteProp;
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

  const initialMode = bucket.bucketMode || 'spend';
  const [bucketMode, setBucketMode] = useState<'spend' | 'save' | 'recurring'>(initialMode);
  const bucketType = bucketMode === 'recurring' ? 'bill' : bucketMode === 'save' ? 'goal' : 'budget';
  const isModeChanged = bucketMode !== initialMode;
  const [name, setName] = useState(bucket.name);
  const [allocationType, setAllocationType] = useState<'amount' | 'percentage'>(
    bucket.allocationType || 'amount'
  );
  const [allocationValue, setAllocationValue] = useState(
    (props.suggestedAmount !== undefined ? props.suggestedAmount : (bucket.plannedAmount || bucket.plannedPercent || bucket.allocationValue || 0)).toString()
  );
  const [targetAmount, setTargetAmount] = useState(
    (bucket.targetAmount || 0).toString()
  );
  const [contributionType, setContributionType] = useState<'amount' | 'percentage' | 'none'>(
    bucket.contributionType || 'none'
  );
  const [contributionValue, setContributionValue] = useState(
    (initialMode === 'save' && props.suggestedAmount !== undefined ? props.suggestedAmount : (bucket.contributionAmount || bucket.contributionPercent || 0)).toString()
  );

  // Switching type wipes balances on the backend, so reset the input defaults
  // for the new mode rather than carrying over values from the old one.
  const handleChangeMode = (next: 'spend' | 'save' | 'recurring') => {
    if (next === bucketMode) return;
    setBucketMode(next);
    if (next === 'spend' || next === 'recurring') {
      // Default to a fixed-dollar allocation; user can switch to %.
      setAllocationType(next === initialMode ? (bucket.allocationType || 'amount') : 'amount');
      setAllocationValue(
        next === initialMode
          ? (bucket.plannedAmount || bucket.plannedPercent || bucket.allocationValue || 0).toString()
          : ''
      );
    } else {
      setTargetAmount(
        next === initialMode ? (bucket.targetAmount || 0).toString() : ''
      );
      setContributionType(
        next === initialMode ? (bucket.contributionType || 'none') : 'none'
      );
      setContributionValue(
        next === initialMode
          ? (bucket.contributionAmount || bucket.contributionPercent || 0).toString()
          : ''
      );
    }
  };
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(
    bucket.alertThreshold.toString()
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateBucket = useMutation(api.buckets.update);
  const removeBucket = useMutation(api.buckets.remove);

  const inputTarget = parseFloat(targetAmount) || 0;
  const inputContribution = parseFloat(contributionValue) || 0;

  const isValid = bucketMode === 'spend' || bucketMode === 'recurring'
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
      parseFloat(alertThreshold) <= 100 &&
      (contributionType === 'none' || (contributionValue && parseFloat(contributionValue) > 0));

  const handleSave = async () => {
    if (isSaving) return;
    if (!isValid) {
      alert('Please fill in all fields correctly');
      return;
    }

    try {
      setIsSaving(true);

      const baseParams: any = {
        bucketId: bucket._id as any,
        name: name.trim(),
        alertThreshold: parseFloat(alertThreshold),
        color: bucket.color,
      };

      // Only send bucketMode when it has actually changed — the backend uses
      // a mode change to clear opposite-mode fields and reset balances.
      if (isModeChanged) {
        baseParams.bucketMode = bucketMode;
      }

      let updateParams;
      if (bucketMode === 'spend' || bucketMode === 'recurring') {
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
          contributionType,
          ...(contributionType === 'amount' && { contributionAmount: parseFloat(contributionValue) }),
          ...(contributionType === 'percentage' && { contributionPercent: parseFloat(contributionValue) }),
        };
      }

      await updateBucket(updateParams);
      setIsSaving(false);
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Failed to update bucket:', error);
      alert(error.message || 'Failed to update bucket. Please try again.');
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await removeBucket({ bucketId: bucket._id as any });
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Failed to delete bucket:', error);
      alert(error.message || 'Failed to delete bucket. Please try again.');
    }
  };

  const content = (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Cup</Text>
          <TouchableOpacity onPress={handleSave} disabled={!isValid || isSaving}>
            <Text style={[styles.saveButton, (!isValid || isSaving) && styles.saveButtonDisabled]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cup Preview */}
        <View style={styles.cupPreview}>
          <Image
            source={getCupForBucketId(bucket._id, bucket.icon)}
            style={styles.cupImage}
            resizeMode="contain"
          />
        </View>

        {/* Name Input */}
        <View style={styles.nameSection}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="name this cup..."
            placeholderTextColor="rgba(61,50,41,0.2)"
            textAlign="center"
          />
        </View>

        {/* Type Pills */}
        <View style={styles.typeRow}>
          {(['bill', 'budget', 'goal'] as const).map((t) => {
            const mode = t === 'bill' ? 'recurring' : t === 'budget' ? 'spend' : 'save';
            return (
              <Pressable
                key={t}
                style={[styles.typePill, bucketType === t && styles.typePillActive]}
                onPress={() => handleChangeMode(mode)}
              >
                <Text style={[styles.typePillText, bucketType === t && styles.typePillTextActive]}>
                  {t === 'bill' ? 'BILL' : t === 'budget' ? 'BUDGET' : 'GOAL'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.typeHelper}>
          {bucketMode === 'spend'
            ? 'flexible spending — track against a monthly limit'
            : bucketMode === 'save'
            ? 'save toward a target amount over time'
            : 'fixed monthly expense — same amount each time'}
        </Text>
        {isModeChanged && (
          <Text style={styles.modeChangeWarning}>
            switching type will reset this cup's balance
          </Text>
        )}

        {/* Amount Fields — Spend / Recurring */}
        {(bucketMode === 'spend' || bucketMode === 'recurring') && (
          <View style={styles.amountSection}>
            <View style={styles.amountRow}>
              <Text style={styles.amountCurrency}>
                {allocationType === 'amount' ? '$' : '%'}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={allocationValue}
                onChangeText={setAllocationValue}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="rgba(61,50,41,0.15)"
              />
              <Text style={styles.amountSuffix}>
                {allocationType === 'amount' ? '/ month' : '% of income'}
              </Text>
            </View>

            {/* Allocation type toggle */}
            <View style={styles.allocationToggle}>
              <Pressable
                style={[styles.allocationPill, allocationType === 'amount' && styles.allocationPillActive]}
                onPress={() => setAllocationType('amount')}
              >
                <Text style={[styles.allocationPillText, allocationType === 'amount' && styles.allocationPillTextActive]}>
                  FIXED $
                </Text>
              </Pressable>
              <Pressable
                style={[styles.allocationPill, allocationType === 'percentage' && styles.allocationPillActive]}
                onPress={() => setAllocationType('percentage')}
              >
                <Text style={[styles.allocationPillText, allocationType === 'percentage' && styles.allocationPillTextActive]}>
                  % OF INCOME
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Amount Fields — Save/Goal */}
        {bucketMode === 'save' && (
          <View style={styles.amountSection}>
            <View style={styles.amountRow}>
              <Text style={styles.amountCurrency}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="rgba(61,50,41,0.15)"
              />
              <Text style={styles.amountSuffix}>goal</Text>
            </View>

            {/* Monthly contribution */}
            <View style={styles.contributionRow}>
              <Text style={styles.contributionLabel}>contribute</Text>
              <Text style={styles.contributionCurrency}>
                {contributionType === 'percentage' ? '%' : '$'}
              </Text>
              <TextInput
                style={styles.contributionInput}
                value={contributionValue}
                onChangeText={setContributionValue}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="rgba(61,50,41,0.15)"
              />
              <Text style={styles.contributionSuffix}>
                {contributionType === 'percentage' ? '% of income' : '/ month'}
              </Text>
            </View>

            {/* Contribution type toggle */}
            <View style={styles.allocationToggle}>
              <Pressable
                style={[styles.allocationPill, contributionType === 'none' && styles.allocationPillActive]}
                onPress={() => setContributionType('none')}
              >
                <Text style={[styles.allocationPillText, contributionType === 'none' && styles.allocationPillTextActive]}>
                  NONE
                </Text>
              </Pressable>
              <Pressable
                style={[styles.allocationPill, contributionType === 'amount' && styles.allocationPillActive]}
                onPress={() => setContributionType('amount')}
              >
                <Text style={[styles.allocationPillText, contributionType === 'amount' && styles.allocationPillTextActive]}>
                  FIXED $
                </Text>
              </Pressable>
              <Pressable
                style={[styles.allocationPill, contributionType === 'percentage' && styles.allocationPillActive]}
                onPress={() => setContributionType('percentage')}
              >
                <Text style={[styles.allocationPillText, contributionType === 'percentage' && styles.allocationPillTextActive]}>
                  %
                </Text>
              </Pressable>
            </View>

            {/* Time estimate */}
            {inputTarget > 0 && inputContribution > 0 && contributionType === 'amount' && (
              <Text style={styles.timeEstimate}>
                {Math.ceil(inputTarget / inputContribution)} months to reach your goal
              </Text>
            )}
          </View>
        )}

        {/* Advanced options toggle */}
        <Pressable
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={styles.advancedToggleText}>
            {showAdvanced ? 'less options' : 'more options'}
          </Text>
        </Pressable>

        {showAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.advancedLabel}>alert when</Text>
            <View style={styles.advancedRow}>
              <TextInput
                style={styles.advancedInput}
                value={alertThreshold}
                onChangeText={setAlertThreshold}
                keyboardType="decimal-pad"
                placeholder="20"
                placeholderTextColor="rgba(61,50,41,0.2)"
              />
              <Text style={styles.advancedSuffix}>% remaining</Text>
            </View>
          </View>
        )}

        {/* Delete */}
        <View style={styles.deleteSection}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Bucket</Text>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>This action cannot be undone</Text>
        </View>

        <View style={{ height: 80 }} />
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
    </View>
  );

  // If visible prop is provided (web), wrap in Drawer
  if (onClose) {
    return (
      <Drawer
        visible={visible}
        onClose={onClose}
        fullScreen>
        {content}
      </Drawer>
    );
  }

  // Otherwise return content directly (native navigation)
  return content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE3D5',
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Merchant',
    fontWeight: '500',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: 'Merchant',
  },
  saveButton: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: 'Merchant',
    fontWeight: '500',
  },
  saveButtonDisabled: {
    color: '#B5AFA5',
  },

  // Cup preview
  cupPreview: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  cupImage: {
    width: 80,
    height: 80,
  },

  // Name
  nameSection: {
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  nameInput: {
    fontSize: 24,
    fontFamily: 'Merchant',
    color: '#1A1A1A',
    textAlign: 'center',
    paddingVertical: 8,
    letterSpacing: -0.5,
  },

  // Type pills (read-only in edit mode)
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  typePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(61,50,41,0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typePillActive: {
    backgroundColor: 'rgba(160,208,192,0.2)',
    borderColor: 'rgba(92,138,122,0.3)',
  },
  typePillText: {
    fontSize: 13,
    fontFamily: 'Merchant',
    fontWeight: '600',
    color: '#877E6F',
    letterSpacing: 0.8,
  },
  typePillTextActive: {
    color: '#245045',
  },
  typeHelper: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: '#A09686',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 40,
  },
  modeChangeWarning: {
    fontSize: 13,
    fontFamily: 'Merchant',
    fontStyle: 'italic',
    color: '#C0564E',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 40,
  },

  // Amount section
  amountSection: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  amountCurrency: {
    fontSize: 28,
    fontFamily: 'Merchant Copy',
    color: 'rgba(61,50,41,0.25)',
  },
  amountInput: {
    fontSize: 36,
    fontFamily: 'Merchant Copy',
    color: '#1A1A1A',
    minWidth: 60,
    textAlign: 'center',
    paddingVertical: 4,
  },
  amountSuffix: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#A09686',
    marginLeft: 4,
  },

  // Allocation type toggle
  allocationToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  allocationPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(61,50,41,0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  allocationPillActive: {
    backgroundColor: 'rgba(160,208,192,0.2)',
    borderColor: 'rgba(92,138,122,0.3)',
  },
  allocationPillText: {
    fontSize: 12,
    fontFamily: 'Merchant',
    fontWeight: '600',
    color: '#877E6F',
    letterSpacing: 0.6,
  },
  allocationPillTextActive: {
    color: '#245045',
  },

  // Contribution (goal mode)
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(61,50,41,0.06)',
  },
  contributionLabel: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: '#A09686',
  },
  contributionCurrency: {
    fontSize: 20,
    fontFamily: 'Merchant Copy',
    color: 'rgba(61,50,41,0.25)',
  },
  contributionInput: {
    fontSize: 24,
    fontFamily: 'Merchant Copy',
    color: '#1A1A1A',
    minWidth: 50,
    textAlign: 'center',
    paddingVertical: 2,
  },
  contributionSuffix: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: '#A09686',
  },
  timeEstimate: {
    fontSize: 14,
    fontFamily: 'Merchant',
    fontStyle: 'italic',
    color: '#5C8A7A',
    textAlign: 'center',
    marginTop: 12,
  },

  // Advanced
  advancedToggle: {
    alignItems: 'center',
    marginTop: 28,
  },
  advancedToggleText: {
    fontSize: 14,
    fontFamily: 'Merchant',
    color: '#A09686',
    textDecorationLine: 'underline',
  },
  advancedSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  advancedLabel: {
    fontSize: 13,
    fontFamily: 'Merchant',
    color: '#877E6F',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  advancedInput: {
    fontSize: 18,
    fontFamily: 'Merchant Copy',
    color: '#1A1A1A',
    backgroundColor: 'rgba(61,50,41,0.04)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    width: 60,
    textAlign: 'center',
  },
  advancedSuffix: {
    fontSize: 15,
    fontFamily: 'Merchant',
    color: '#A09686',
  },

  // Delete
  deleteSection: {
    alignItems: 'center',
    marginTop: 32,
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textOnPrimary,
  },
  deleteHint: {
    fontSize: 14,
    color: '#A09686',
    fontFamily: 'Merchant',
    marginTop: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#F5F0E7',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Merchant',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#7A6E62',
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
    backgroundColor: 'rgba(61,50,41,0.08)',
  },
  modalButtonDelete: {
    backgroundColor: theme.colors.danger,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: '#1A1A1A',
  },
  modalButtonTextDelete: {
    fontSize: 16,
    fontFamily: 'Merchant',
    color: theme.colors.textOnPrimary,
  },
});
