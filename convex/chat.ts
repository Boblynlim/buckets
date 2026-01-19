import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Chat with Claude using user context, memories, and bucket data
 */
export const sendMessage = action({
  args: {
    userId: v.id("users"),
    message: v.string(),
    conversationHistory: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<string> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // Get user's buckets
    const buckets = await ctx.runQuery(api.buckets.getByUser, {
      userId: args.userId,
    });

    // Get user's memories (last 10, sorted by importance)
    const memories = await ctx.runQuery(api.memories.getContextMemories, {
      userId: args.userId,
      limit: 10,
    });

    // Get recent expenses (last 20)
    const expenses = await ctx.runQuery(api.expenses.getByUser, {
      userId: args.userId,
    });
    const recentExpenses = expenses.slice(0, 20);

    // Build memory context
    const memoryContext = memories.length > 0
      ? memories.map(m => `[${m.memoryType}] ${m.content}`).join('\n')
      : 'No saved memories yet';

    // Build bucket context
    const bucketsContext = buckets.length > 0
      ? buckets.map(b => {
          const mode = b.bucketMode || 'spend';
          if (mode === 'spend') {
            const spent = b.spentAmount || 0;
            const funded = b.fundedAmount || b.allocationValue || 0;
            const remaining = Math.max(0, funded - spent);
            return `- ${b.name} (Spend): $${remaining.toFixed(2)} left of $${funded.toFixed(2)}`;
          } else {
            const current = b.currentBalance || 0;
            const target = b.targetAmount || 0;
            const progress = target > 0 ? ((current / target) * 100).toFixed(0) : '0';
            return `- ${b.name} (Save): $${current.toFixed(2)} of $${target.toFixed(2)} goal (${progress}%)`;
          }
        }).join('\n')
      : 'No buckets set up yet';

    // Build recent expenses context
    const expensesContext = recentExpenses.length > 0
      ? recentExpenses.map(e => {
          const bucket = buckets.find(b => b._id === e.bucketId);
          const bucketName = bucket?.name || 'Unknown';
          const date = new Date(e.date).toLocaleDateString();
          return `- ${date}: $${e.amount.toFixed(2)} from ${bucketName} - "${e.note}" (happiness: ${e.happinessRating}/5)`;
        }).join('\n')
      : 'No recent expenses';

    // Build system prompt with all context
    const systemPrompt = `You are a warm, supportive financial companion helping the user manage their budget through the Buckets app. Your tone should be friend-like, validating, and encouraging - never preachy or corporate.

User Context & Memories:
${memoryContext}

Current Buckets:
${bucketsContext}

Recent Expenses:
${expensesContext}

Your role is to:
1. Help users make thoughtful purchase decisions by considering bucket balances, past happiness ratings, and spending patterns
2. Reference their goals and preferences from memory when giving advice
3. Provide personalized insights based on their spending history and what brings them joy
4. Celebrate wins and be kind about overspending
5. Ask thoughtful follow-up questions to understand their priorities better

Always be specific about numbers, validate their feelings about money, and help them align spending with what actually makes them happy. Use their memories to provide continuity and personalized advice.`;

    // Build messages array
    const messages = [
      ...args.conversationHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: args.message,
      },
    ];

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.content.find((c: any) => c.type === "text");

    return textContent ? textContent.text : "I'm having trouble responding right now. Please try again.";
  },
});
