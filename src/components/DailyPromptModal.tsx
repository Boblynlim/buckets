import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';
import { getFontFamily } from '../theme/fonts';
import { Sparkles, X } from 'lucide-react-native';

export const DailyPromptModal: React.FC = () => {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser);

  // Get today's unanswered prompt
  const todayPrompt = useQuery(
    api.dailyPrompts.getTodayPrompt,
    currentUser ? { userId: currentUser._id } : 'skip'
  );

  // Mutations
  const answerPrompt = useMutation(api.dailyPrompts.answerPrompt);
  const dismissPrompt = useMutation(api.dailyPrompts.dismissPrompt);
  const generatePrompt = useMutation(api.dailyPrompts.generateDailyPrompt);

  // Generate a prompt if none exists
  React.useEffect(() => {
    if (currentUser && todayPrompt === null) {
      // No prompt exists yet, generate one
      generatePrompt({ userId: currentUser._id }).catch(err => {
        console.error('Failed to generate prompt:', err);
      });
    }
  }, [currentUser, todayPrompt, generatePrompt]);

  const handleSubmit = async () => {
    if (!todayPrompt || !answer.trim()) return;

    setIsSubmitting(true);
    try {
      await answerPrompt({
        promptId: todayPrompt._id,
        answer: answer.trim(),
      });
      setAnswer('');
    } catch (error: any) {
      console.error('Failed to answer prompt:', error);
      alert(error.message || 'Failed to save your answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (!todayPrompt) return;

    try {
      await dismissPrompt({ promptId: todayPrompt._id });
    } catch (error) {
      console.error('Failed to dismiss prompt:', error);
    }
  };

  // Don't show modal if no prompt or already answered
  if (!todayPrompt) {
    return null;
  }

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'goal': return '🎯';
      case 'preference': return '❤️';
      case 'reflection': return '🤔';
      case 'habit': return '🔄';
      case 'happiness': return '😊';
      default: return '💭';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'goal': return 'Financial Goal';
      case 'preference': return 'What You Value';
      case 'reflection': return 'Reflection';
      case 'habit': return 'Spending Habits';
      case 'happiness': return 'What Brings Joy';
      default: return 'Daily Question';
    }
  };

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                  <Sparkles size={24} color="#4747FF" strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Daily Question</Text>
                  <Text style={styles.headerSubtitle}>
                    {getCategoryEmoji(todayPrompt.category)} {getCategoryLabel(todayPrompt.category)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
                <X size={24} color="#877E6F" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Question */}
            <View style={styles.questionContainer}>
              <Text style={styles.question}>{todayPrompt.question}</Text>
            </View>

            {/* Answer Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your Answer</Text>
              <TextInput
                style={styles.textInput}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Share your thoughts..."
                placeholderTextColor="#B5AFA5"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
              <Text style={styles.hint}>
                Your answer helps me give you better personalized insights!
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleDismiss}
              >
                <Text style={styles.skipButtonText}>Skip for today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!answer.trim() || isSubmitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!answer.trim() || isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Saving...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(71, 71, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Merchant Copy, monospace',
    color: '#877E6F',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  questionContainer: {
    backgroundColor: '#F8F7F5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4747FF',
  },
  question: {
    fontSize: 18,
    fontFamily: 'Merchant Copy, monospace',
    color: '#1A1A1A',
    lineHeight: 26,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: '#877E6F',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#FAFAF8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Merchant Copy, monospace',
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E8E4DF',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Merchant Copy, monospace',
    color: '#B5AFA5',
    marginTop: 8,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: '#877E6F',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#4747FF',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#B5AFA5',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Merchant, monospace',
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
