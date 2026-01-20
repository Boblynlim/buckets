import React, {useState, useRef, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Bucket } from '../types';
import { theme } from '../theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm here to help you make thoughtful spending decisions. Ask me anything about your budget, or whether you should make a purchase.",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get current user and buckets from Convex
  const currentUser = useQuery(api.users.getCurrentUser);
  const buckets = useQuery(
    api.buckets.getByUser,
    currentUser ? { userId: currentUser._id } : 'skip',
  );

  // Get user memories for context
  const memories = useQuery(
    api.memories.getContextMemories,
    currentUser ? { userId: currentUser._id, limit: 10 } : 'skip',
  );

  const allBuckets = buckets || [];
  const userMemories = memories || [];

  // Get Claude action
  const sendMessageToClaude = useAction(api.chat.sendMessage);

  // Generate dynamic suggested prompts based on user data
  const suggestedPrompts = useMemo(() => {
    if (allBuckets.length === 0) {
      return [
        "Should I buy this $50 item?",
        "How am I doing this week?",
        "Help me set up my buckets",
        "What's making me happiest?",
      ];
    }

    const prompts: string[] = [];

    // Find bucket with lowest balance percentage
    const bucketsWithUsage = allBuckets.map((bucket: Bucket) => ({
      ...bucket,
      percentUsed: (bucket.allocationValue || 0) > 0
        ? (((bucket.allocationValue || 0) - (bucket.currentBalance || 0)) / (bucket.allocationValue || 0)) * 100
        : 0,
    }));

    const lowestBucket = bucketsWithUsage.reduce((lowest, bucket) =>
      (bucket.currentBalance || 0) < (lowest.currentBalance || 0) ? bucket : lowest
    );

    const highestUsageBucket = bucketsWithUsage.reduce((highest, bucket) =>
      bucket.percentUsed > highest.percentUsed ? bucket : highest
    );

    // Add dynamic prompts
    if ((lowestBucket.currentBalance || 0) < (lowestBucket.allocationValue || 0) * 0.3) {
      prompts.push(`My ${lowestBucket.name} bucket is running low, what should I do?`);
    }

    prompts.push(`How am I doing with my ${lowestBucket.name} spending?`);

    if (highestUsageBucket.percentUsed > 50) {
      prompts.push(`Should I add more to ${highestUsageBucket.name}?`);
    }

    prompts.push("What's my overall spending pattern this month?");

    return prompts;
  }, [allBuckets]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Prepare conversation history (exclude initial greeting)
      const conversationHistory = messages
        .filter(m => m.id !== '1')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // Call Claude via Convex action
      const response = await sendMessageToClaude({
        userId: currentUser._id,
        message: inputText.trim(),
        conversationHistory,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    } catch (error) {
      console.error('Failed to get Claude response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble responding right now. Please make sure your API key is configured and try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }

    // Scroll to bottom after sending
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }, 100);
  };

  const handleSuggestedPrompt = async (prompt: string) => {
    // Auto-send the suggested prompt
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Prepare conversation history (exclude initial greeting)
      const conversationHistory = messages
        .filter(m => m.id !== '1')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // Call Claude via Convex action
      const response = await sendMessageToClaude({
        userId: currentUser._id,
        message: prompt,
        conversationHistory,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    } catch (error) {
      console.error('Failed to get Claude response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble responding right now. Please make sure your API key is configured and try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior="padding">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Chat</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {/* Suggested Prompts - show only if no user messages */}
          {messages.filter(m => m.role === 'user').length === 0 && (
            <View style={styles.suggestedPromptsContainer}>
              <Text style={styles.suggestedPromptsTitle}>Try asking:</Text>
              {suggestedPrompts.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestedPrompt}
                  onPress={() => handleSuggestedPrompt(prompt)}>
                  <Text style={styles.suggestedPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Messages */}
          {messages.map(message => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}>
              {message.role === 'assistant' && (
                <View style={styles.assistantIcon}>
                  <Text style={styles.assistantIconText}>💬</Text>
                </View>
              )}
              <View
                style={[
                  styles.messageContent,
                  message.role === 'user'
                    ? styles.userMessageContent
                    : styles.assistantMessageContent,
                ]}>
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' && styles.userMessageText,
                  ]}>
                  {message.content}
                </Text>
              </View>
            </View>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <View style={styles.assistantIcon}>
                <Text style={styles.assistantIconText}>💬</Text>
              </View>
              <View style={styles.assistantMessageContent}>
                <Text style={styles.loadingText}>...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask me anything..."
            placeholderTextColor="#8A8478"
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}>
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3F0',
  },
  keyboardAvoid: {
    flex: 1,
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
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 20,
  },
  suggestedPromptsContainer: {
    marginBottom: 20,
  },
  suggestedPromptsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8A8478',
    fontFamily: 'Merchant, monospace',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestedPrompt: {
    backgroundColor: '#FDFCFB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E5E0',
  },
  suggestedPromptText: {
    fontSize: 14,
    color: '#2D2D2D',
    fontFamily: 'Merchant Copy, monospace',
  },
  messageBubble: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  assistantBubble: {
    justifyContent: 'flex-start',
  },
  assistantIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDFCFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E8E5E0',
  },
  assistantIconText: {
    fontSize: 16,
  },
  messageContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  userMessageContent: {
    backgroundColor: '#4747FF',
    borderWidth: 1,
    borderColor: '#4747FF',
  },
  assistantMessageContent: {
    backgroundColor: '#FDFCFB',
    borderWidth: 1,
    borderColor: '#E8E5E0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#2D2D2D',
    fontFamily: 'Merchant Copy, monospace',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant, monospace',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 90,
    backgroundColor: '#FDFCFB',
    borderTopWidth: 1,
    borderTopColor: '#E8E5E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F3F0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
    color: '#2D2D2D',
    fontFamily: 'Merchant Copy, monospace',
    borderWidth: 1,
    borderColor: '#E8E5E0',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4747FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C4BCAE',
  },
  sendButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
