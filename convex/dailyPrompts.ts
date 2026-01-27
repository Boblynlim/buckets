import { v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import { api } from './_generated/api';

/**
 * Daily Prompts System
 * Asks users thoughtful questions daily to learn about their goals, preferences, and habits
 */

// Predefined questions pool
const PROMPT_POOL = {
  goal: [
    "What's one financial goal you're working toward right now?",
    "If you could achieve one money-related goal this year, what would it be?",
    "What would financial freedom look like for you?",
    "What's something you're saving up for?",
    "What financial milestone would make you feel most proud?",
  ],
  preference: [
    "What kind of spending brings you the most joy?",
    "What matters most to you when deciding how to spend money?",
    "What's one thing you never regret spending money on?",
    "If you had an extra $500 this month, what would you spend it on?",
    "What's more important to you: experiences or things?",
  ],
  reflection: [
    "Looking at your spending this week, what stood out to you?",
    "Was there a purchase this week that made you particularly happy?",
    "Is there anything you bought recently that you wish you hadn't?",
    "What's one spending decision you're proud of this week?",
    "Did any unexpected expenses come up this week?",
  ],
  habit: [
    "What's one spending habit you'd like to change?",
    "Do you tend to overspend in any particular category?",
    "Are there subscriptions or recurring costs you've been meaning to cancel?",
    "What time of day or situation makes you most likely to make impulse purchases?",
    "What helps you stay on track with your budget?",
  ],
  happiness: [
    "What's the last thing you bought that genuinely made you smile?",
    "What category of spending consistently brings you low happiness?",
    "If you could only spend money on three categories, what would they be?",
    "What's something free or low-cost that brings you as much joy as expensive purchases?",
    "How do you feel about your spending over the past month?",
  ],
};

// Generate a daily prompt for a user
export const generateDailyPrompt = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);

    // Check if user already has a prompt for today
    const existingPrompt = await ctx.db
      .query('dailyPrompts')
      .withIndex('by_user_and_date', (q) =>
        q.eq('userId', args.userId).gte('createdAt', todayStart)
      )
      .first();

    if (existingPrompt) {
      return existingPrompt._id; // Already have a prompt for today
    }

    // Get recent prompts to avoid repetition
    const recentPrompts = await ctx.db
      .query('dailyPrompts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(20);

    const recentQuestions = new Set(recentPrompts.map(p => p.question));

    // Choose a category (cycle through them)
    const categories = ['goal', 'preference', 'reflection', 'habit', 'happiness'] as const;
    const lastCategory = recentPrompts[0]?.category;
    const lastCategoryIndex = lastCategory ? categories.indexOf(lastCategory) : -1;
    const nextCategoryIndex = (lastCategoryIndex + 1) % categories.length;
    const category = categories[nextCategoryIndex];

    // Pick a question from the pool that hasn't been asked recently
    const availableQuestions = PROMPT_POOL[category].filter(q => !recentQuestions.has(q));
    const question = availableQuestions.length > 0
      ? availableQuestions[Math.floor(Math.random() * availableQuestions.length)]
      : PROMPT_POOL[category][0]; // Fallback if all have been used

    // Create the prompt
    const promptId = await ctx.db.insert('dailyPrompts', {
      userId: args.userId,
      question,
      category,
      isAnswered: false,
      createdAt: now,
    });

    return promptId;
  },
});

// Get today's unanswered prompt for a user
export const getTodayPrompt = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db
      .query('dailyPrompts')
      .withIndex('by_user_and_answered', (q) =>
        q.eq('userId', args.userId).eq('isAnswered', false)
      )
      .order('desc')
      .first();

    return prompt;
  },
});

// Answer a daily prompt
export const answerPrompt = mutation({
  args: {
    promptId: v.id('dailyPrompts'),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    if (prompt.isAnswered) {
      throw new Error('Prompt already answered');
    }

    const now = Date.now();

    // Update the prompt
    await ctx.db.patch(args.promptId, {
      isAnswered: true,
      answer: args.answer,
      answeredAt: now,
    });

    // Create a memory from the answer
    try {
      await ctx.runMutation(api.memories.create, {
        userId: prompt.userId,
        memoryType: prompt.category === 'reflection' ? 'context' : prompt.category as any,
        content: args.answer,
        source: 'daily-prompt',
        importance: 4, // Daily prompts are important for personalization
      });
    } catch (error) {
      console.error('Failed to create memory from daily prompt:', error);
      // Don't fail the prompt answer if memory creation fails
    }

    return args.promptId;
  },
});

// Get prompt history
export const getPromptHistory = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const prompts = await ctx.db
      .query('dailyPrompts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(args.limit || 30);

    return prompts;
  },
});

// Dismiss today's prompt (if user doesn't want to answer)
export const dismissPrompt = mutation({
  args: {
    promptId: v.id('dailyPrompts'),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    // Mark as answered without saving a memory
    await ctx.db.patch(args.promptId, {
      isAnswered: true,
      answeredAt: Date.now(),
    });
  },
});

// Internal mutation called by cron job to generate prompts for all users
export const generateDailyPromptsForAllUsers = internalMutation({
  handler: async (ctx) => {
    console.log('Generating daily prompts for all users...');

    // Get all users
    const users = await ctx.db.query('users').collect();
    console.log(`Found ${users.length} users`);

    // Generate a prompt for each user
    for (const user of users) {
      try {
        await ctx.runMutation(api.dailyPrompts.generateDailyPrompt, {
          userId: user._id,
        });
        console.log(`Generated prompt for user ${user._id}`);
      } catch (error) {
        console.error(`Failed to generate prompt for user ${user._id}:`, error);
        // Continue with other users even if one fails
      }
    }

    console.log('Finished generating daily prompts');
  },
});
