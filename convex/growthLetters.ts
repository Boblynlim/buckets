import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { api } from './_generated/api';
import Anthropic from '@anthropic-ai/sdk';

// ─── Queries ────────────────────────────────────────────────────────────────

export const getLatest = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const letter = await ctx.db
      .query('growthLetters')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .first();
    return letter;
  },
});

export const getAll = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const letters = await ctx.db
      .query('growthLetters')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();
    return letters;
  },
});

export const hasUnread = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query('growthLetters')
      .withIndex('by_user_and_read', (q) =>
        q.eq('userId', args.userId).eq('isRead', false)
      )
      .first();
    return !!unread;
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

export const markAsRead = mutation({
  args: { letterId: v.id('growthLetters') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.letterId, { isRead: true });
  },
});

export const insertLetter = mutation({
  args: {
    userId: v.id('users'),
    content: v.string(),
    seasons: v.array(v.object({
      name: v.string(),
      summary: v.string(),
      startMonth: v.string(),
      endMonth: v.optional(v.string()),
    })),
    promptsUsed: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('growthLetters', {
      ...args,
      isRead: false,
    });
  },
});

// ─── Action: Generate Growth Letter ─────────────────────────────────────────

export const generate = action({
  args: { userId: v.id('users') },
  handler: async (ctx, args): Promise<string> => {
    // Gather all answered daily prompts chronologically
    const allPrompts = await ctx.runQuery(api.dailyPrompts.getPromptHistory, {
      userId: args.userId,
      limit: 200,
    }) as any[];

    const answeredPrompts = allPrompts
      .filter((p: any) => p.answer && p.answer.trim())
      .sort((a: any, b: any) => a.createdAt - b.createdAt);

    if (answeredPrompts.length < 3) {
      throw new Error('Need at least 3 answered prompts to generate a growth letter.');
    }

    // Get memories for additional context
    const memories = await ctx.runQuery(api.memories.getByUser, {
      userId: args.userId,
    }) as any[];

    // Get expense summary for grounding
    const allExpenses = await ctx.runQuery(api.expenses.getByUser, {
      userId: args.userId,
    }) as any[];

    // Build month summaries
    const byMonth: Record<string, { total: number; count: number }> = {};
    for (const e of allExpenses) {
      const d = new Date(e.date);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[label]) byMonth[label] = { total: 0, count: 0 };
      byMonth[label].total += e.amount;
      byMonth[label].count++;
    }

    const monthSummary = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, data]) => `${label}: $${data.total.toFixed(0)} across ${data.count} transactions`)
      .join('\n');

    // Format prompts chronologically
    const promptTimeline = answeredPrompts.map((p: any) => {
      const d = new Date(p.createdAt);
      const dateStr = d.toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' });
      return `[${dateStr}] (${p.category}) Q: ${p.question}\nA: ${p.answer}`;
    }).join('\n\n');

    // Key memories from other sources
    const nonPromptMemories = memories
      .filter((m: any) => m.source !== 'daily-prompt')
      .slice(0, 10)
      .map((m: any) => `- [${m.memoryType}] ${m.content}`)
      .join('\n');

    // Build the AI prompt
    const prompt = `You are writing a personal, reflective letter to someone about their financial journey. Think of it as a letter from a wise friend who has been watching them grow.

The tone is warm, observant, and honest — never preachy or generic. Use second person ("you"). Write like a real person, not a financial advisor. Short sentences. No bullet points in the letter itself.

Here is everything you know about this person:

DAILY PROMPT ANSWERS (chronological — this is their voice over time):
${promptTimeline}

SPENDING HISTORY BY MONTH:
${monthSummary || 'No spending data yet.'}

OTHER CONTEXT/MEMORIES:
${nonPromptMemories || 'None yet.'}

---

Write TWO things:

## LETTER
Write the letter. It should feel like opening a handwritten note. Start with something personal — reference their earliest answers vs their latest ones. Notice what shifted. Name the seasons of their journey (give each phase an evocative name like "the cautious season" or "the letting-go season").

Keep it under 300 words. Every sentence should be grounded in something they actually said or did. Don't make things up. If you only have a few data points, write a shorter letter — quality over quantity.

End with a single forward-looking line.

## SEASONS
After the letter, list the seasons as structured data. Format EXACTLY like this (one per line):
SEASON: name | summary (1 sentence) | start month (YYYY-MM) | end month (YYYY-MM or "now")

Example:
SEASON: The Cautious Season | You were just getting started, tracking every dollar carefully | 2026-01 | 2026-02
SEASON: The Experimenting Season | You started trusting yourself with bigger decisions | 2026-03 | now`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiResponse = completion.content[0].type === 'text' ? completion.content[0].text : '';

    // Parse the response
    const letterMatch = aiResponse.split('## SEASONS')[0]
      .replace('## LETTER', '')
      .trim();

    const seasonsSection = aiResponse.split('## SEASONS')[1] || '';
    const seasonLines = seasonsSection.split('\n').filter(l => l.trim().startsWith('SEASON:'));

    const seasons = seasonLines.map(line => {
      const parts = line.replace('SEASON:', '').split('|').map(s => s.trim());
      return {
        name: parts[0] || 'Unknown Season',
        summary: parts[1] || '',
        startMonth: parts[2] || '2026-01',
        endMonth: parts[3] === 'now' ? undefined : (parts[3] || undefined),
      };
    });

    // Save the letter
    const letterId: any = await ctx.runMutation(api.growthLetters.insertLetter, {
      userId: args.userId,
      content: letterMatch,
      seasons: seasons.length > 0 ? seasons : [{
        name: 'The Beginning',
        summary: 'Your journey is just starting.',
        startMonth: new Date().toISOString().slice(0, 7),
      }],
      promptsUsed: answeredPrompts.length,
      createdAt: Date.now(),
    });

    return letterId;
  },
});
