import { PostHog } from 'posthog-node'

const postHogKey = process.env.POSTHOG_KEY || ''
const postHogHost = process.env.POSTHOG_HOST || 'https://us.i.posthog.com'

let posthog: PostHog | null = null

/**
 * Get PostHog client (lazy initialization)
 */
export functiongetPostHogClient(): PostHog | null {
  if (!postHogKey) {
    return null
  }

  if (!posthog) {
    posthog = new PostHog(postHogKey, {
      host: postHogHost,
      flushAt: 50,
      flushInterval: 5000,
    })
  }

  return posthog
}

/**
 * Capture server-side event
 */
export function captureEvent(
  distinctId: string,
  eventName: string,
  properties?: Record<string, any>
): void {
  const client = getPostHogClient()
  if (!client) return

  try {
    client.capture({
      distinctId,
      event: eventName,
      properties,
    })
  } catch (error) {
    console.error('PostHog capture error:', error)
  }
}

/**
 * Identify user with properties
 */
export function identifyUser(distinctId: string, properties?: Record<string, any>): void {
  const client = getPostHogClient()
  if (!client) return

  try {
    client.identify({
      distinctId,
      properties,
    })
  } catch (error) {
    console.error('PostHog identify error:', error)
  }
}

/**
 * Shutdown PostHog client on server shutdown
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthog) {
    await posthog.shutdown()
    posthog = null
  }
}