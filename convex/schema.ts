import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  buckets: defineTable({
    userId: v.id("users"),
    name: v.string(),
    bucketMode: v.optional(v.union(v.literal("spend"), v.literal("save"))), // Optional for migration

    // For spend buckets
    allocationType: v.optional(v.union(v.literal("amount"), v.literal("percentage"))),
    plannedAmount: v.optional(v.number()), // Fixed dollar amount planned
    plannedPercent: v.optional(v.number()), // Percentage of income planned
    fundedAmount: v.optional(v.number()), // Actually funded from income (this month's allocation)
    carryoverBalance: v.optional(v.number()), // Balance carried forward from previous months
    lastRolloverDate: v.optional(v.number()), // Last time rollover was performed

    // For save buckets
    targetAmount: v.optional(v.number()), // Savings goal
    currentBalance: v.optional(v.number()), // Current progress (used for both modes for backward compat)
    contributionType: v.optional(v.union(v.literal("amount"), v.literal("percentage"), v.literal("none"))), // Monthly contribution type
    contributionAmount: v.optional(v.number()), // Fixed dollar amount per month
    contributionPercent: v.optional(v.number()), // Percentage of income per month
    goalAlerts: v.optional(v.array(v.number())), // Alert at these percentages (e.g., [50, 75, 100])
    reminderDays: v.optional(v.number()), // Remind if no contribution in X days (e.g., 30)
    notifyOnComplete: v.optional(v.boolean()), // Notify when goal is reached
    capBehavior: v.optional(v.union(
      v.literal("stop"),          // Stop contributions when target reached
      v.literal("unallocated"),   // Reroute to unallocated
      v.literal("bucket"),        // Reroute to specific bucket
      v.literal("proportional")   // Distribute proportionally across spend buckets
    )),
    capRerouteBucketId: v.optional(v.id("buckets")), // Target bucket if capBehavior = "bucket"

    // Shared fields
    alertThreshold: v.number(), // percentage (e.g., 20 = alert at 20%)
    color: v.string(), // hex color for UI
    icon: v.optional(v.string()), // icon name (e.g., "octopus", "frog")
    createdAt: v.number(),
    isActive: v.boolean(),

    // Legacy fields for migration
    allocationValue: v.optional(v.number()), // DEPRECATED: use plannedAmount/plannedPercent
    allocationType_legacy: v.optional(v.union(v.literal("amount"), v.literal("percentage"))),
  }).index("by_user", ["userId"]),

  income: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    date: v.number(), // timestamp
    note: v.optional(v.string()),
    isRecurring: v.boolean(), // true for monthly salary, false for one-time
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  expenses: defineTable({
    userId: v.id("users"),
    bucketId: v.id("buckets"),
    amount: v.number(),
    date: v.number(), // timestamp - user can edit this
    note: v.string(),
    happinessRating: v.number(), // 1-5 scale
    createdAt: v.number(),
    updatedAt: v.number(),

    // Transaction metadata (auto-generated or user-edited)
    merchant: v.optional(v.string()),
    category: v.optional(v.string()), // e.g., "Food & Dining", "Transportation"
    subCategory: v.optional(v.string()), // e.g., "Restaurants", "Groceries"
    item: v.optional(v.string()), // e.g., "Dinner", "Weekly groceries"
    needsVsWants: v.optional(v.union(v.literal("need"), v.literal("want"))),
    sentiment: v.optional(v.string()), // Brief emotional context
  })
    .index("by_user", ["userId"])
    .index("by_bucket", ["bucketId"])
    .index("by_user_and_date", ["userId", "date"])
    .index("by_category", ["userId", "category"])
    .index("by_merchant", ["userId", "merchant"]),

  recurringExpenses: defineTable({
    userId: v.id("users"),
    bucketId: v.id("buckets"),
    name: v.string(),
    amount: v.number(),
    dayOfMonth: v.number(), // 1-31
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_bucket", ["bucketId"]),

  claudeConversations: defineTable({
    userId: v.id("users"),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    conversationType: v.union(
      v.literal("on-demand"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  memories: defineTable({
    userId: v.id("users"),
    memoryType: v.union(
      v.literal("preference"), // User preferences (e.g., "I prefer to save 20% for retirement")
      v.literal("goal"),       // Financial goals (e.g., "Save $10k for vacation by June")
      v.literal("insight"),    // Past insights from reports (e.g., "Coffee spending increased 30% in March")
      v.literal("context")     // General context (e.g., "Just got a raise", "Planning a wedding")
    ),
    content: v.string(),       // The actual memory content
    source: v.optional(v.string()), // Where this memory came from (e.g., "chat", "weekly-report", "user-edit")
    metadata: v.optional(v.object({
      bucketId: v.optional(v.id("buckets")),
      category: v.optional(v.string()),
      targetAmount: v.optional(v.number()),
      targetDate: v.optional(v.number()),
    })),
    importance: v.number(),    // 1-5 scale, for prioritizing memory retrieval
    isActive: v.boolean(),     // Can be deactivated if no longer relevant
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_type", ["userId", "memoryType"])
    .index("by_user_and_active", ["userId", "isActive"]),

  reports: defineTable({
    userId: v.id("users"),
    reportType: v.union(
      v.literal("weekly"),  // Weekly reflective report
      v.literal("monthly")  // Monthly strategic report
    ),
    periodStart: v.number(), // Start of the period (timestamp)
    periodEnd: v.number(),   // End of the period (timestamp)

    // Report sections
    summary: v.string(),           // High-level summary
    spendingAnalysis: v.object({
      totalSpent: v.number(),
      topCategories: v.array(v.object({
        category: v.string(),
        amount: v.number(),
        percentOfTotal: v.number(),
      })),
      comparisonToPrevious: v.optional(v.object({
        change: v.number(),
        percentChange: v.number(),
      })),
    }),
    happinessAnalysis: v.object({
      averageHappiness: v.number(),
      topHappyCategories: v.array(v.object({
        category: v.string(),
        avgHappiness: v.number(),
        roi: v.number(),
      })),
      concerningCategories: v.array(v.object({
        category: v.string(),
        avgHappiness: v.number(),
        reason: v.string(),
      })),
    }),
    bucketPerformance: v.array(v.object({
      bucketName: v.string(),
      planned: v.number(),
      funded: v.number(),
      spent: v.number(),
      status: v.string(), // "on-track", "over-budget", "under-utilized"
    })),
    insights: v.array(v.string()),      // Key insights discovered
    recommendations: v.array(v.string()), // Action items
    wins: v.array(v.string()),          // Things going well
    concerns: v.array(v.string()),      // Things to watch

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_type", ["userId", "reportType"])
    .index("by_user_and_period", ["userId", "periodStart"]),
});
