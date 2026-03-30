import { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

const VAPID_PUBLIC_KEY = 'BN1DzkHM1snq6xNmFdfV1XHNtGss2niw0aEg2_4UuE_ubR_a8KOyjg7z4P9-FCa-rMoSF2XIlfUld2Qu8BwiUEo';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

export async function subscribeToPush(
  userId: Id<'users'>,
  convex: ConvexReactClient,
): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push permission denied');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const subJson = subscription.toJSON();

    // Save to Convex
    await convex.mutation(api.pushNotifications.saveSubscription, {
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subJson.keys!.p256dh!,
        auth: subJson.keys!.auth!,
      },
    });

    console.log('Push subscription saved');
    return true;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return false;
  }
}

export async function unsubscribeFromPush(
  convex: ConvexReactClient,
): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Remove from Convex
      await convex.mutation(api.pushNotifications.removeSubscription, {
        endpoint: subscription.endpoint,
      });

      // Unsubscribe from browser
      await subscription.unsubscribe();
    }

    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
    return false;
  }
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
