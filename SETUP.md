# Worklog AI - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd "D:\Vibe Coded\worklog-ai"
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase-schema.sql`
3. Get your credentials:
   - Project URL (Settings → API)
   - Anon/Public key (Settings → API)
   - Service role key (Settings → API → Service role)
4. Configure Supabase Auth email delivery with Resend:
   - Go to Authentication → Email → SMTP Settings
   - Host: `smtp.resend.com`
   - Port: `465` or `587`
   - Username: `resend`
   - Password: your Resend API key
   - From name/address: use a verified sender from your Resend domain

### 3. Configure Environment Variables

**Server (`server/.env`):**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com
JWT_SECRET=change-this-to-a-random-string
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Client (`client/.env`):**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001
```

### 4. Run Development Servers

```bash
# From root directory
npm run dev
```

This starts both:
- Client: http://localhost:5173
- Server: http://localhost:3001

## Project Structure

```
worklog-ai/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   └── api.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── LogEntry.tsx
│   │   │   └── Appraisal.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── .env.example
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── entries.ts
│   │   │   └── appraisal.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── anthropic.ts
│   │   │   └── email.ts
│   │   ├── jobs/
│   │   │   └── reminderJob.ts
│   │   └── index.ts
│   ├── package.json
│   └── .env.example
├── shared/
│   └── index.ts
├── supabase-schema.sql
└── SETUP.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Send magic link |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/entries` | Get all logs |
| POST | `/api/entries` | Create log |
| GET | `/api/entries/:id` | Get single log |
| PUT | `/api/entries/:id` | Update log |
| DELETE | `/api/entries/:id` | Delete log |
| POST | `/api/appraisal/generate` | Generate appraisal |
| GET | `/api/appraisal/history` | Get history |
| GET | `/api/appraisal/:id` | Get single appraisal |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home page with features |
| `/login` | Magic link login |
| `/log` | Weekly work log form (protected) |
| `/appraisals` | Generate and view appraisals (protected) |

## Development Checklist

### Phase 0 - Scaffold ✅
- [x] Monorepo structure
- [x] Root package.json with workspaces
- [x] TypeScript configs
- [x] Environment variable templates

### Phase 1 - Database Schema ✅
- [x] Supabase schema with RLS
- [x] User profiles table
- [x] Work log entries table
- [x] Generated appraisals table
- [x] Reminder logs table

### Phase 2 - Backend ✅
- [x] Server entry point
- [x] Supabase admin client
- [x] Auth middleware
- [x] Entries routes (CRUD)
- [x] Appraisal generation route
- [x] Weekly reminder job
- [x] Email service

### Phase 3 - Frontend ✅
- [x] Supabase client
- [x] Auth context
- [x] API hooks
- [x] App routing
- [x] Layout component
- [x] Login page
- [x] LogEntry page (weekly form)
- [x] Appraisal page (AI generation)

### Phase 4 - Polish (Next)
- [ ] Input validation with Zod
- [ ] Loading states
- [ ] Error boundaries
- [ ] Responsive design improvements
- [ ] Tags/projects for log entries
- [ ] Export appraisal as PDF

### Phase 5 - Deployment
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Configure production environment variables
- [ ] Set up production cron job

## Troubleshooting

**CORS errors:** Check `FRONTEND_URL` in server `.env` matches your dev server

**Auth not working:** Verify Supabase anon key in client `.env`

**Email not sending:** Check Resend API key and `FROM_EMAIL`

**Magic link limit / email delivery issues:** Confirm Supabase Auth SMTP is configured to use Resend and that your Resend domain is verified.

**401 errors:** Ensure you're passing `Authorization: Bearer <token>` header

**Claude API errors:** Check `ANTHROPIC_API_KEY` is valid
