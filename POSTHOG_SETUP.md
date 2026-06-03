# PostHog Analytics Setup Guide

## Overview

PostHog has been integrated into Worklog AI for product analytics, user behavior tracking, and feature usage insights.

## Quick Start

### 1. Create a PostHog Account

1. Go to https://posthog.com
2. Sign up for a free account
3. Create a new project

### 2. Get Your API Keys

After creating a project:
- **Project API Key**: Found in Project Settings → API Keys
- **API Host**: Usually `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU)

### 3. Configure Environment Variables

#### Client (`client/.env`)
```env
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Legacy keys are also accepted for backward compatibility:
```env
VITE_POSTHOG_KEY=phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

#### Server (`server/.env`)
```env
POSTHOG_PROJECT_TOKEN=phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
POSTHOG_HOST=https://us.i.posthog.com
```

(`POSTHOG_API_KEY` and `POSTHOG_KEY` are also accepted for backward compatibility.)

### 4. Restart Your Development Servers

```bash
npm run dev
```

## Architecture

### Client-Side (`posthog-js` + `@posthog/react`)

PostHog is initialized once at app startup in `client/src/main.tsx` using `posthog.init()` with the `defaults: '2026-01-30'` configuration. The initialized client is passed to `<PostHogProvider>` which wraps the entire app.

**User identification** happens automatically in `AuthContext.tsx`:
- On login → `posthog.identify(userId, { email, name, ... })`
- On logout → `posthog.reset()`
- On session restore → `posthog.identify(...)` is called again

### Server-Side (`posthog-node`)

A lazy-initialized singleton client lives in `server/src/lib/posthog.ts`. It exports:
- `getPostHogClient()` — returns the singleton (or `null` if unconfigured)
- `captureEvent(distinctId, eventName, properties)` — capture any event
- `identifyUser(distinctId, properties)` — identify a user server-side
- `captureException(error, distinctId?, properties?)` — capture errors
- `shutdownPostHog()` — flush and close on graceful shutdown

## What's Tracked

### Client-Side (Automatic)
- **Page Views**: Every route navigation
- **Autocapture**: Clicks, form submissions, element interactions
- **User identification**: When users log in

### Server-Side (API Events)
- **API Requests**: All authenticated API calls
- **Request duration**: Performance monitoring
- **Status codes**: Error tracking
- **User agent**: Client information

## Custom Events

### Client-Side (React Components)

Use the `usePostHog` hook from `@posthog/react`:

```typescript
import { usePostHog } from '@posthog/react'

export default function CheckoutPage() {
  const posthog = usePostHog()

  function handlePurchase() {
    posthog.capture('purchase_completed', { amount: 99 })
  }

  return <button onClick={handlePurchase}>Complete purchase</button>
}
```

Or import posthog directly (it's already initialized):

```typescript
import posthog from 'posthog-js'

posthog.capture('feature_used', { feature: 'appraisal_generation' })
```

### Server-Side

```typescript
import { captureEvent, identifyUser } from './lib/posthog.js'

// Track an event
captureEvent(userId, 'appraisal_generated', {
  word_count: 500,
  duration_ms: 2000
})

// Identify user
identifyUser(userId, {
  email: user.email,
  plan: 'premium'
})
```

## Dashboard & Insights

Once you have data flowing:
- **Dashboards**: Create custom dashboards for key metrics
- **Funnel Analysis**: Track user conversion paths
- **Retention**: Understand user stickiness
- **Heatmaps**: See where users click most

## Privacy Considerations

- PostHog is self-hostable if you need data sovereignty
- User data is anonymized by default
- You can configure IP anonymization in PostHog settings

## Troubleshooting

### Events Not Appearing
1. Check your API keys are correct
2. Verify `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` is set in `client/.env`
3. Check browser console for errors (debug mode is auto-enabled in dev)
4. Look at PostHog's "Activity" tab for incoming events

### SDK Not Initialized
- Ensure env vars are loaded (check `.env` files exist)
- Restart development servers after adding env vars