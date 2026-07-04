import webpush from 'web-push'
import { supabase } from './database.js'
import { logger } from './logger.js'

const {
  VAPID_PUBLIC_KEY = '',
  VAPID_PRIVATE_KEY = '',
  VAPID_SUBJECT = 'mailto:support@impactlyai.com'
} = process.env

export const isPushConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)

if (isPushConfigured) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY
}

export async function sendPushNotification(subscription: webpush.PushSubscription, payload: any) {
  if (!isPushConfigured) {
    logger.warn('Web push is not configured')
    return false
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (error: any) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      // Subscription has expired or is no longer valid
      return false
    }
    logger.error('Error sending push notification: {}', error.message, error)
    throw error
  }
}

export async function sendPushToUser(userId: string, payload: any) {
  if (!isPushConfigured) return

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return
  }

  for (const sub of subscriptions) {
    const pushSubscription: webpush.PushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    }

    try {
      const success = await sendPushNotification(pushSubscription, payload)
      if (!success) {
        // Remove stale subscription
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
      }
    } catch (err) {
      logger.error('Failed to send push to user {}: {}', userId, err)
    }
  }
}
