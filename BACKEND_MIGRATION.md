# Custom Authentication Migration Guide

## Overview

This migration moves Worklog AI from Supabase Auth to a custom authentication system using:
- **JWT access tokens** (15-minute expiry)
- **Database refresh tokens** (30-day expiry, rotatable)
- **Brevo** for transactional emails (300/day free tier)
- **Supabase PostgreSQL** for data storage (500MB free tier)

## Why Migrate?

**Problem**: Supabase free tier sends only 3 emails/hour (~72/day), making signup unusable for any real traffic.

**Solution**: Custom auth with Brevo email service (300 emails/day = 100+ new users/week).

## Cost Comparison

| Component | Before (Supabase Auth) | After (Custom Auth) |
|-----------|----------------------|---------------------|
| Authentication | Limited to 3 emails/hour | 300 emails/day (Brevo free) |
| Database | Supabase Postgres (free) | Supabase Postgres (free) |
| Email | Supabase (limited) | Brevo (300/day free) |
| **Monthly Cost** | $0 (but unusable) | $0 (fully functional) |

## Setup Instructions

### 1. Database Migration

Run the SQL migration file in Supabase SQL Editor:

```bash
# File: supabase-schema-custom-auth.sql
# Run this in Supabase SQL Editor (Database > SQL Editor)
```

This will:
- Create `users` table (replaces `auth.users` dependency)
- Create `refresh_tokens`, `email_verifications`, `password_resets` tables
- Keep existing `work_log_entries`, `appraisal_criteria`, `generated_appraisals` tables
- Remove Supabase auth triggers

### 2. Environment Variables

Copy `server/.env.example` to `server/.env` and update:

```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT
JWT_SECRET=generate-a-32-char-random-string-here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d

# Email (Brevo)
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM_EMAIL=noreply@yourdomain.com
BREVO_FROM_NAME=Worklog AI

# Frontend
FRONTEND_URL=http://localhost:5173

# AI
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Generate JWT_SECRET**:
```bash
# On Mac/Linux
openssl rand -hex 32

# On Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 3. Brevo Setup (Free Tier)

1. Sign up at [brevo.com](https://www.brevo.com/)
2. Verify your sending domain (or use default)
3. Get API key (Settings > API Keys)
4. Free tier: 300 emails/day = 9,000/month

### 4. Install Dependencies

```bash
cd server
npm install
```

### 5. Start Server

```bash
npm run dev
```

Server runs on `http://localhost:3001`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account (email + password) |
| POST | `/api/auth/login` | Login (returns access + refresh tokens) |
| POST | `/api/auth/logout` | Logout (revokes refresh token) |
| POST | `/api/auth/refresh` | Get new access token |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/verify-email` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### User Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get current user profile |
| PUT | `/api/users/profile` | Update profile |
| PUT | `/api/users/password` | Change password |
| DELETE | `/api/users/account` | Delete account |

### Work Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | Get all work logs |
| GET | `/api/entries/:id` | Get single work log |
| POST | `/api/entries` | Create work log |
| PUT | `/api/entries/:id` | Update work log |
| DELETE | `/api/entries/:id` | Delete work log |

### Appraisals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/appraisal/generate` | Generate AI appraisal |
| GET | `/api/appraisal/history` | Get appraisal history |
| GET | `/api/appraisal/:id` | Get single appraisal |

## Testing the Migration

### 1. Health Check

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-01T07:36:41.856Z",
  "database": "connected",
  "environment": "development"
}
```

### 2. Signup

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "company_name": "Acme Corp",
    "job_title": "Developer"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Account created. Please check your email to verify.",
  "data": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

### 3. Verify Email

After receiving the verification email, click the link OR use the API:

```bash
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-from-signup",
    "token": "token-from-email"
  }'
```

### 4. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "rememberMe": true
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "name": "Test User",
      "companyName": "Acme Corp",
      "jobTitle": "Developer"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "abc123...",
    "expiresIn": 900
  }
}
```

### 5. Protected Endpoint (Get Profile)

```bash
ACCESS_TOKEN="your-access-token-from-login"

curl http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "Test User",
    "companyName": "Acme Corp",
    "jobTitle": "Developer",
    "emailVerified": true,
    "reminderDay": 1,
    "reminderTime": "09:00",
    "reminderEnabled": true,
    "createdAt": "2026-05-01T..."
  }
}
```

## Security Features

1. **Password Hashing**: bcrypt with 12 salt rounds
2. **JWT Access Tokens**: 15-minute expiry (stateless, fast)
3. **Refresh Tokens**: 30-day expiry, database-stored, rotatable
4. **Email Verification**: Required before login
5. **Rate Limiting**: 100 requests/15 minutes (auth: 20/hour)
6. **CORS**: Configured for localhost + production domains
7. **Token Rotation**: New refresh token on each refresh

## Frontend Migration

The frontend needs updates to:
1. Remove Supabase client
2. Replace magic link login with email/password form
3. Implement token storage (localStorage or cookies)
4. Add token refresh logic on 401 errors
5. Update AuthContext to use new API endpoints

See `CLIENT_MIGRATION.md` for frontend changes.

## Rollback Plan

If issues arise, you can quickly rollback:

1. **Keep existing data**: New `users` table doesn't affect existing `user_profiles`
2. **Revert code**: Git checkout to previous commit
3. **Re-enable Supabase Auth**: Remove custom auth routes, restore old auth middleware

## Monitoring

### Database Size
- Current limit: 500MB (free tier)
- Alert at: 400MB
- Each user with 52 weeks of logs: ~50KB
- Capacity: 10,000+ users

### Email Volume
- Brevo free: 300 emails/day = 9,000/month
- Per user: 1 signup email + 1 password reset (avg)
- Capacity: 4,500 new users/month + password resets

### AI API Costs
- Anthropic Sonnet: ~$0.02 per appraisal
- Free tier users (1 appraisal/month): $0.02/user
- At 100 users: $2/month (charge $5-10 for pro tier)

## Troubleshooting

### "Invalid token" errors
- Check `JWT_SECRET` is set and matches in both server and client
- Verify token hasn't expired (15 minutes)

### "Email already registered"
- User exists in `users` table
- Check `email_verified` status - they may need to verify

### Email not sending
- Verify `BREVO_API_KEY` is set
- Check domain verification in Brevo dashboard
- Look for errors in server logs

### Database connection failed
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Check Supabase project status (not paused)

## Next Steps

1. **Frontend migration**: Update React app to use new auth
2. **Email templates**: Customize Brevo email templates
3. **Monitoring**: Set up uptime monitoring (UptimeRobot free)
4. **Analytics**: Add usage tracking
5. **Scaling plan**: Document upgrade path when hitting free tier limits

---

**Migration Status**: ✅ Backend complete, ready for frontend integration
