# Beginner-Friendly Glossary

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Beginner, Junior

---

## How to use this glossary

Every technical term in this documentation should be defined here the first time
it appears. Terms are listed alphabetically. Each entry has:

1. **Simple explanation** — everyday analogy
2. **Technical explanation** — what it actually is in software
3. **Where it appears** — key files or concepts in this codebase

---

## A

### API (Application Programming Interface)

**Simple:** A menu in a restaurant. You (the frontend) tell the waiter (the API) what you want, and the kitchen (the backend) makes it.

**Technical:** A set of HTTP endpoints that the frontend calls to read/write data. In this project: `GET /api/entries`, `POST /api/auth/login`, etc.

**Where:** `server/src/routes/*.ts`, `client/src/lib/api.ts`

### API Key

**Simple:** A password for a service that lets your code talk to their API.

**Technical:** A long random string sent in an HTTP header (`Authorization: Bearer ...` or `api-key: ...`) to authenticate machine-to-machine requests.

**Where:** `MISTRAL_API_KEY`, `BREVO_API_KEY`, `GITHUB_CLIENT_SECRET`, etc.

### Async / Await

**Simple:** "Start this task, and I'll come back for the result later." Like ordering coffee and waiting for your name to be called.

**Technical:** JavaScript syntax for handling Promises. `async function` returns a Promise; `await` pauses until the Promise resolves.

**Where:** Every route handler (`async (req, res) => { ... }`), `apiRequest`, database calls.

---

## B

### Backend

**Simple:** The kitchen. You don't see it, but it does the real work: cooking (processing), storing ingredients (database), talking to suppliers (external APIs).

**Technical:** The Express server (`server/`) that runs on Render. Handles authentication, database queries, AI calls, emails, webhooks, cron jobs.

**Where:** `server/src/index.ts`, `server/src/routes/`, `server/src/services/`, `server/src/jobs/`

### bcrypt

**Simple:** A way to scramble a password so it can't be unscrambled, but you can still check if a guess is right.

**Technical:** A slow, salted password hashing algorithm. Cost factor 12 in this project. Used in `lib/auth-utils.ts:hashPassword` / `comparePassword`.

**Where:** `server/src/lib/auth-utils.ts`, `server/src/routes/auth.ts`

### Bearer Token

**Simple:** A VIP pass you show at the door. "I have this pass, let me in."

**Technical:** An HTTP Authorization header: `Authorization: Bearer <JWT>`. The JWT proves identity without sending the password every time.

**Where:** `client/src/lib/api.ts:48-50`, `server/src/middleware/auth.ts:144-153`

---

## C

### CI/CD (Continuous Integration / Continuous Deployment)

**Simple:** A robot that checks your work every time you save, and automatically publishes it if it passes.

**Technical:** Automated pipelines (GitHub Actions, etc.) that run typecheck, lint, tests, and deploy on merge. **Not present in this repo.**

**Where:** Would be `.github/workflows/` (missing)

### Client / Frontend

**Simple:** The dining room. What the customer sees and interacts with: menus (UI), waiters (API calls), food arriving (data updates).

**Technical:** The React SPA (`client/`) built with Vite, deployed to Vercel. Runs in the browser.

**Where:** `client/src/main.tsx`, `client/src/App.tsx`, `client/src/pages/`, `client/src/components/`

### Closure Table

**Simple:** A family tree written as a list of "who is whose ancestor." Makes it instant to answer "is Alice a great-grandparent of Bob?"

**Technical:** A table (`team_closure`) storing every ancestor-descendant pair with `depth`. Rebuilt on team changes. Used for O(1) hierarchy queries.

**Where:** `supabase-migrations/2026-06-16_teams_goals_integrations.sql:182`, `server/src/services/teamService.ts`

### CORS (Cross-Origin Resource Sharing)

**Simple:** A bouncer at the API door. "Only these websites can call me."

**Technical:** HTTP headers (`Access-Control-Allow-Origin`) that tell browsers which origins may call the API. Configured in `server/src/index.ts:79-95`.

**Where:** `server/src/index.ts:79-95`

### Cron Job

**Simple:** An alarm clock that runs a script at a set time. "Every Monday at 9 AM, send reminder emails."

**Technical:** `node-cron` schedules functions inside the Node process. 11 jobs in `server/src/jobs/`.

**Where:** `server/src/jobs/*.ts`, `server/src/index.ts:312-330`

---

## D

### Database (Postgres / Supabase)

**Simple:** A giant, organized spreadsheet that many people can use at once, with rules to keep data correct.

**Technical:** PostgreSQL hosted by Supabase. 47 tables. Accessed via `@supabase/supabase-js` client. Service-role key bypasses RLS.

**Where:** `server/src/lib/database.ts`, all route handlers, all jobs

### Dependency Injection

**Simple:** Instead of a class creating its own tools, someone hands it the tools. "Here's your hammer" vs "go buy a hammer."

**Technical:** Pattern where dependencies are passed in, not imported. **Not used in this project** — modules import singletons directly.

**Where:** Not used (modules import `supabase`, `mistral`, etc. directly)

### DevOps

**Simple:** The team that builds the kitchen, installs the plumbing, and keeps the restaurant running.

**Technical:** Practices for deployment, monitoring, CI/CD, infrastructure as code. In this repo: Render, Vercel, Supabase, manual SQL.

---

## E

### Endpoint

**Simple:** A specific door in the API. "Knock on `/api/entries` to get your work logs."

**Technical:** An HTTP route + method: `GET /api/entries`, `POST /api/auth/login`. 112 total in this project.

**Where:** `server/src/routes/*.ts`, `docs/06-api-reference/`

### Environment Variable

**Simple:** A setting stored outside the code, like a config file. "The API URL is `https://api.example.com`."

**Technical:** `process.env.VAR_NAME`. Loaded from `.env` files via `dotenv`. Different per environment (local, prod).

**Where:** `client/.env`, `server/.env`, `docs/10-environment-and-deployment/environment-variables.md`

### Express

**Simple:** The most popular waiter framework for Node.js. Handles "who's at the door" (routing) and "what do they want" (request parsing).

**Technical:** `express` npm package. Creates the HTTP server, mounts routers, runs middleware.

**Where:** `server/src/index.ts`, `server/package.json`

---

## F

### Frontend

See **Client / Frontend**.

### Framework

**Simple:** A pre-built kitchen with standardized tools. You don't build the stove; you just cook.

**Technical:** A library that provides structure (React for UI, Express for API, Vite for build). You write code *inside* the framework.

---

## G

### Git

**Simple:** A time machine for code. Save snapshots (commits), branch off to experiment, merge back.

**Technical:** Distributed version control. This repo uses `git` with `main` branch.

### GraphQL

**Simple:** A buffet where you ask for exactly what you want. "Give me the user's name and their last 3 entries."

**Technical:** Query language for APIs. **Not used in this project** — uses REST (fixed endpoints).

---

## H

### HMAC (Hash-based Message Authentication Code)

**Simple:** A tamper-proof seal on a letter. Only someone with the secret key could have sealed it.

**Technical:** `crypto.createHmac('sha256', secret).update(payload).digest('hex')`. Used to verify webhook signatures (GitHub, Slack).

**Where:** `server/src/lib/webhookSecurity.ts`

### HTTP (HyperText Transfer Protocol)

**Simple:** The language browsers and servers speak. "GET me the menu" / "Here's the menu."

**Technical:** Request/response protocol. Methods: GET, POST, PUT, PATCH, DELETE. Status codes: 200, 401, 404, 500.

**Where:** Every API call

### httpOnly Cookie

**Simple:** A cookie the browser stores but JavaScript *cannot read*. Like a note in your pocket you can't see but the waiter can.

**Technical:** `Set-Cookie: token=xyz; HttpOnly; Secure; SameSite=Strict`. **Not used in this project** — tokens in localStorage.

---

## I

### Idempotent

**Simple:** Doing it twice has the same effect as once. Pressing an elevator button twice doesn't make it arrive faster.

**Technical:** An operation where repeating it doesn't change the result. `PUT`/`DELETE` should be idempotent. Migration `IF NOT EXISTS` is idempotent.

**Where:** Migration scripts, `PUT`/`DELETE` handlers

### JWT (JSON Web Token)

**Simple:** A signed ID card. "I am user 123, signed by the government (server). Expires in 15 min."

**Technical:** Base64-encoded header.payload.signature. Signed with `JWT_SECRET` (HS256). Contains `userId`, `email`. 15-min expiry.

**Where:** `server/src/middleware/auth.ts:41`, `client/src/lib/api.ts`

---

## J

### Jira / GitHub / Slack (Integrations)

**Simple:** Other tools your team uses. The app can talk to them: "Hey Jira, give me issue ABC-123."

**Technical:** OAuth 2.0 flows, REST APIs, webhooks. Adapters in `lib/jiraAdapter.ts`, `githubAdapter.ts`, `slackAdapter.ts`.

**Where:** `server/src/routes/integrations.ts`, `server/src/routes/webhooks/*.ts`, `server/src/lib/*Adapter.ts`

---

## K

*(no entries)*

---

## L

### localStorage / sessionStorage

**Simple:** Browser storage that survives reloads (`localStorage`) or only the tab (`sessionStorage`). Like a notebook vs a sticky note.

**Technical:** `window.localStorage.setItem('key', 'value')`. **Used for JWT storage in this project** — vulnerable to XSS.

**Where:** `client/src/lib/authStorage.ts`, `client/src/context/AuthContext.tsx`

---

## M

### Middleware

**Simple:** A security guard at each door. Checks your ID before you enter the room.

**Technical:** Express function `(req, res, next) => { ... }` that runs before route handlers. Can modify `req`, block request, or pass to `next()`.

**Where:** `server/src/middleware/auth.ts`, `requestId.ts`, `tierGate.ts`, `index.ts` (global)

### Migration (Database)

**Simple:** A script that changes the spreadsheet structure. "Add a 'phone' column to the users sheet."

**Technical:** SQL file with `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`. Applied manually in order. No runner in this repo.

**Where:** `migrations/*.sql`, `supabase-migrations/*.sql`, `supabase-schema*.sql`

### Monorepo

**Simple:** One Git repo holding multiple projects that share code.

**Technical:** npm workspaces: `client/`, `server/`, `shared/` in one repo. `package.json` at root with `workspaces: ["client", "server", "shared"]`.

**Where:** Root `package.json`, `tsconfig.json` (project references)

### MVC (Model-View-Controller)

**Simple:** Separate the data (Model), the look (View), and the logic (Controller).

**Technical:** Architectural pattern. **Partially present** — Routes ≈ Controller, Supabase ≈ Model, React ≈ View. No strict separation.

---

## N

### Node.js

**Simple:** JavaScript running on the server (not in the browser). Like a chef who knows JavaScript.

**Technical:** Runtime for `server/`. Version 20. Runs `index.ts` via `tsx` (dev) or compiled `dist/index.js` (prod).

**Where:** `server/package.json`, `nixpacks.toml`

### npm (Node Package Manager)

**Simple:** The app store for JavaScript tools. `npm install` downloads all ingredients.

**Technical:** Package manager. Workspaces enabled in root `package.json`.

**Where:** `package.json`, `package-lock.json`

---

## O

### OAuth 2.0

**Simple:** "Login with Google/GitHub/Slack." You approve the app, it gets a key to access your data.

**Technical:** Authorization framework. Flows: Authorization Code (user), Client Credentials (machine). Used for Jira, GitHub, Slack.

**Where:** `server/src/routes/integrations.ts`, `lib/*OAuth.ts`, `lib/*Adapter.ts`

### ORM (Object-Relational Mapper)

**Simple:** A translator between objects (code) and tables (database). "Save this User object" → `INSERT INTO users...`

**Technical:** **Not used** — this project uses Supabase PostgREST query builder directly.

---

## P

### Pagination

**Simple:** Showing 20 items per page instead of all 10,000 at once.

**Technical:** `LIMIT 20 OFFSET 40` or cursor-based (`WHERE id > 'last_seen'`). **Missing on several list endpoints.**

**Where:** Missing on `GET /api/entries`, `/api/goals`, `/api/orgs`, etc.

### PostgREST

**Simple:** An automatic API on top of Postgres. "SELECT * FROM users" becomes `GET /users`.

**Technical:** What `@supabase/supabase-js` talks to. Generates REST from Postgres schema.

**Where:** `server/src/lib/database.ts` → `supabase.from('table')`

### Promise

**Simple:** An IOU for a future value. "I'll give you the answer when I have it."

**Technical:** Object representing eventual completion of async work. `.then()`, `.catch()`, or `await`.

**Where:** Every async function, `fetch`, Supabase queries

---

## Q

*(no entries)*

---

## R

### React

**Simple:** A LEGO set for building UIs. Components snap together; when data changes, only affected pieces rebuild.

**Technical:** `react` + `react-dom` v19. Components in `client/src/components/`, pages in `client/src/pages/`.

**Where:** `client/src/main.tsx`, `client/src/App.tsx`, `client/src/components/`, `client/src/pages/`

### REST (Representational State Transfer)

**Simple:** A convention for API doors. `GET /entries` = list, `POST /entries` = create, `PUT /entries/1` = update.

**Technical:** HTTP methods + resource URLs. This project uses REST (not GraphQL).

**Where:** `server/src/routes/*.ts`

### RLS (Row Level Security)

**Simple:** A rule on each spreadsheet row: "Only the owner can see this row."

**Technical:** Postgres policies (`CREATE POLICY ... USING (auth.uid() = user_id)`). **Bypassed by service-role key** in this project.

**Where:** `supabase-schema.sql`, `supabase-migrations/*.sql`

### Route / Router

**Simple:** A map of doors. "All auth doors are under `/api/auth`."

**Technical:** `express.Router()` mounted at a path. 21 routers in `server/src/routes/`.

**Where:** `server/src/index.ts:184-204`, `server/src/routes/*.ts`

---

## S

### Schema (Database)

**Simple:** The blueprint of the spreadsheet: tables, columns, types, relationships.

**Technical:** `CREATE TABLE` statements. 47 tables across 14 SQL files.

**Where:** `supabase-schema.sql`, `supabase-migrations/*.sql`, `docs/07-database/schema.md`

### Service Role (Supabase)

**Simple:** A master key that ignores all row security rules. Use with extreme caution.

**Technical:** `SUPABASE_SERVICE_KEY` used in `server/src/lib/database.ts`. Bypasses RLS. **All authorization must be in Node code.**

**Where:** `server/src/lib/database.ts:41`, `server/src/middleware/auth.ts:1-6`

### SPA (Single Page Application)

**Simple:** One HTML page that never reloads. Clicking links swaps components instantly.

**Technical:** React + React Router. `index.html` + JS bundle. Vercel rewrites all paths to `index.html`.

**Where:** `client/`, `client/vercel.json`, `client/src/App.tsx`

### SQL (Structured Query Language)

**Simple:** The language to talk to the spreadsheet. "SELECT name FROM users WHERE email = 'x'"

**Technical:** Standard relational query language. Used in migrations and Supabase queries.

**Where:** `supabase-schema*.sql`, `migrations/*.sql`

### SSE (Server-Sent Events)

**Simple:** A one-way phone line from server to browser. Server talks, browser listens.

**Technical:** `text/event-stream` response. Used for chat streaming (`/api/chat/sessions/:id/messages`).

**Where:** `server/src/lib/chatService.ts`, `client/src/lib/useSSE.ts`

### Supabase

**Simple:** Firebase alternative built on Postgres. Database + Auth + Storage + Realtime + API.

**Technical:** This project uses **only Database** (Postgres) via service-role. **Not** Supabase Auth.

**Where:** `server/src/lib/database.ts`, `client/src/lib/supabase.ts`

---

## T

### Token (Auth)

**Simple:** A temporary key that proves who you are without sending your password every time.

**Technical:** JWT (access, 15 min) + opaque refresh token (7/30 days, SHA-256 hashed in DB).

**Where:** `server/src/middleware/auth.ts`, `client/src/context/AuthContext.tsx`

### TypeScript

**Simple:** JavaScript with training wheels. Types catch bugs before you run the code.

**Technical:** `typescript` v5.7. Strict mode. Shared types in `shared/`.

**Where:** `tsconfig.json`, `shared/src/index.ts`, all `.ts`/`.tsx` files

---

## U

### Upsert

**Simple:** "Insert this row, but if it already exists, update it instead."

**Technical:** `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` or Supabase `.upsert()`.

**Where:** `auth.ts:108` (user_profiles), `channelPreferences.ts` (preferences)

---

## V

### Vercel

**Simple:** A hosting platform for frontends. Push code → it builds → it's live.

**Technical:** Deploys `client/` (Vite SPA) and `worklog-marketing/` (Next.js). Handles SSL, CDN, domains.

**Where:** `client/vercel.json`, `worklog-marketing/vercel.json`

### Vite

**Simple:** A lightning-fast build tool for frontend. "Save file → see change in 50ms."

**Technical:** Build tool for `client/`. Dev server, TypeScript, React plugin, Tailwind.

**Where:** `client/vite.config.ts`, `client/package.json`

---

## W

### Webhook

**Simple:** A reverse API call. "When something happens in Jira, call my `/api/webhooks/jira`."

**Technical:** HTTP POST from external service to your endpoint. Verified by HMAC signature.

**Where:** `server/src/routes/webhooks/*.ts`, `lib/webhookSecurity.ts`

### Workspace (npm)

**Simple:** A sub-project inside a monorepo. `client/`, `server/`, `shared/` are workspaces.

**Technical:** `workspaces: ["client", "server", "shared"]` in root `package.json`.

**Where:** Root `package.json`

---

## X, Y, Z

*(no entries)*

---

## Related documents

- [Learning path](./how-to-understand-this-codebase.md)
- [Project overview](../01-project-overview.md)

## Verification notes

Glossary terms extracted from all documentation files at commit `7567207`.
Each term includes the simple/technical explanation pattern required by the
authoring guide.