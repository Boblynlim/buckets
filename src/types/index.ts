export interface User {
  _id: string;
  name: string;
  createdAt: number;
}

export type AllocationType = 'amount' | 'percentage';
export type BucketMode = 'spend' | 'save';

export interface Bucket {
  _id: string;
  userId: string;
  name: string;
  bucketMode?: BucketMode; // Optional for migration compatibility

  // For spend buckets
  allocationType?: AllocationType;
  plannedAmount?: number;
  plannedPercent?: number;
  fundedAmount?: number; // This month's allocation
  carryoverBalance?: number; // Balance carried forward from previous months
  lastRolloverDate?: number; // Timestamp of last rollover
  spentAmount?: number; // Computed field from backend

  // For save buckets
  targetAmount?: number;
  currentBalance?: number;
  contributionType?: 'amount' | 'percentage' | 'none';
  contributionAmount?: number;
  contributionPercent?: number;
  goalAlerts?: number[]; // e.g., [50, 75, 100]
  reminderDays?: number; // e.g., 30 days
  notifyOnComplete?: boolean;
  capBehavior?: 'stop' | 'unallocated' | 'bucket' | 'proportional';
  capRerouteBucketId?: string;

  // Shared
  alertThreshold: number;
  color: string;
  icon?: string;
  createdAt: number;
  isActive: boolean;

  // Legacy fields for backward compatibility
  allocationValue?: number;
}

export interface Income {
  _id: string;
  userId: string;
  amount: number;
  date: number;
  note?: string;
  isRecurring: boolean;
  createdAt: number;
}

export interface Expense {
  _id: string;
  userId: string;
  bucketId: string;
  amount: number;
  date: number;
  note: string;
  happinessRating: number;
  createdAt: number;
  updatedAt: number;

  // Transaction metadata
  merchant?: string;
  category?: string;
  subCategory?: string;
  item?: string;
  needsVsWants?: 'need' | 'want';
  sentiment?: string;
}

export interface RecurringExpense {
  _id: string;
  userId: string;
  bucketId: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  isActive: boolean;
  createdAt: number;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type ConversationType = 'on-demand' | 'weekly' | 'monthly';

export interface ClaudeConversation {
  _id: string;
  userId: string;
  messages: ClaudeMessage[];
  conversationType: ConversationType;
  createdAt: number;
}

export type MemoryType = 'preference' | 'goal' | 'insight' | 'context';

export interface Memory {
  _id: string;
  userId: string;
  memoryType: MemoryType;
  content: string;
  source?: string;
  metadata?: {
    bucketId?: string;
    category?: string;
    targetAmount?: number;
    targetDate?: number;
  };
  importance: number; // 1-5
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ReportType = 'weekly' | 'monthly';

export interface Report {
  _id: string;
  userId: string;
  reportType: ReportType;
  periodStart: number;
  periodEnd: number;
  summary: string;
  spendingAnalysis: {
    totalSpent: number;
    topCategories: Array<{
      category: string;
      amount: number;
      percentOfTotal: number;
    }>;
    comparisonToPrevious?: {
      change: number;
      percentChange: number;
    };
  };
  happinessAnalysis: {
    averageHappiness: number;
    topHappyCategories: Array<{
      category: string;
      avgHappiness: number;
      roi: number;
    }>;
    concerningCategories: Array<{
      category: string;
      avgHappiness: number;
      reason: string;
    }>;
  };
  bucketPerformance: Array<{
    bucketName: string;
    planned: number;
    funded: number;
    spent: number;
    status: string;
  }>;
  insights: string[];
  recommendations: string[];
  wins: string[];
  concerns: string[];
  createdAt: number;
}
