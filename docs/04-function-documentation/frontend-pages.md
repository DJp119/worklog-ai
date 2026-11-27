# Frontend Functions: Pages

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Page inventory

| Page component | File | Route | Auth | Tier | Purpose |
|---|---|---|---|---|---|
| `LandingPage` | `components/LandingPage.tsx` | `/` | Public | A | Hero, features, testimonials, CTA |
| `Login` | `pages/Login.tsx` | `/login` | Public | A | Email/password, remember me, forgot link |
| `ForgotPassword` | `pages/ForgotPassword.tsx` | `/forgot-password` | Public | A | Request password reset email |
| `ResetPassword` | `pages/ResetPassword.tsx` | `/reset-password` | Public | A | Reset with token from email |
| `VerifyEmail` | `pages/VerifyEmail.tsx` | `/verify-email` | Public | A | Verify email with token |
| `Onboarding` | `pages/Onboarding.tsx` | `/onboarding` | Auth, no Layout | A | Multi-step profile capture |
| `Dashboard` | `pages/Dashboard.tsx` | `/dashboard` | Protected | A | Stats, entries, summaries, quick actions |
| `LogEntry` | `pages/LogEntry.tsx` | `/log` | Protected | A | Weekly entry form (create/edit) |
| `Appraisal` | `pages/Appraisal.tsx` | `/appraisals` | Protected | A | Criteria input, AI generation, history |
| `Chat` | `pages/Chat.tsx` | `/chat` | Protected | A | Session list, new session, window |
| `Settings` | `pages/Settings.tsx` | `/settings` | Protected | A | Profile, password, push, delete account |
| `Feedback` | `pages/Feedback.tsx` | `/feedback` | Protected | A | Feedback form |
| `Goals` | `pages/Goals.tsx` | `/goals` | Protected | A | Personal goals list |
| `TeamGoals` | `pages/TeamGoals.tsx` | `/team-goals` | Protected | A | Team/org goals tree |
| `OrgSettings` | `pages/OrgSettings.tsx` | `/org-settings` | Protected | A | Org details, depts, teams, members |
| `Integrations` | `pages/Integrations.tsx` | `/integrations` | Protected | A | User/org integrations |
| `LinkGithub` | `pages/LinkGithub.tsx` | `/integrations/link-github` | Protected | A | GitHub OAuth flow |
| `Billing` | `pages/Billing.tsx` | `/billing` | Protected | A | Subscription tier display |
| `Terms` | `pages/Terms.tsx` | `/terms` | Public (Layout) | B | Terms of service |
| `Privacy` | `pages/Privacy.tsx` | `/privacy` | Public (Layout) | B | Privacy policy |
| `NotFound` | `pages/NotFound.tsx` | `*` | Public (Layout) | B | 404 page |
| `AIPulseHub` | `pages/ai-pulse/Hub.tsx` | `/ai-pulse` | Public (Layout) | A | AI news hub, articles, cards, bookmarks |

---

## 2. Tier A pages (detailed)

### `LandingPage` — `client/src/components/LandingPage.tsx`

**Identity:** `LandingPage` / `components/LandingPage.tsx` / Component / Not exported (default) / A

**Purpose:** Public landing page with hero, features, testimonials, pricing, FAQ.

**Technical:**
- Eager loaded (not lazy) in `App.tsx:92`
- Composes: `PainGrid`, `PlaygroundWidget`, `PricingSection`, `FaqAccordion`, `ShareCard`
- Uses `useTranslation` for i18n
- No auth required

**Props:** None

**State:** None (static content)

**Child components:** `PainGrid`, `PlaygroundWidget`, `PricingSection`, `FaqAccordion`, `ShareCard`, `SEOHead`

---

### `Login` — `client/src/pages/Login.tsx`

**Identity:** `Login` / `pages/Login.tsx` / Component / Lazy loaded / A

**Purpose:** Email/password login with remember me, signup link, forgot password link.

**Technical:**
- Form state: `email`, `password`, `rememberMe`, `isLoading`, `error`
- On submit: `useAuth().login(email, password, rememberMe)`
- On success: `AuthContext` stores tokens → redirects to `/dashboard`
- On error: Shows `error` from API (includes `EMAIL_NOT_VERIFIED` code)

**Props:** None

**State:** `email`, `password`, `rememberMe`, `isLoading`, `error`

**Calls:** `useAuth().login`, `useAuth().signup` (link), `useTranslation`

---

### `Dashboard` — `client/src/pages/Dashboard.tsx`

**Identity:** `Dashboard` / `pages/Dashboard.tsx` / Component / Lazy loaded / A

**Purpose:** Main authenticated dashboard: stats, recent entries, summaries, quick actions.

**Technical:**
- Mount: `useEffect` → `getEntries()` + `getSummaries()` → `lib/api.ts`
- Computes: `totalLogs = entries.length`, `currentStreak` (consecutive weeks)
- Renders: Stats cards, recent entries list (5), monthly summaries list, quick action buttons
- Quick actions: "Log Week" → `/log`, "Generate Appraisal" → `/appraisals`, "View Summaries" → scroll

**State:** `entries`, `summaries`, `loading`, `error`

**Calls:** `api.getEntries()`, `api.getSummaries()`, `formatRelativeTime`, `formatWeekRange`

---

### `LogEntry` — `client/src/pages/LogEntry.tsx`

**Identity:** `LogEntry` / `pages/LogEntry.tsx` / Component / Lazy loaded / A

**Purpose:** Weekly entry form (create/edit) with validation, preview, save.

**Technical:**
- URL: `/log` (create) or `/log/:id` (edit) — uses `useParams`
- Form state: all 4 fields + `hours_logged`
- Validation: all text fields required, `hours_logged` optional number
- On submit: `createEntry()` or `updateEntry(id, body)` → `lib/api.ts`
- On success: redirect to `/dashboard`
- Preview mode: shows formatted entry before save

**State:** `formData`, `isEditing`, `entryId`, `loading`, `error`, `preview`

**Calls:** `api.getEntry()`, `api.createEntry()`, `api.updateEntry()`, `formatWeekRange`

---

### `Appraisal` — `client/src/pages/Appraisal.tsx`

**Identity:** `Appraisal` / `pages/Appraisal.tsx` / Component / Lazy loaded / A

**Purpose:** Criteria input, AI generation, history view.

**Technical:**
- Tabs: "Generate" / "History"
- Generate: period picker + criteria textarea + company goals + values → `generateAppraisal()`
- History: `getAppraisalHistory()` → list with period, word count, date
- Click history item → `getAppraisal(id)` → modal with full text + copy button

**State:** `activeTab`, `periodStart`, `periodEnd`, `criteria`, `companyGoals`, `values`, `generating`, `history`, `selectedAppraisal`

**Calls:** `api.generateAppraisal()`, `api.getAppraisalHistory()`, `api.getAppraisal()`

---

### `Chat` — `client/src/pages/Chat.tsx`

**Identity:** `Chat` / `pages/Chat.tsx` / Component / Lazy loaded / A

**Purpose:** Chat session list + chat window.

**Technical:**
- Mount: `getChatSessions()` → `chatApi.ts`
- State: `sessions`, `activeSessionId`
- New session: `createChatSession({ period_start, period_end })` → adds to list, sets active
- Renders `SessionList` (sidebar) + `ChatWindow` (main)
- Delete session: `deleteChatSession(id)`

**State:** `sessions`, `activeSessionId`, `loading`

**Calls:** `chatApi.getChatSessions()`, `chatApi.createChatSession()`, `chatApi.deleteChatSession()`

---

### `Onboarding` — `client/src/pages/Onboarding.tsx`

**Identity:** `Onboarding` / `pages/Onboarding.tsx` / Component / Lazy loaded / A

**Purpose:** Multi-step profile capture (name, company, role, industry, function, experience, company size, review frequency, org goals alignment).

**Technical:**
- Steps: 1) Basics, 2) Role, 3) Industry, 4) Experience, 5) Goals alignment
- Form state per step + combined
- On complete: `api.updateProfile({ onboardingCompleted: true, ... })` → `api.ts`
- On success: `AuthContext.refreshProfile()` → redirect to `/dashboard`
- Uses `onboardingOptions.ts` for select options

**State:** `step`, `formData`, `loading`, `error`

**Calls:** `api.updateProfile()`, `onboardingOptions.ts`

---

### `AIPulseHub` — `client/src/pages/ai-pulse/Hub.tsx`

**Identity:** `AIPulseHub` / `pages/ai-pulse/Hub.tsx` / Component / Lazy loaded / A

**Purpose:** AI news hub: articles, impact cards, bookmarks, personalized feed.

**Technical:**
- Tabs: "Articles", "Impact Cards", "For You", "Bookmarks"
- Mount: `getArticles()`, `getImpactCards()` → `api.ts`
- "For You" tab: `getForYou()` → personalized
- Bookmarks: `getBookmarks()`, `createBookmark()`, `deleteBookmark()`
- Renders: `Timeline` (articles), `ImpactCard` grid, `BookmarkBtn`, `ShareCard`, `SEOHead`

**State:** `activeTab`, `articles`, `impactCards`, `bookmarks`, `loading`, `page`, `hasMore`

**Calls:** `api.getArticles()`, `api.getImpactCards()`, `api.getBookmarks()`, `api.createBookmark()`, `api.deleteBookmark()`, `api.getForYou()`

---

## 3. Tier B pages (compact)

| Page | File | Route | Auth | Purpose |
|---|---|---|---|---|
| `ForgotPassword` | `pages/ForgotPassword.tsx` | `/forgot-password` | Public | Request reset email |
| `ResetPassword` | `pages/ResetPassword.tsx` | `/reset-password` | Public | Reset with token |
| `VerifyEmail` | `pages/VerifyEmail.tsx` | `/verify-email` | Public | Verify email token |
| `Settings` | `pages/Settings.tsx` | `/settings` | Protected | Profile, password, push, delete |
| `Feedback` | `pages/Feedback.tsx` | `/feedback` | Protected | Feedback form |
| `Goals` | `pages/Goals.tsx` | `/goals` | Protected | Personal goals list |
| `TeamGoals` | `pages/TeamGoals.tsx` | `/team-goals` | Protected | Team/org goals tree |
| `OrgSettings` | `pages/OrgSettings.tsx` | `/org-settings` | Protected | Org, depts, teams, members |
| `Integrations` | `pages/Integrations.tsx` | `/integrations` | Protected | User/org integrations |
| `LinkGithub` | `pages/LinkGithub.tsx` | `/integrations/link-github` | Protected | GitHub OAuth |
| `Billing` | `pages/Billing.tsx` | `/billing` | Protected | Subscription tier display |
| `Terms` | `pages/Terms.tsx` | `/terms` | Public (Layout) | Terms of service |
| `Privacy` | `pages/Privacy.tsx` | `/privacy` | Public (Layout) | Privacy policy |
| `NotFound` | `pages/NotFound.tsx` | `*` | Public (Layout) | 404 page |

---

## 4. Routing & Guards (from `App.tsx`)

### Route table

| Route | Component | Auth | Layout | Lazy |
|---|---|---|---|---|
| `/` | `LandingPage` | Public | Layout | No |
| `/login` | `Login` | Public | Layout | Yes |
| `/forgot-password` | `ForgotPassword` | Public | Layout | Yes |
| `/reset-password` | `ResetPassword` | Public | Layout | Yes |
| `/verify-email` | `VerifyEmail` | Public | Layout | Yes |
| `/dashboard` | `Dashboard` | Protected | Layout | Yes |
| `/log` | `LogEntry` | Protected | Layout | Yes |
| `/appraisals` | `Appraisal` | Protected | Layout | Yes |
| `/chat` | `Chat` | Protected | Layout | Yes |
| `/settings` | `Settings` | Protected | Layout | Yes |
| `/feedback` | `Feedback` | Protected | Layout | Yes |
| `/goals` | `Goals` | Protected | Layout | Yes |
| `/team-goals` | `TeamGoals` | Protected | Layout | Yes |
| `/org-settings` | `OrgSettings` | Protected | Layout | Yes |
| `/integrations` | `Integrations` | Protected | Layout | Yes |
| `/integrations/link-github` | `LinkGithub` | Protected | Layout | Yes |
| `/onboarding` | `Onboarding` | Auth | None | Yes |
| `/verify-email` | `VerifyEmail` | Public | Layout | Yes |
| `/terms` | `Terms` | Public | Layout | Yes |
| `/privacy` | `Privacy` | Public | Layout | Yes |
| `/ai-pulse` | `AIPulseHub` | Public | Layout | Yes |
| `/billing` | `Billing` | Protected | Layout | Yes |
| `*` | `NotFound` | Public | Layout | Yes |

### Guards

| Guard | File | Behavior |
|---|---|---|
| `ProtectedRoute` | `App.tsx:31` | Redirects to `/login` if no user; to `/onboarding` if `onboardingCompleted === false` |
| `OnboardingRoute` | `App.tsx:67` | Requires auth, no Layout |

---

## Related documents

- [Frontend architecture](../02-architecture/frontend-architecture.md)
- [Frontend components](../04-function-documentation/frontend-components.md)
- [Frontend hooks/context/lib](../04-function-documentation/frontend-hooks-context-lib.md)
- [Client file map](../03-codebase-structure/file-by-file-client.md)

## Verification notes

All pages traced from `client/src/pages/`, `client/src/components/LandingPage.tsx`, `client/src/App.tsx` at commit `7567207`. Lazy loading and guard behavior verified in code.