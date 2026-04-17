# Production Deployment Guide

This guide covers deploying Worklog AI to production using Vercel (frontend) and Railway (backend).

## Prerequisites

- [Vercel account](https://vercel.com/signup)
- [Railway account](https://railway.app/)
- [Supabase project](https://supabase.com)
- [Resend account](https://resend.com) (for email)
- [Anthropic API key](https://console.anthropic.com)

---

## Phase 6.1 — Deploy Frontend to Vercel

### Step 1: Push to Git

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/worklog-ai.git
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure the project:
   - **Framework Preset:** Vite
   - **Root Directory:** `./client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 3: Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_API_URL` | Your Railway app URL (will add later) |

### Step 4: Deploy

Click **Deploy**. Vercel will build and deploy your app.

### Step 5: Configure Supabase Auth Redirect

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Vercel domain to **Site URL**: `https://your-app.vercel.app`
3. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/**`
   - `http://localhost:5173/**` (for development)

---

## Phase 6.2 — Deploy Backend to Railway

### Step 1: Connect to Railway

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `worklog-ai` repository

### Step 2: Configure Service

1. In Railway dashboard, select your service
2. Go to **Settings** → **Root Directory**: `server`
3. Railway will auto-detect Node.js and use Nixpacks

### Step 3: Set Environment Variables

In Railway dashboard → Variables:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `RESEND_API_KEY` | `re_...` |
| `FROM_EMAIL` | `noreply@yourdomain.com` |
| `JWT_SECRET` | Random secure string |
| `PORT` | `3001` (Railway provides this) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://your-app.vercel.app` |

### Step 4: Deploy

Railway will automatically deploy when you push to Git.

### Step 5: Get Your Railway Domain

1. Go to Railway dashboard → Settings → Domains
2. Copy your domain (e.g., `https://worklog-ai-production.up.railway.app`)
3. Update `VITE_API_URL` in Vercel with this domain

---

## Phase 6.3 — Production Checklist

### Supabase Configuration

- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] Enable Email Auth in Supabase (Authentication → Providers → Email)
- [ ] Configure site URL and redirect URLs
- [ ] Test magic link authentication

### CORS Configuration

Update server CORS to allow your Vercel domain:

```env
# In Railway variables
FRONTEND_URL=https://your-app.vercel.app
```

The CORS config in `server/src/index.ts` already uses this variable.

### Email Configuration (Resend)

- [ ] Verify your domain in Resend dashboard
- [ ] Add DNS records to your domain
- [ ] Set `FROM_EMAIL` to a verified domain email
- [ ] Test email sending

### Security

- [ ] Rotate all API keys after initial setup
- [ ] Use a strong, random `JWT_SECRET`
- [ ] Enable Supabase Row Level Security (already in schema)
- [ ] Review RLS policies are correctly applied

### Testing

- [ ] Test login flow (magic link → redirect)
- [ ] Create a work log entry
- [ ] Generate an appraisal
- [ ] Check reminder job runs (or trigger manually)
- [ ] Verify email delivery

### Monitoring

- [ ] Set up Railway deployment notifications
- [ ] Enable Vercel Analytics (optional)
- [ ] Configure error tracking (Sentry, etc.)

---

## Post-Deployment Commands

### Test Production API

```bash
# Health check
curl https://your-railway-domain.up.railway.app/health

# Expected: {"status":"ok","timestamp":"..."}
```

### Trigger Reminder Job (Test)

Add a test endpoint to `server/src/jobs/reminderJob.ts`:

```typescript
// Add to routes for testing (remove in production!)
appraisalRoutes.get('/test-reminders', async (req, res) => {
  await reminderJob.runNow()
  res.json({ success: true })
})
```

---

## Troubleshooting

### CORS Errors

**Symptom:** Frontend can't reach backend

**Fix:**
1. Check `FRONTEND_URL` in Railway matches your Vercel domain exactly
2. Ensure no trailing slash in the URL
3. Restart Railway deployment

### Magic Link Not Working

**Symptom:** Login link sent but redirect fails

**Fix:**
1. Verify Supabase site URL is set correctly
2. Check redirect URLs include your Vercel domain pattern
3. Test in Supabase dashboard (Authentication → URL Configuration)

### Emails Not Sending

**Symptom:** Reminder emails fail

**Fix:**
1. Verify domain in Resend dashboard
2. Check `FROM_EMAIL` matches verified domain
3. Review Resend logs for specific errors

### Database Errors

**Symptom:** 400/500 errors on API calls

**Fix:**
1. Verify all tables exist in Supabase
2. Check RLS policies are enabled
3. Review Supabase logs for specific errors

---

## Custom Domain Setup

### Vercel (Frontend)

1. Go to Vercel → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `VITE_API_URL` if needed

### Railway (Backend)

1. Go to Railway → Settings → Domains
2. Add custom domain
3. Configure DNS (A record or CNAME)
4. Update `FRONTEND_URL` with new domain

---

## Cost Estimates

| Service | Free Tier | Paid (if needed) |
|---------|-----------|------------------|
| Vercel | 100GB/mo | $20/mo Pro |
| Railway | $5 credit | Usage-based |
| Supabase | 500MB DB, 50K MAU | $25/mo Pro |
| Resend | 3K emails/mo | $20/mo Pro |
| Anthropic | Pay-per-use | ~$0.01/appraisal |

**Estimated monthly cost:** $0-50 depending on usage

---

## Next Steps After Deployment

1. **Set up monitoring** - Add error tracking
2. **Configure backups** - Supabase auto-backups
3. **Add analytics** - Track usage patterns
4. **Implement rate limiting** - Protect API endpoints
5. **Add CI/CD** - Automated testing before deploy
