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
  Image,
} from 'react-native';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
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

  // Get Claude actions
  const sendMessageToClaude = useAction(api.chat.sendMessage);
  const extractMemories = useAction(api.chat.extractMemories);

  // Generate generic lifestyle check-in prompts
  const suggestedPrompts = useMemo(() => {
    if (allBuckets.length === 0) {
      return [
        "Should I buy this $50 item?",
        "How am I doing this week?",
        "Help me set up my buckets",
        "What's making me happiest?",
      ];
    }

    return [
      "How am I doing this week?",
      "Should I make this purchase?",
      "What's bringing me the most joy?",
      "Am I on track with my goals?",
    ];
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

      // Prepare conversation history
      const conversationHistory = messages.map(m => ({
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

      // Extract and save memories from this conversation
      extractMemories({
        userId: currentUser._id,
        userMessage: inputText.trim(),
        assistantResponse: response,
      }).catch(err => {
        console.error('Failed to extract memories:', err);
      });

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

      // Prepare conversation history
      const conversationHistory = messages.map(m => ({
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

      // Extract and save memories from this conversation
      extractMemories({
        userId: currentUser._id,
        userMessage: prompt,
        assistantResponse: response,
      }).catch(err => {
        console.error('Failed to extract memories:', err);
      });

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
        {/* WhatsApp-style Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image
              source={require('../../public/icons/icon-192x192.png')}
              style={styles.avatar}
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerName}>Shrimpy</Text>
              <Text style={styles.headerStatus}>Your budget assistant</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>

          {/* Messages in WhatsApp/Telegram style */}
          {messages.map(message => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow,
              ]}>
              {message.role === 'assistant' && (
                <Image
                  source={require('../../public/icons/icon-192x192.png')}
                  style={styles.messageAvatar}
                />
              )}
              <View
                style={[
                  styles.messageBubble,
                  message.role === 'user'
                    ? styles.userBubble
                    : styles.assistantBubble,
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
            <View style={[styles.messageRow, styles.assistantMessageRow]}>
              <Image
                source={require('../../public/icons/icon-192x192.png')}
                style={styles.messageAvatar}
              />
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <Text style={styles.loadingText}>...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggested Prompts - bottom right as quick replies */}
        {messages.length === 0 && (
          <View style={styles.suggestedPromptsContainer}>
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

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message Shrimpy..."
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
    backgroundColor: '#ECE5DD',
  },
  keyboardAvoid: {
    flex: 1,
  },
  // WhatsApp-style header
  header: {
    backgroundColor: '#EAEAFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3838DD',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4747FF',
    fontFamily: 'Merchant Copy, monospace',
  },
  headerStatus: {
    fontSize: 12,
    color: '#4747FF',
    opacity: 0.8,
    fontFamily: 'Merchant Copy, monospace',
    marginTop: 2,
  },
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
  },
  userBubble: {
    backgroundColor: '#4747FF',
    borderBottomRightRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2D2D2D',
    fontFamily: 'Merchant Copy, monospace',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  loadingText: {
    fontSize: 14,
    color: '#8A8478',
    fontFamily: 'Merchant Copy, monospace',
  },
  // Suggested prompts as quick replies
  suggestedPromptsContainer: {
    position: 'absolute',
    bottom: 94,
    right: 12,
    left: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  suggestedPrompt: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E5E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: '90%',
  },
  suggestedPromptText: {
    fontSize: 12,
    color: '#2D2D2D',
    fontFamily: 'Merchant Copy, monospace',
    flexWrap: 'wrap',
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: '#F5F3F0',
    borderTopWidth: 1,
    borderTopColor: '#E8E5E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
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
