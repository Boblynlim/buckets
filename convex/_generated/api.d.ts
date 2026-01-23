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
import type * as buckets from "../buckets.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as distribution from "../distribution.js";
import type * as expenses from "../expenses.js";
import type * as income from "../income.js";
import type * as memories from "../memories.js";
import type * as recommendations from "../recommendations.js";
import type * as recurringExpenses from "../recurringExpenses.js";
import type * as reports from "../reports.js";
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
  buckets: typeof buckets;
  chat: typeof chat;
  crons: typeof crons;
  distribution: typeof distribution;
  expenses: typeof expenses;
  income: typeof income;
  memories: typeof memories;
  recommendations: typeof recommendations;
  recurringExpenses: typeof recurringExpenses;
  reports: typeof reports;
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
