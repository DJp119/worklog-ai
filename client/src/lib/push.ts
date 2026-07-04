import { apiRequest } from './api'

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const data = await apiRequest<{ success: boolean; publicKey: string }>('/api/push/vapid-public-key')
    return data.publicKey
  } catch (error) {
    console.error('Failed to get VAPID public key:', error)
    return null
  }
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported by the browser.')
  }

  const registration = await navigator.serviceWorker.ready

  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) {
    return existingSubscription
  }

  const vapidPublicKey = await getVapidPublicKey()
  if (!vapidPublicKey) {
    throw new Error('Push notifications are not configured on the server.')
  }

  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  })

  // Send subscription to server
  await apiRequest('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription })
  })

  return subscription
}

export async function unsubscribeFromPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    // Tell server to delete
    await apiRequest('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint })
    })
  }
}
