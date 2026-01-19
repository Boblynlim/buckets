import { ConvexReactClient } from 'convex/react';

// Initialize Convex client with deployment URL
// Use environment variable if available, otherwise fallback to your dev deployment URL
const CONVEX_URL =
  (typeof process !== 'undefined' && process.env?.CONVEX_URL) ||
  'https://rightful-goldfinch-115.convex.cloud';

console.log('Convex Client Initialized:', {
  url: CONVEX_URL,
  hasEnvVar: !!(typeof process !== 'undefined' && process.env?.CONVEX_URL),
});

export const convexClient = new ConvexReactClient(CONVEX_URL);
