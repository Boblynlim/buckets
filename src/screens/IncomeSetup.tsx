import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

export const IncomeSetup: React.FC<{onComplete?: () => void}> = ({
  onComplete,
}) => {
  const [monthlyIncome, setMonthlyIncome] = useState('');

  const handleSave = () => {
    console.log('Saving income:', monthlyIncome);
    // Will connect to Convex later
    alert(`Income set to $${monthlyIncome}/month`);
    onComplete?.();
  };

  const isValid = monthlyIncome && parseFloat(monthlyIncome) > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Set Monthly Income</Text>
          <Text style={styles.subtitle}>
            This helps us distribute your money into buckets
          </Text>
        </View>

        {/* Amount Input */}
        <View style={styles.card}>
          <Text style={styles.label}>Monthly Income</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={monthlyIncome}
              onChangeText={setMonthlyIncome}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#C7C7CC"
            />
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoEmoji}>💡</Text>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            Each month, your income will be automatically distributed to your
            buckets based on the allocation rules you set. You can adjust these
            anytime in settings.
          </Text>
        </View>

        {/* Example */}
        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>Example</Text>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleLabel}>Monthly Income:</Text>
            <Text style={styles.exampleValue}>$5,000</Text>
          </View>
          <View style={styles.exampleDivider} />
          <View style={styles.exampleRow}>
            <Text style={styles.exampleBucket}>🛒 Groceries (30%)</Text>
            <Text style={styles.exampleValue}>$1,500</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleBucket}>🎉 Fun (20%)</Text>
            <Text style={styles.exampleValue}>$1,000</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleBucket}>💰 Savings (50%)</Text>
            <Text style={styles.exampleValue}>$2,500</Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isValid}>
          <Text style={styles.saveButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: '#8E8E93',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: '700',
    color: '#000',
    padding: 0,
  },
  infoCard: {
    backgroundColor: '#EDEDFF',
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
  },
  infoEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
  },
  exampleCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 16,
  },
  exampleTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  exampleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  exampleBucket: {
    fontSize: 15,
    color: '#000',
  },
  exampleValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Merchant Copy, monospace',
    color: '#000',
  },
  exampleDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  saveButton: {
    backgroundColor: '#4747FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
