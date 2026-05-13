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

#### Client (.env)
```env
VITE_POSTHOG_KEY=phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

#### Server (.env)
```env
POSTHOG_KEY=phc_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
POSTHOG_HOST=https://us.i.posthog.com
```

### 4. Restart Your Development Servers

```bash
npm run dev
```

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

## Events You Can Track

To track custom events in your React components:

```typescript
import posthog from 'posthog-js'

// Track a custom event
posthog.capture('feature_used', { feature: 'appraisal_generation' })

// Identify a user
posthog.identify(userId, {
  email: user.email,
  company: user.companyName,
  plan: 'free'
})

// Set user properties
posthog.people.set('company_name', 'Acme Corp')
```

## Server-Side Events

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
2. Verify `VITE_POSTHOG_KEY` is set (client prefix required)
3. Check browser console for errors
4. Look at PostHog's "Activity" tab for incoming events

### SDK Not Initialized
- Ensure env vars are loaded (check `.env` files exist)
- Restart development servers after adding env vars