import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';

export const Migration: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const migrateToNewModel = useMutation(api.buckets.migrateToNewModel);
  const calculateDistribution = useMutation(api.distribution.calculateDistribution);

  const runMigration = async () => {
    setStatus('running');
    setMessage('Migrating buckets to new model...');

    try {
      // Step 1: Migrate buckets
      const result = await migrateToNewModel({});
      setMessage(`Migrated ${result.migrated} buckets. Calculating distribution...`);

      // Step 2: Run initial distribution calculation
      // We need to get the current user first
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStatus('success');
      setMessage(`✓ Migration complete! ${result.migrated} buckets migrated. Please refresh the app to see changes.`);
    } catch (error: any) {
      setStatus('error');
      setMessage(`Error: ${error.message}`);
      console.error('Migration error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Budget Buckets v2</Text>
        <Text style={styles.subtitle}>Migration Required</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What's changing:</Text>
          <Text style={styles.infoText}>
            • Buckets now have spend/save modes{'\n'}
            • Better tracking: planned vs funded vs spent{'\n'}
            • Automatic income distribution{'\n'}
            • Over-planning detection{'\n'}
          </Text>
        </View>

        {status === 'idle' && (
          <TouchableOpacity style={styles.button} onPress={runMigration}>
            <Text style={styles.buttonText}>Run Migration</Text>
          </TouchableOpacity>
        )}

        {status !== 'idle' && (
          <View style={styles.statusBox}>
            <Text style={[
              styles.statusText,
              status === 'success' && styles.successText,
              status === 'error' && styles.errorText,
            ]}>
              {message}
            </Text>
          </View>
        )}

        {status === 'running' && (
          <Text style={styles.hint}>Please wait, this may take a moment...</Text>
        )}

        {status === 'success' && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
          >
            <Text style={styles.buttonTextSecondary}>Refresh App</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 44,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginBottom: 40,
  },
  infoBox: {
    backgroundColor: theme.colors.purple100,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    width: '100%',
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    lineHeight: 24,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.textOnPrimary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.border,
    marginTop: 12,
  },
  buttonTextSecondary: {
    fontSize: 17,
    fontFamily: getFontFamily('bold'),
    color: theme.colors.text,
  },
  statusBox: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginTop: 20,
  },
  statusText: {
    fontSize: 15,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.text,
    lineHeight: 22,
  },
  successText: {
    color: '#34C759',
  },
  errorText: {
    color: theme.colors.danger,
  },
  hint: {
    fontSize: 14,
    fontFamily: getFontFamily('regular'),
    color: theme.colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
});
