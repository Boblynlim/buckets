"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush from "web-push";

// Send push notification to a specific user
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured");
      return { sent: 0, failed: 0 };
    }

    webpush.setVapidDetails(
      "mailto:notifications@buckets.app",
      vapidPublicKey,
      vapidPrivateKey
    );

    const subscriptions: any[] = await ctx.runQuery(
      internal.pushNotifications.getSubscriptionsInternal,
      { userId: args.userId }
    );

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          JSON.stringify({
            title: args.title,
            body: args.body,
            url: args.url || "/",
            tag: args.tag || "buckets",
          })
        );
        sent++;
      } catch (error: any) {
        console.error("Push failed:", error.statusCode, error.message);
        failed++;

        if (error.statusCode === 410 || error.statusCode === 404) {
          await ctx.runMutation(internal.pushNotifications.removeSubscriptionInternal, {
            endpoint: sub.endpoint,
          });
        }
      }
    }

    return { sent, failed };
  },
});

// Send notification to all users (for cron jobs)
export const sendToAllUsers = internalAction({
  args: {
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured");
      return;
    }

    webpush.setVapidDetails(
      "mailto:notifications@buckets.app",
      vapidPublicKey,
      vapidPrivateKey
    );

    const allSubs: any[] = await ctx.runQuery(
      internal.pushNotifications.getAllSubscriptions
    );

    for (const sub of allSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          JSON.stringify({
            title: args.title,
            body: args.body,
            url: args.url || "/",
            tag: args.tag || "buckets",
          })
        );
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await ctx.runMutation(internal.pushNotifications.removeSubscriptionInternal, {
            endpoint: sub.endpoint,
          });
        }
      }
    }
  },
});
