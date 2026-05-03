/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as buckets from "../buckets.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as dailyPrompts from "../dailyPrompts.js";
import type * as deleteReports from "../deleteReports.js";
import type * as distribution from "../distribution.js";
import type * as expenses from "../expenses.js";
import type * as groups from "../groups.js";
import type * as growthLetters from "../growthLetters.js";
import type * as income from "../income.js";
import type * as incomeReceipts from "../incomeReceipts.js";
import type * as lib_recurring from "../lib/recurring.js";
import type * as memories from "../memories.js";
import type * as monthlyIncome from "../monthlyIncome.js";
import type * as pushNotificationActions from "../pushNotificationActions.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as recommendations from "../recommendations.js";
import type * as recurringExpenses from "../recurringExpenses.js";
import type * as recurringSync from "../recurringSync.js";
import type * as reports from "../reports.js";
import type * as reportsNew from "../reportsNew.js";
import type * as reset from "../reset.js";
import type * as rollover from "../rollover.js";
import type * as tagging from "../tagging.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  buckets: typeof buckets;
  chat: typeof chat;
  crons: typeof crons;
  dailyPrompts: typeof dailyPrompts;
  deleteReports: typeof deleteReports;
  distribution: typeof distribution;
  expenses: typeof expenses;
  groups: typeof groups;
  growthLetters: typeof growthLetters;
  income: typeof income;
  incomeReceipts: typeof incomeReceipts;
  "lib/recurring": typeof lib_recurring;
  memories: typeof memories;
  monthlyIncome: typeof monthlyIncome;
  pushNotificationActions: typeof pushNotificationActions;
  pushNotifications: typeof pushNotifications;
  recommendations: typeof recommendations;
  recurringExpenses: typeof recurringExpenses;
  recurringSync: typeof recurringSync;
  reports: typeof reports;
  reportsNew: typeof reportsNew;
  reset: typeof reset;
  rollover: typeof rollover;
  tagging: typeof tagging;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
