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
| AI | Mistral AI API |
| Email | Supabase Auth SMTP via Resend + Nodemailer |
| Scheduler | node-cron |
| Deploy FE | Vercel |
| Deploy BE | Render |

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
- Mistral API key
- Resend API key (for reminder emails and Supabase Auth SMTP)

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
- `MISTRAL_API_KEY` - Mistral API key
- `RESEND_API_KEY` - Resend email API key for reminder emails and Supabase Auth SMTP
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - development/production

### Supabase Auth Email Delivery

Supabase sends the magic-link login emails. To avoid Supabase free-trial email limits, configure custom SMTP in your Supabase project and point it at Resend:

- Host: `smtp.resend.com`
- Port: `465` or `587`
- Username: `resend`
- Password: your Resend API key

In Supabase Dashboard, go to `Authentication -> Email -> SMTP Settings` and save the Resend credentials there.

## License

MIT
