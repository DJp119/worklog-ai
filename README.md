# Worklog AI

Weekly work log tracker with AI-generated self-appraisals.

## Core Loop

1. **Weekly reminder email** → user logs work (5 min)
2. **Entries accumulate** over the appraisal period
3. **At appraisal time** → user inputs criteria → AI writes the text
4. **User copies, pastes, submits**

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Auth | Supabase Auth (magic link) |
| Database | Supabase Postgres |
| Backend | Node.js + Express + TypeScript |
| AI | Anthropic Claude API |
| Email | Resend + Nodemailer |
| Scheduler | node-cron |
| Deploy FE | Vercel |
| Deploy BE | Railway |

## Monorepo Structure

```
worklog-ai/
├── client/          # React + Tailwind (Vite)
├── server/          # Node.js + Express
├── shared/          # Shared TypeScript types
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- Anthropic API key
- Resend API key (for email)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp client/.env.example client/.env
cp server/.env.example server/.env

# Fill in your environment variables
```

### Development

```bash
# Run both client and server
npm run dev

# Or run separately
npm run dev:client
npm run run dev:server
```

## Environment Variables

### Client (.env)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key
- `VITE_API_URL` - Backend API URL

### Server (.env)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `RESEND_API_KEY` - Resend email API key
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - development/production

## License

MIT
