# File-by-File Explanation: Client (`client/`)

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Root Config & Static Assets (`client/`)

| File | Role | Notes |
|---|---|---|
| `client/package.json` | Client npm manifest | React 19.1, Vite 6.2, Tailwind 3.4, Router 7.2, i18next 26.3, PostHog, LogRocket (`unused` in `src/`), `@supabase/supabase-js`, `@vercel/analytics`. No `test` script declared. |
| `client/index.html` | SPA HTML shell | SEO/OpenGraph metadata, JSON-LD, Google Fonts link, `<div id="root">`, loads `/src/main.tsx`. |
| `client/vite.config.ts` | Vite bundler config | Aliases `shared` → `../shared`, proxies `/api` to `:3001`, injects CSS via JS plugin, chunks React vendor bundle. (`vite.config.js` & `.d.ts` are generated build artifacts.) |
| `client/tsconfig.json` | Strict TypeScript config | `strict: true`, `noUnusedLocals: true`, `paths: { "shared/*": ["../shared/*"] }`. |
| `client/tsconfig.node.json` | Vite Node TS config | Compiles `vite.config.ts`. |
| `client/eslint.config.js` | ESLint 9 flat config | `react-hooks` + `react-refresh` plugins over `**/*.{ts,tsx}`. |
| `client/tailwind.config.js` | Tailwind 3 content paths | Scans `index.html` and `src/**/*.{js,ts,jsx,tsx}`. |
| `client/postcss.config.js` | PostCSS plugins | Enables `tailwindcss` and `autoprefixer`. |
| `client/vercel.json` | Vercel SPA hosting rules | Security headers + CSP, `/api/:path*` proxy rewrite to Render, SPA rewrite to `/index.html`. |
| `client/.env.example` | Sample frontend env template | Documents `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, PostHog keys. |
| `client/public/sw.js` | Web Push Service Worker | Listens to `push` events (`showNotification`) and `notificationclick` (`clients.openWindow`). |
| `client/public/manifest.json` | PWA web app manifest | Defines **Impactly AI** branding, `#0a0a0f` dark theme, 4 icon sizes. |
| `client/public/robots.txt` | Crawler rules | Allows public pages & AI bots; disallows authenticated app routes (`/dashboard`, `/log`, `/appraisals`, `/chat`, `/settings`, `/feedback`, etc.). |
| `client/public/sitemap.xml` | Static XML sitemap | Lists `/`, `/login`, `/terms`, `/privacy`, `/ai-pulse`. |
| `client/public/llms.txt` | LLM discovery summary | Summarizes product positioning (note: claims Google/GitHub login, which does not exist in `Login.tsx`). |
| `client/public/favicon.*`, `apple-touch-icon.png`, `mstile-150x150.png`, `og-default.*`, `vite.svg` | Brand icons & OG graphics | Generated mostly by `scripts/generate_brand_assets.py`. |
| `client/public/locales/en/base.json` | Public copy of English i18n strings | Same 742-line JSON shape, differs in ~380 diff lines vs `client/src/locales/en/base.json` (possible drift). |
| `client/public/scripts/vercel-prepare-output.mjs` | Re-export shim | Re-exports `../../../scripts/vercel-prepare-output.mjs`. |

---

## 2. Entry, Contexts, Hooks & i18n (`client/src/`)

| File (LOC) | Role | Key Exports |
|---|---|---|
| `client/src/main.tsx` (42) | Browser entry point | Initializes i18n, deferred PostHog (`startPosthog`), registers `/sw.js`, renders `<App />` inside `<BrowserRouter>`. |
| `client/src/App.tsx` (217) | Top-level router & guards | `ProtectedRoute`, `OnboardingRoute`, `AppRoutes`, `App`; lazy-loads 21 pages. |
| `client/src/index.css` (271) | Global Tailwind & theme utilities | Dark grid `.bg-futuristic`, `.glass`, `.glass-strong`, glow utilities, RTL scrollbar tweaks. |
| `client/src/vite-env.d.ts` (18) | Vite `ImportMetaEnv` types | Declares `VITE_SUPABASE_*`, `VITE_API_URL`, PostHog env vars. |
| `client/src/types/lucide-react-icons.d.ts` (7) | TS module declaration | Types deep ESM `lucide-react/dist/esm/icons/*.mjs` imports. |
| `client/src/context/AuthContext.tsx` (290) | Auth state & token refresher | `AuthProvider`, `useAuth`, `AuthError`; loads tokens, refreshes every 14 min, manages login/signup/logout/verify/profile refresh. |
| `client/src/context/SubscriptionContext.tsx` (60) | Org tier & feature context | `SubscriptionProvider`, `useSubscription`; unauthenticated `/api/subscriptions/${orgId}` fetch fails 401 and defaults to `'free'`. |
| `client/src/hooks/useHasOrg.ts` (34) | Checks if user belongs to >= 1 org | Queries `/api/orgs` via `apiRequest`; drives conditional nav tabs in `Layout.tsx`. |
| `client/src/hooks/useIsLoggedIn.ts` (21) | Synchronous token check hook | Reads `localStorage`/`sessionStorage` token presence for LandingPage CTAs. |
| `client/src/hooks/usePageMeta.ts` (85) | Per-page `<title>`, `<meta>`, canonical & robots tags | Mutates DOM `<head>` tags and restores clean state on navigation. |
| `client/src/hooks/useTeamRole.ts` (54) | Fetches caller's effective role in a team | Calls `GET /api/teams/:teamId/my-role` via `apiRequest` to show/hide goal actions in UI. |
| `client/src/i18n/index.ts` (91) | i18next config + HTTP backend loader | Bundles `en/base.json`, loads non-English languages from `/api/translate/:lang`, exposes `isRtl()` and `applyDir()`. |
| `client/src/i18n/useAutoLocale.ts` (99) | Auto language & webfont loader hook | Syncs document `lang` + `dir` (`rtl` for `ar`/`ur`), injects CJK/Indic/Arabic fonts dynamically, exports 20-language `supportedLanguages()`. |
| `client/src/locales/en/base.json` (742) | Primary English translation source | Key-value dictionary used by `i18next` and translated on demand by server `routes/translate.ts`. |

---

## 3. Client API & Helper Libraries (`client/src/lib/`)

| File (LOC) | Role | Key Exports |
|---|---|---|
| `client/src/lib/analytics.ts` (31) | Browser PostHog initializer | Dynamic-imports `posthog-js` lazily via `initAnalytics()` and exports `posthog`. |
| `client/src/lib/api.ts` (273) | Core authenticated REST client | `apiRequest()`, `refreshAccessToken()`, plus CRUD functions for entries, appraisals, user profile, waitlist, feedback. |
| `client/src/lib/authStorage.ts` (43) | Storage abstraction (`local` vs `session`) | `getStoredTokens()`, `storeStoredTokens()`, `clearStoredTokens()`. |
| `client/src/lib/chatApi.ts` (47) | AI chat REST endpoints | Session list/create/delete and message history fetchers. |
| `client/src/lib/formatters.ts` (54) | Locale-aware `Intl` formatters | `formatDate()`, `formatTime()`, `formatNumber()`, `formatRelativeTime()`, `getLocalizedDayNames()`, `formatHourOption()`. |
| `client/src/lib/goalsApi.ts` (192) | Goals, KRs, assignees, links, check-ins API | Exposes `GOAL_SCOPES`, `GOAL_PERIODS`, `PROGRESS_MODES`, `METRIC_TYPES` and 12 API wrappers. |
| `client/src/lib/integrationsApi.ts` (189) | Jira, GitHub, Slack OAuth & PIN APIs | 17 typed integration API wrappers for user + org connections. |
| `client/src/lib/onboardingOptions.ts` (45) | Static profile dropdown lists | `INDUSTRY_OPTIONS`, `FUNCTION_OPTIONS`, `YEARS_EXPERIENCE_OPTIONS`, `COMPANY_SIZE_OPTIONS`, `REVIEW_FREQUENCY_OPTIONS`. |
| `client/src/lib/push.ts` (80) | Web Push registration helper | `getVapidPublicKey()`, `urlBase64ToUint8Array()` (ESLint error line 16), `subscribeToPushNotifications()`, `unsubscribeFromPushNotifications()`. |
| `client/src/lib/supabase.ts` (11) | Browser Supabase anon client | Creates `supabase` client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. |
| `client/src/lib/teamsApi.ts` (161) | Orgs, departments, teams, closure rebuild API | 13 wrappers covering `/api/orgs` and `/api/teams`. |
| `client/src/lib/useSSE.ts` (117) | Streaming chat SSE hook | Reads `ReadableStream` from `POST /api/chat/sessions/:id/messages`, emits chunks/done/error, refreshes token on 401. |

---

## 4. Components (`client/src/components/`)

| File (LOC) | Purpose |
|---|---|
| `LandingPage.tsx` (437) | Public home page featuring hero email capture, `PlaygroundWidget`, `PainGrid`, `PricingSection`, `FaqAccordion`, security claims, footer. |
| `Layout.tsx` (333) | App navbar, sidebar/mobile menu, conditional org/goal tabs (`useHasOrg`), language selector, logout action. |
| `LanguageSwitcher.tsx` (76) | Compact header dropdown switching UI language & calling `updateProfile` if logged in. |
| `Chat/ChatWindow.tsx` (208) | Interactive AI Critique Chat view using `useSSE` to stream replies live. |
| `Chat/MessageBubble.tsx` (98) | Renders user/assistant markdown-like bubbles and timestamps (`formatContent`). |
| `Chat/SessionList.tsx` (136) | Sidebar listing past chat sessions plus modal/form to start a new review date range session. |
| `ai-pulse/BookmarkBtn.tsx` (92) | Bookmark toggle calling `/api/ai-pulse/bookmarks` with optimistic feedback. |
| `ai-pulse/ImpactCard.tsx` (206) | Industry AI impact card displaying opportunities, risks, tools, and predictions. |
| `ai-pulse/SEOHead.tsx` (62) | Mutates `<meta>` OpenGraph/Twitter tags for `/ai-pulse`. |
| `ai-pulse/ShareCard.tsx` (132) | Generates copyable link & X/LinkedIn social share buttons. |
| `ai-pulse/Timeline.tsx` (83) | Chronological article feed timeline for AI Pulse news. |
| `goals/AssigneePicker.tsx` (95) | Adds/removes org members assigned to a goal. |
| `goals/GoalCard.tsx` (47) | Summary tile showing goal title, period, date range, `RoleBadge`, `GoalProgressBar`. |
| `goals/GoalForm.tsx` (241) | Create/edit form for individual/team/org goals (note: `departmentId` hardcoded `null` at `:79`). |
| `goals/GoalProgressBar.tsx` (36) | Progress bar color-coded by `manual` / `key_results` / `links` or child rollups. |
| `goals/KeyResultEditor.tsx` (132) | Adds KRs and inline-edits current numeric values on blur. |
| `goals/LinkEditor.tsx` (199) | Links/unlinks Jira tickets or GitHub PRs/issues by URL or ticket key (`PROJ-123`). |
| `goals/RoleBadge.tsx` (40) | Compact badge displaying goal scope and status pills. |
| `integrations/ConnectionCard.tsx` (89) | Shared UI card showing Connected/Not Connected badge and Connect/Disconnect CTA. |
| `integrations/OAuthButton.tsx` (43) | Unused/generic popup OAuth trigger (`Integrations.tsx` redirects `window.location.href` directly instead). |
| `landing/FaqAccordion.tsx` (103) | Interactive FAQ accordion with `FAQPage` JSON-LD script. |
| `landing/PainGrid.tsx` (125) | Side-by-side comparison ("December Appraisal Panic" vs Impactly AI). |
| `landing/PlaygroundWidget.tsx` (417) | Live public STAR generator widget hitting `/api/appraisal/playground-generate` with static fallback. |
| `landing/PricingSection.tsx` (148) | Individual Free + Corporate Teams waitlist section (`POST /api/waitlist`). |
| `premium/PremiumGate.tsx` (42) | Wraps children in tier check from `SubscriptionContext`, linking fallback to `/billing`. |
| `teams/MemberList.tsx` (79) | Displays team members with role selector and delete button. |
| `teams/TeamTree.tsx` (114) | Recursive collapsible hierarchy rendered from `parent_team_id`. |

---

## 5. Pages & Tests (`client/src/pages/`, `client/test/`)

| File (LOC) | Route | Summary |
|---|---|---|
| `Login.tsx` (259) | `/login` | Email/password login + signup toggle + unverified-email resend cooldown UI. |
| `ForgotPassword.tsx` (129) | `/forgot-password` | Sends `POST /api/auth/forgot-password` request. |
| `ResetPassword.tsx` (205) | `/reset-password` | Validates `?token` & `?userId` params; posts new password to `/api/auth/reset-password`. |
| `VerifyEmail.tsx` (111) | `/verify-email` | Auto-submits `?token` & `?userId` on mount to `/api/auth/verify-email`. |
| `Onboarding.tsx` (303) | `/onboarding` | 2-step personalization wizard (first name, industry, function, years, company size, review cadence, org goals toggle, skippable). |
| `Dashboard.tsx` (424) | `/dashboard` | Shows week logging status, 4 stat cards (total weeks, current/longest streak, total/avg hours), recent 5 entries, missing weeks, profile completion nudge. |
| `LogEntry.tsx` (351) | `/log` | Creates, edits (`?edit=<id>`), or deletes weekly work logs (`week_start_date`, `accomplishments`, optional challenges/learnings/goals/hours). |
| `Appraisal.tsx` (309) | `/appraisals` | Generates Mistral AI self-appraisals for a date window + custom criteria/goals/values, copies text, browses history. |
| `Chat.tsx` (82) | `/chat` | Split pane hosting `SessionList` and streaming `ChatWindow`. |
| `Settings.tsx` (757) | `/settings` | Language switcher (instant API save), profile/personalization form, change password form, UTC-converted reminder day/hour, Web Push toggle. |
| `Feedback.tsx` (446) | `/feedback` | Category card picker, 1–5 star rating, validated message box, personal feedback history accordion. |
| `Goals.tsx` (278) | `/goals` | Org switcher, create-first-org inline card, individual + org-visible goals grid, modal detail editor (`KeyResultEditor`, `AssigneePicker`, `LinkEditor`). |
| `TeamGoals.tsx` (277) | `/team-goals` | Team tree sidebar (`TeamTree` derived currently from goal `team_id` values), role-gated `+ New` goal creation (`useTeamRole`), rollup percentage header. |
| `OrgSettings.tsx` (417) | `/org-settings` | Admin tabs (`teams`, `departments`, `members`), closure rebuild action; team list & member list currently stubbed/derived from goals until list endpoints exist (`:79-120`). |
| `Integrations.tsx` (396) | `/integrations` | Personal (Jira, GitHub) and org-wide (Jira, Slack, GitHub App) OAuth cards, Jira multi-site picker modal, Slack 6-digit PIN confirmer. |
| `LinkGithub.tsx` (136) | `/integrations/link-github` | Finalizes GitHub App `installation_id` attachment to one of user's orgs. |
| `Billing.tsx` (116) | `/billing` | Wraps `BillingInner` in `SubscriptionProvider`; displays plan tiers & usage limits ("Upgrade options coming soon"). |
| `ai-pulse/Hub.tsx` (337) | `/ai-pulse` | Public AI news timeline + category filter pills + industry impact cards + bookmarks + share card. |
| `Privacy.tsx` (68) & `Terms.tsx` (68) | `/privacy`, `/terms` | Localized legal pages rendered via `i18next` keys. |
| `NotFound.tsx` (29) | `*` | 404 fallback page with home link. |
| `test/authStorage.test.ts` (69) | — | Node `assert` test verifying token storage isolation (cannot run cleanly without TS loader/Vitest). |
| `test/useHasOrg.test.js` (44) | — | Imports `vitest` and extensionless `../src/hooks/useHasOrg` (fails under Node ESM & no client test runner installed). |

---

## Related Documents

- [Frontend Architecture](../02-architecture/frontend-architecture.md)
- [Module Dependencies](./module-dependencies.md)
- [Function Index](../04-function-documentation/function-index.md)

## Verification Notes

- Verified every file path, LOC count, and export against the client file tree (`client/`) and TypeScript AST output.