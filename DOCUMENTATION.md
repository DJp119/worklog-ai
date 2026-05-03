# Worklog AI - Complete Technical Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Authentication Flow](#authentication-flow)
4. [Database Design](#database-design)
5. [API Reference](#api-reference)
6. [Frontend Implementation](#frontend-implementation)
7. [Deployment Guide](#deployment-guide)
8. [Security Measures](#security-measures)
9. [Cost Structure](#cost-structure)
10. [Troubleshooting](#troubleshooting)

---

## 1. Executive Summary

### 1.1 Product Overview
Worklog AI is a SaaS platform that helps professionals track their weekly work accomplishments and generate AI-powered self-appraisals for performance reviews.

**Core Features:**
- Weekly work log tracking (accomplishments, challenges, learnings, goals)
- AI-generated performance appraisals using Anthropic Claude
- Email reminders and verification
- User profile management
- Secure authentication with JWT tokens

### 1.2 Technology Stack
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 18 + Vite | User interface |
| Styling | Tailwind CSS | UI components |
| Backend | Express.js + TypeScript | API server |
| Database | Supabase PostgreSQL | Data storage |
| Authentication | Custom JWT | User authentication |
| Email | Brevo (Sendinblue) | Transactional emails |
| AI | Anthropic Claude | Appraisal generation |
| Hosting | Vercel + Render | Frontend + Backend |

### 1.3 Business Model
- **Free Tier**: 1 AI appraisal per month
- **Pro Tier**: $5/month for unlimited appraisals
- **Cost per Appraisal**: ~$0.065 (AI API costs)

---

## 2. System Architecture

### 2.1 High-Level Diagram
```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET                              │
└─────────┬─────────────────────┬─────────────────────────┘
          │                     │
          ▼                     ▼
┌───────────────────┐   ┌──────────────────────┐
│   Vercel CDN      │   │   Cloudflare DNS     │
│  (Frontend Host)  │   │   (Domain Manager)   │
└─────────┬─────────┘   └──────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│              CLIENT SIDE (React + Vite)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Pages     │  │  Context    │  │   State     │     │
│  │ • Landing   │  │ AuthContext │  │ localStorage│     │
│  │ • Login     │  │ (Auth)      │  │ JWT Tokens  │     │
│  │ • Dashboard │  └─────────────┘  └─────────────┘     │
│  │ • LogEntry  │  ┌─────────────┐  ┌─────────────┐     │
│  │ • Appraisal │  │  API Client │  │   Router    │     │
│  │ • Settings  │  │ • api.ts    │  │ React Router│     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS + Bearer Token
                    ▼
┌─────────────────────────────────────────────────────────┐
│        BACKEND SERVER (Express.js + TypeScript)         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              MIDDLEWARE LAYER                    │   │
│  │  • CORS • Rate Limiting • JWT Verification      │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Routes    │  │   Routes    │  │   Routes    │    │
│  │ /api/auth   │  │/api/entries │  │ /api/users  │    │
│  │/api/appraisal│ |/api/logs    │  │/api/profile │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────────────────────────────────────────┐   │
│  │           BUSINESS LOGIC LAYER                   │   │
│  │ • Auth: JWT, password hashing, email verify     │   │
│  │ • Work Logs: CRUD, user scoping                 │   │
│  │ • Appraisals: AI prompts, token counting        │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────┘
                    │ Supabase Client
                    ▼
┌─────────────────────────────────────────────────────────┐
│        DATABASE (Supabase PostgreSQL)                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │           USER MANAGEMENT TABLES                 │   │
│  │ • users (id, email, password_hash, etc.)        │   │
│  │ • refresh_tokens (JWT refresh tokens)           │   │
│  │ • email_verifications (temporary tokens)        │   │
│  │ • password_resets (temporary tokens)            │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │              CORE DATA TABLES                    │   │
│  │ • work_log_entries (weekly logs)                │   │
│  │ • appraisal_criteria (goals & values)           │   │
│  │ • generated_appraisals (AI output)              │   │
│  │ • reminder_logs (audit trail)                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Brevo API   │ │ Anthropic   │ │ Cron Jobs   │
│ (Email)     │ │ API (AI)    │ │ (Reminders) │
└─────────────┘ └─────────────┘ └─────────────┘
```

### 2.2 Data Flow Sequence

```
User Action → Frontend (React) → API Call → Backend (Express)
                                      ↓
                              JWT Verification ✓
                                      ↓
                              Database Query (PostgreSQL)
                                      ↓
                              Business Logic Processing
                                      ↓
                              Response → Frontend → User
```

---

## 3. Authentication Flow

### 3.1 User Registration

**Flow Steps:**
1. User enters email, password, name on signup form
2. Frontend validates:
   - Email format (`user@domain.com`)
   - Password strength (8+ chars, 1 letter, 1 number)
3. POST `/api/auth/signup` with credentials
4. Backend processes:
   - Validates inputs
   - Hashes password with bcrypt (12 rounds)
   - Creates user record in database
   - Generates 64-character hex verification token
   - Stores token in `email_verifications` table
   - Sends verification email via Brevo
5. User clicks verification link in email
6. Backend validates token, marks user as verified
7. User can now login

**Code Example:**
```typescript
// Backend signup handler
async function signup(email: string, password: string, name?: string) {
  // 1. Validate input
  if (!isValidEmail(email)) throw new Error('Invalid email')
  
  const pwValidation = validatePasswordStrength(password)
  if (!pwValidation.valid) throw new Error(pwValidation.errors.join(', '))
  
  // 2. Hash password
  const passwordHash = await hashPassword(password)
  
  // 3. Create user
  const { data: user } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      email_verified: false
    })
    .select()
    .single()
  
  // 4. Generate verification token
  const token = generateToken()
  await supabase.from('email_verifications').insert({
    user_id: user.id,
    token,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  })
  
  // 5. Send email
  await sendVerificationEmail(email, user.id, token)
  
  return { success: true, message: 'Please check your email' }
}
```

### 3.2 Login & Token Generation

**Flow Steps:**
1. User enters email and password
2. POST `/api/auth/login`
3. Backend:
   - Finds user by email
   - Verifies password hash with bcrypt
   - Checks email_verified = true
   - Generates JWT access token (15 min expiry)
   - Generates refresh token (30 day expiry)
   - Stores refresh token in database
4. Returns access + refresh tokens
5. Client stores in localStorage

**Token Structure:**
```json
// Access Token (JWT)
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "iat": 1714665600,
  "exp": 1714666500  // 15 minutes from iat
}

// Refresh Token
"abc123def456..." (128-character hex string)
```

### 3.3 Token Refresh

**Automatic Refresh Flow:**
```
1. Client makes API call with access token
2. Server returns 401 (token expired after 15 min)
3. Client detects 401, calls /api/auth/refresh
4. Server validates refresh token from database
5. Server returns new access + refresh tokens
6. Old refresh token is revoked (rotation)
7. Client retries original request with new token
8. Request succeeds
```

**Code Example:**
```typescript
// Automatic token refresh in API client
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  try {
    return await fetchWithAuth(endpoint, options)
  } catch (error: any) {
    if (error.status === 401) {
      // Token expired, refresh automatically
      await refreshToken()
      return await fetchWithAuth(endpoint, options)
    }
    throw error
  }
}

async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken')
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  
  if (!response.ok) throw new Error('Token refresh failed')
  
  const data = await response.json()
  localStorage.setItem('accessToken', data.accessToken)
  localStorage.setItem('refreshToken', data.refreshToken)
}
```

---

## 4. Database Design

### 4.1 Schema Overview

**User Management Tables:**
- `users` - Core user data
- `refresh_tokens` - JWT refresh tokens
- `email_verifications` - Temporary verification tokens
- `password_resets` - Temporary reset tokens

**Core Data Tables:**
- `work_log_entries` - Weekly work logs
- `appraisal_criteria` - Company goals and values
- `generated_appraisals` - AI-generated content
- `reminder_logs` - Audit trail for emails

### 4.2 Detailed Table Schemas

**users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    company_name TEXT,
    job_title TEXT,
    reminder_day INTEGER DEFAULT 1,
    reminder_time TIME DEFAULT '09:00',
    reminder_enabled BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

**work_log_entries**
```sql
CREATE TABLE work_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    accomplishments TEXT NOT NULL,
    challenges TEXT NOT NULL,
    learnings TEXT NOT NULL,
    goals_next_week TEXT NOT NULL,
    hours_logged DECIMAL(4,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start_date)
);

CREATE INDEX idx_work_log_user_date ON work_log_entries(user_id, week_start_date);
```

**refresh_tokens**
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
```

**generated_appraisals**
```sql
CREATE TABLE generated_appraisals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    criteria_id UUID REFERENCES appraisal_criteria(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appraisal_user ON generated_appraisals(user_id, period_start);
```

### 4.3 Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_appraisals ENABLE ROW LEVEL SECURITY;

-- Example policies
CREATE POLICY "Users can view own data"
ON work_log_entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
ON work_log_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
ON work_log_entries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
ON work_log_entries FOR DELETE
USING (auth.uid() = user_id);
```

---

## 5. API Reference

### 5.1 Authentication Endpoints

**POST /api/auth/signup**
- Creates new user account
- Requires: email, password
- Optional: name, company_name, job_title
- Returns: 201 Created with user data

**POST /api/auth/login**
- Authenticates user
- Requires: email, password
- Optional: rememberMe (boolean)
- Returns: accessToken, refreshToken, expiresIn

**POST /api/auth/logout**
- Revokes refresh token
- Requires: Authorization header + refreshToken in body

**POST /api/auth/refresh**
- Generates new access token
- Requires: refreshToken in body
- Returns: New accessToken + refreshToken

**POST /api/auth/verify-email**
- Verifies user email
- Requires: userId, token

**POST /api/auth/forgot-password**
- Initiates password reset
- Requires: email

**POST /api/auth/reset-password**
- Resets password with token
- Requires: userId, token, newPassword

### 5.2 User Endpoints

**GET /api/users/profile**
- Gets current user profile
- Requires: Authorization header
- Returns: User profile data

**PUT /api/users/profile**
- Updates user profile
- Requires: Authorization header
- Body: name, company_name, job_title, etc.

**PUT /api/users/password**
- Changes user password
- Requires: Authorization header
- Body: currentPassword, newPassword

### 5.3 Work Log Endpoints

**GET /api/entries**
- Gets all work logs for current user
- Requires: Authorization header
- Returns: Array of work log entries

**GET /api/entries/:id**
- Gets single work log entry
- Requires: Authorization header
- Returns: Work log entry

**POST /api/entries**
- Creates new work log entry
- Requires: Authorization header
- Body: week_start_date, accomplishments, challenges, learnings, goals_next_week, hours_logged

**PUT /api/entries/:id**
- Updates work log entry
- Requires: Authorization header
- Body: Any work log fields

**DELETE /api/entries/:id**
- Deletes work log entry
- Requires: Authorization header

### 5.4 Appraisal Endpoints

**POST /api/appraisal/generate**
- Generates AI appraisal
- Requires: Authorization header
- Body: period_start, period_end, criteria_text, company_goals, values
- Returns: generated_text, word_count

**GET /api/appraisal/history**
- Gets appraisal history
- Requires: Authorization header
- Returns: Array of generated appraisals

**GET /api/appraisal/:id**
- Gets single appraisal
- Requires: Authorization header
- Returns: Appraisal data

---

## 6. Frontend Implementation

### 6.1 Component Structure

```
src/
├── components/
│   ├── Layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── Shared/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── pages/
│   ├── LandingPage.tsx
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── LogEntry.tsx
│   ├── Appraisal.tsx
│   └── Settings.tsx
├── context/
│   └── AuthContext.tsx
├── lib/
│   ├── api.ts
│   └── utils.ts
└── routes/
    └── App.tsx
```

### 6.2 Authentication Context

```typescript
// AuthContext.tsx
interface AuthContextType {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

### 6.3 API Client

```typescript
// api.ts
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('accessToken')
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Request failed')
  }
  
  return response.json()
}

// Usage
const entries = await apiRequest<WorkLogEntry[]>('/api/entries')
```

---

## 7. Deployment Guide

### 7.1 Prerequisites

- Supabase account
- Brevo account (for emails)
- Anthropic account (for AI)
- Vercel account (frontend hosting)
- Render account (backend hosting)
- GitHub account (code repository)

### 7.2 Database Setup

1. Create Supabase project
2. Run `supabase-schema-custom-auth.sql` in SQL Editor
3. Note your project URL and service key

### 7.3 Backend Deployment (Render)

1. Create new Web Service on Render
2. Connect GitHub repository
3. Configure:
   - Root Directory: `server`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Instance Type: Free (development) or Starter (production)

4. Add environment variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key
   JWT_SECRET=your-32-char-secret
   BREVO_API_KEY=your-brevo-key
   ANTHROPIC_API_KEY=your-anthropic-key
   FRONTEND_URL=https://your-app.vercel.app
   NODE_ENV=production
   ```

### 7.4 Frontend Deployment (Vercel)

1. Import GitHub repository to Vercel
2. Configure:
   - Framework Preset: Vite
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. Add environment variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_API_URL=https://your-backend.onrender.com
   ```

### 7.5 Post-Deployment Verification

1. Test health check: `https://your-backend.onrender.com/health`
2. Test signup flow
3. Verify email sending
4. Test login and protected routes
5. Generate test appraisal

---

## 8. Security Measures

### 8.1 Authentication Security

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: 15-minute access token, 30-day refresh token
- **Token Rotation**: New refresh token on each refresh
- **Email Verification**: Required before login
- **Rate Limiting**: 20 login attempts per hour

### 8.2 Database Security

- **Row Level Security (RLS)**: All queries scoped to `user_id`
- **Foreign Key Constraints**: CASCADE delete for user data
- **Parameterized Queries**: Prevent SQL injection
- **Unique Constraints**: Email uniqueness, weekly log uniqueness

### 8.3 API Security

- **CORS Configuration**: Restricted to allowed origins
- **Rate Limiting**: 100 requests per 15 minutes
- **Input Validation**: All endpoints validate inputs
- **HTTPS Only**: All communication encrypted

### 8.4 Environment Secrets

```bash
# Never commit .env to git
.env/
node_modules/
*.log
.DS_Store
```

Store secrets in:
- Vercel Dashboard (frontend)
- Render Dashboard (backend)
- Use environment variables, never hardcode

---

## 9. Cost Structure

### 9.1 Free Tier (0-100 users)

| Service | Cost | Capacity |
|---------|------|----------|
| Supabase Database | $0 | 500MB, 5000 users |
| Brevo Email | $0 | 300 emails/day |
| Render Backend | $0 | 750 hours/month |
| Vercel Frontend | $0 | 100GB bandwidth |
| Anthropic AI | Pay-as-you-go | ~$0.065/appraisal |

**Total Monthly Cost: $0 + AI usage**

### 9.2 Growth Tier (100-1,000 users)

| Service | Cost | Notes |
|---------|------|-------|
| Supabase Pro | $25 | 8GB database |
| Render Starter | $7 | No sleeping |
| Brevo Free | $0 | Still at capacity |
| AI Costs | ~$20 | 50 appraisals/day |

**Total: ~$52/month**

### 9.3 Revenue Model

- **Free Tier**: 1 appraisal/month (cost: $0.065)
- **Pro Tier**: $5/month unlimited
- **Break-even**: 13 pro users ($65 revenue vs $52 cost)
- **Profit at 100 pro users**: $448/month
- **Profit at 1,000 pro users**: $4,850/month

---

## 10. Troubleshooting

### 10.1 Common Issues

**Issue: 401 Unauthorized**
- Cause: Token expired or invalid
- Solution: Check localStorage for tokens, try re-login

**Issue: 403 Forbidden**
- Cause: Email not verified
- Solution: Run `UPDATE users SET email_verified = true WHERE email = 'user@example.com'`

**Issue: 500 Internal Server Error**
- Cause: Missing environment variables or database connection
- Solution: Check server logs, verify Supabase credentials

**Issue: CORS errors**
- Cause: FRONTEND_URL not set correctly
- Solution: Update Render environment variable to match your Vercel URL

**Issue: Emails not sending**
- Cause: Brevo API key missing or domain not verified
- Solution: Check BREVO_API_KEY, verify domain in Brevo dashboard

### 10.2 Debugging Steps

1. **Check Health Endpoint**: `https://your-backend.onrender.com/health`
2. **Review Server Logs**: Render dashboard → Logs
3. **Check Database**: Supabase dashboard → Table Editor
4. **Test API Directly**: Use Postman or curl
5. **Console Logs**: Frontend browser console → Network tab

### 10.3 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Brevo Docs**: https://developers.brevo.com
- **Anthropic Docs**: https://docs.anthropic.com
- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs

---

## Appendix A: Environment Variables Reference

### Backend (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=32+character-random-string
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM_EMAIL=noreply@yourdomain.com
BREVO_FROM_NAME=Worklog AI
FRONTEND_URL=https://your-frontend.vercel.app
ANTHROPIC_API_KEY=your-anthropic-key
NODE_ENV=production
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
PORT=3001
```

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_API_URL=https://your-backend.onrender.com
```

---

## Appendix B: Database Migration Scripts

File: `supabase-schema-custom-auth.sql`

```sql
-- Creates all tables, indexes, and policies
-- Run in Supabase SQL Editor
-- See full script in repository root
```

---

## Appendix C: API Testing Examples

### Using curl

```bash
# Signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get Profile (with token)
curl http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Create Work Log
curl -X POST http://localhost:3001/api/entries \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "week_start_date": "2026-05-01",
    "accomplishments": "Built auth system",
    "challenges": "Debugged JWT",
    "learnings": "Learned bcrypt",
    "goals_next_week": "Deploy"
  }'
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-02  
**Maintained By**: Worklog AI Team
