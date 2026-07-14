# Environment Setup Guide

This guide lists all the environment variables and APIs you need to configure for the application to work properly.

---

## Quick Summary

| Service | Required | Purpose | Free Tier Available |
|---------|----------|---------|---------------------|
| Supabase | ✅ Yes | Database | ✅ Yes (Free) |
| JWT Secret | ✅ Yes | Authentication | ✅ Built-in |
| Mistral AI | ⚠️ Optional | AI Summaries | ✅ Free tier ($2 credits) |
| PostHog | ⚠️ Optional | Analytics | ✅ Yes (Free) |
| Brevo Email | ⚠️ Optional | Email Reminders | ✅ Yes (300/day) |

---

## Step 1: Supabase (Required - Database)

**Get it from:** https://supabase.com

1. Create a free account at https://supabase.com
2. Create a new project
3. Get these values:
   - `VITE_SUPABASE_URL` = Your project URL (found in Project Settings > API)
   - `SUPABASE_SERVICE_KEY` = Service role key (found in Project Settings > API)

**Run the database migration:**
```sql
-- Open Supabase SQL Editor and run:
-- 1. supabase-schema.sql (base schema)
-- 2. supabase-migration-ai-pulse.sql (AI Pulse tables)
```

---

## Step 2: JWT Secret (Required - Authentication)

**No external service needed** - just generate a random string.

Generate a 32+ character secret:
```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Or use a simple random string like:
```
my-super-secret-jwt-key-for-worklog-ai-2026
```

---

## Step 3: Mistral AI (Optional - AI Summarization)

**Get it from:** https://console.mistral.ai

1. Create account at https://console.mistral.ai
2. Go to https://console.mistral.ai/api-keys/
3. Create a new API key
4. Copy to `MISTRAL_API_KEY`

**Note:** Without this, AI summaries won't generate. The app will still work but articles will use RSS snippets instead.

Free tier: $2 credits/month (enough for ~100-200 article summaries)

---

## Step 4: PostHog (Optional - Analytics)

**Get it from:** https://posthog.com

1. Create account at https://posthog.com
2. Create a new project
3. Find your project token (starts with `phc_`)
4. Add to both client and server env files

**Note:** Without this, no analytics tracking. App works fine without it.

---

## Step 5: Brevo Email (Optional - Email Reminders)

**Get it from:** https://brevo.com

1. Create account at https://brevo.com
2. Go to Senders & API Keys
3. Create API key
4. Set `BREVO_FROM_EMAIL` to a verified sending domain

**Note:** Without this, email reminders won't work. App works fine without it.

---

## Configuration Files

### Client `.env` (in `client/.env`)
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co

# API
VITE_API_URL=http://localhost:3001

# PostHog (optional)
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_your-token
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Server `.env` (in `server/.env`)
```env
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-32-character-secret-key-here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d

# Frontend
FRONTEND_URL=http://localhost:5173

# Mistral AI (optional)
MISTRAL_API_KEY=your-mistral-api-key

# PostHog (optional)
POSTHOG_API_KEY=phc_your-token
POSTHOG_HOST=https://us.i.posthog.com

# Brevo (optional)
BREVO_API_KEY=your-brevo-key
BREVO_FROM_EMAIL=noreply@yourdomain.com
BREVO_FROM_NAME=Worklog AI
```

---

## Minimum Setup to Run

For the application to work with **basic functionality**:

```env
# Server/.env - Minimum
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-secret-key-32-chars
FRONTEND_URL=http://localhost:5173

# Client/.env - Minimum  
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_API_URL=http://localhost:3001
```

With this minimum setup:
- ✅ Database works
- ✅ Authentication works
- ✅ Work log features work
- ✅ Dashboard works
- ❌ AI summaries disabled
- ❌ Analytics disabled
- ❌ Email reminders disabled

---

## Features Requiring Optional APIs

| Feature | Requires | What Happens If Missing |
|---------|----------|------------------------|
| AI Chat | MISTRAL_API_KEY | Returns "AI not configured" error |
| AI Appraisals | MISTRAL_API_KEY | Returns "AI not configured" error |
| AI Article Summaries | MISTRAL_API_KEY | Uses RSS snippet instead |
| Analytics | POSTHOG_API_KEY | No events tracked |
| Email Reminders | BREVO_API_KEY | Email reminders fail |

---

## Testing Without Optional APIs

The application handles missing optional APIs gracefully:

```typescript
// Server already handles this:
if (!process.env.MISTRAL_API_KEY) {
  logger.warn('MISTRAL_API_KEY not configured - skipping AI summarization')
  return null  // Gracefully returns no AI summary
}
```

---

## Quick Start Checklist

1. [ ] Create Supabase project
2. [ ] Run `supabase-schema.sql` in SQL Editor
3. [ ] Run `supabase-migration-ai-pulse.sql` for AI Pulse
4. [ ] Copy `client/.env.example` to `client/.env`
5. [ ] Copy `server/.env.example` to `server/.env`
6. [ ] Add `VITE_SUPABASE_URL` to both env files
7. [ ] Add `SUPABASE_SERVICE_KEY` to server env
8. [ ] Generate and add `JWT_SECRET` (32+ chars)
9. [ ] (Optional) Add `MISTRAL_API_KEY` for AI features
10. [ ] (Optional) Add `POSTHOG_API_KEY` for analytics
11. [ ] Run `npm run dev`

---

## Troubleshooting

**"Database connection failed"**
- Check `SUPABASE_SERVICE_KEY` is correct
- Verify `SUPABASE_URL` is correct
- Run migration SQL files in Supabase

**"Authentication not working"**
- Check `JWT_SECRET` is at least 32 characters
- Verify frontend and backend env files are loaded

**"AI features not working"**
- Check `MISTRAL_API_KEY` is set in server `.env`
- Restart server after adding the key

**"Port already in use"**
- Run: `netstat -ano | findstr ":3001"`
- Kill the process: `taskkill /PID <process_id> /F`