import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface BucketContext {
  name: string;
  currentBalance: number;
  allocationValue: number;
  allocationType: 'amount' | 'percentage';
}

export interface ExpenseContext {
  amount: number;
  bucketName: string;
  note: string;
  happinessRating: number;
  date: number;
}

export interface ClaudeContext {
  buckets: BucketContext[];
  recentExpenses: ExpenseContext[];
  conversationHistory?: Message[];
}

// Build system prompt for Claude
const buildSystemPrompt = (context: ClaudeContext): string => {
  const bucketsInfo = context.buckets
    .map(
      (b) =>
        `- ${b.name}: $${b.currentBalance.toFixed(2)} (${
          b.allocationType === 'percentage'
            ? `${b.allocationValue}%`
            : `$${b.allocationValue}`
        } allocation)`
    )
    .join('\n');

  const recentExpensesInfo =
    context.recentExpenses.length > 0
      ? context.recentExpenses
          .map(
            (e) =>
              `- ${new Date(e.date).toLocaleDateString()}: $${e.amount.toFixed(
                2
              )} from ${e.bucketName} - "${e.note}" (happiness: ${
                e.happinessRating
              }/5)`
          )
          .join('\n')
      : 'No recent expenses';

  return `You are a warm, supportive financial companion helping the user manage their budget through the Buckets app. Your tone should be friend-like, validating, and encouraging - never preachy or corporate.

Current Financial Snapshot:
${bucketsInfo}

Recent Expenses:
${recentExpensesInfo}

Your role is to:
1. Help users make thoughtful purchase decisions by considering bucket balances, past happiness ratings, and spending patterns
2. Provide weekly check-ins to review spending and identify patterns
3. Offer monthly insights about what brings joy and suggest budget adjustments
4. Celebrate wins and be kind about overspending
5. Ask thoughtful follow-up questions to understand their priorities

Always be specific about numbers, validate their feelings about money, and help them align spending with what actually makes them happy.`;
};

// Ask Claude for purchase advice
export const getPurchaseAdvice = async (
  itemDescription: string,
  amount: number,
  context: ClaudeContext
): Promise<string> => {
  const systemPrompt = buildSystemPrompt(context);

  const userMessage = `Should I buy ${itemDescription} for $${amount.toFixed(
    2
  )}?`;

  const messages: Anthropic.Messages.MessageParam[] = [];

  // Add conversation history if available
  if (context.conversationHistory) {
    context.conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });
  }

  // Add current message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return textContent ? (textContent as any).text : '';
};

// Weekly check-in
export const getWeeklyCheckIn = async (
  context: ClaudeContext
): Promise<string> => {
  const systemPrompt = buildSystemPrompt(context);

  const userMessage =
    "It's time for your weekly check-in. How did my spending feel this week?";

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return textContent ? (textContent as any).text : '';
};

// Monthly review
export const getMonthlyReview = async (
  context: ClaudeContext
): Promise<string> => {
  const systemPrompt = buildSystemPrompt(context);

  const userMessage =
    "It's time for your monthly review. Analyze my spending patterns, what brought me happiness, and suggest any bucket adjustments for next month.";

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return textContent ? (textContent as any).text : '';
};

// General Claude query
export const queryClaude = async (
  userMessage: string,
  context: ClaudeContext
): Promise<string> => {
  const systemPrompt = buildSystemPrompt(context);

  const messages: Anthropic.Messages.MessageParam[] = [];

  // Add conversation history if available
  if (context.conversationHistory) {
    context.conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });
  }

  // Add current message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return textContent ? (textContent as any).text : '';
};
