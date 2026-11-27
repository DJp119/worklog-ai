# Frontend Functions: Hooks, Context & Lib

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `AuthProvider` | `context/AuthContext.tsx:43` | React component | Yes | A | Global auth state, login/logout/refresh |
| `useAuth` | `context/AuthContext.tsx:283` | Hook | Yes | A | Access auth context |
| `SubscriptionProvider` | `context/SubscriptionContext.tsx:15` | React component | Yes | A | Org subscription tier state |
| `useSubscription` | `context/SubscriptionContext.tsx:55` | Hook | Yes | B | Access subscription context |
| `useHasOrg` | `hooks/useHasOrg.ts` | Hook | Yes | A | Check if user has any org |
| `useIsLoggedIn` | `hooks/useIsLoggedIn.ts` | Hook | Yes | B | Simple auth check |
| `usePageMeta` | `hooks/usePageMeta.ts` | Hook | Yes | B | Per-page SEO meta |
| `useTeamRole` | `hooks/useTeamRole.ts` | Hook | Yes | A | User's role in a team |
| `apiRequest` | `lib/api.ts:38` | Function | Yes | A | Generic API transport + 401 refresh |
| `refreshAccessToken` | `lib/api.ts:5` | Function | Yes | A | Refresh token rotation |
| `getEntries` | `lib/api.ts:114` | Function | Yes | B | GET /api/entries |
| `createEntry` | `lib/api.ts:122` | Function | Yes | B | POST /api/entries |
| `updateEntry` | `lib/api.ts:129` | Function | Yes | B | PUT /api/entries/:id |
| `deleteEntry` | `lib/api.ts:139` | Function | Yes | B | DELETE /api/entries/:id |
| `generateAppraisal` | `lib/api.ts:168` | Function | Yes | B | POST /api/appraisal/generate |
| `getAppraisalHistory` | `lib/api.ts:177` | Function | Yes | B | GET /api/appraisal/history |
| `getAppraisal` | `lib/api.ts:182` | Function | Yes | B | GET /api/appraisal/:id |
| `getProfile` | `lib/api.ts:215` | Function | Yes | B | GET /api/users/profile |
| `updateProfile` | `lib/api.ts:219` | Function | Yes | B | PUT /api/users/profile |
| `updatePassword` | `lib/api.ts:235` | Function | Yes | B | PUT /api/users/password |
| `deleteAccount` | `lib/api.ts:250` | Function | Yes | B | DELETE /api/users/account |
| `getPreferences` | `lib/api.ts:260` | Function | Yes | B | GET /api/users/preferences |
| `updatePreferences` | `lib/api.ts:267` | Function | Yes | B | PUT /api/users/preferences |
| `createChatSession` | `lib/chatApi.ts` | Function | Yes | B | POST /api/chat/sessions |
| `getChatSessions` | `lib/chatApi.ts` | Function | Yes | B | GET /api/chat/sessions |
| `deleteChatSession` | `lib/chatApi.ts` | Function | Yes | B | DELETE /api/chat/sessions/:id |
| `getChatMessages` | `lib/chatApi.ts` | Function | Yes | B | GET /api/chat/sessions/:id/messages |
| `sendChatMessage` | `lib/chatApi.ts` | Function | Yes | A | POST /api/chat/sessions/:id/messages (SSE) |
| `getGoals` | `lib/goalsApi.ts` | Function | Yes | B | GET /api/goals |
| `createGoal` | `lib/goalsApi.ts` | Function | Yes | B | POST /api/goals |
| `updateGoal` | `lib/goalsApi.ts` | Function | Yes | B | PATCH /api/goals/:id |
| `deleteGoal` | `lib/goalsApi.ts` | Function | Yes | B | DELETE /api/goals/:id |
| `addKeyResult` | `lib/goalsApi.ts` | Function | Yes | B | POST /api/goals/:id/key-results |
| `updateKeyResult` | `lib/goalsApi.ts` | Function | Yes | B | PATCH /api/goals/:id/key-results/:krId |
| `deleteKeyResult` | `lib/goalsApi.ts` | Function | Yes | B | DELETE /api/goals/:id/key-results/:krId |
| `addAssignee` | `lib/goalsApi.ts` | Function | Yes | B | POST /api/goals/:id/assignees |
| `removeAssignee` | `lib/goalsApi.ts` | Function | Yes | B | DELETE /api/goals/:id/assignees/:userId |
| `addCheckIn` | `lib/goalsApi.ts` | Function | Yes | B | POST /api/goals/:id/checkins |
| `addLink` | `lib/goalsApi.ts` | Function | Yes | B | POST /api/goals/:id/links |
| `deleteLink` | `lib/goalsApi.ts` | Function | Yes | B | DELETE /api/goals/:id/links/:linkId |
| `setParentGoal` | `lib/goalsApi.ts` | Function | Yes | B | PUT /api/goals/:id/parent |
| `connectJira` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/jira/connect |
| `confirmJira` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/jira/confirm |
| `selectJiraSite` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/jira/select-site |
| `connectGitHub` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/github/connect |
| `confirmGitHub` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/github/confirm |
| `connectSlack` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/slack/connect |
| `confirmSlack` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/slack/confirm |
| `linkSlackStart` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/slack/link/start |
| `confirmSlackLink` | `lib/integrationsApi.ts` | Function | Yes | B | POST /api/integrations/slack/link/confirm |
| `getUserIntegrations` | `lib/integrationsApi.ts` | Function | Yes | B | GET /api/integrations/user |
| `deleteUserIntegration` | `lib/integrationsApi.ts` | Function | Yes | B | DELETE /api/integrations/user/:provider |
| `getOrgIntegrations` | `lib/integrationsApi.ts` | Function | Yes | B | GET /api/integrations/org/:orgId |
| `deleteOrgIntegration` | `lib/integrationsApi.ts` | Function | Yes | B | DELETE /api/integrations/org/:orgId/:provider |
| `getUserOrgs` | `lib/teamsApi.ts` | Function | Yes | B | GET /api/orgs |
| `createOrg` | `lib/teamsApi.ts` | Function | Yes | B | POST /api/orgs |
| `getOrgMembers` | `lib/teamsApi.ts` | Function | Yes | B | GET /api/orgs/:orgId/members |
| `createDepartment` | `lib/teamsApi.ts` | Function | Yes | B | POST /api/orgs/:orgId/departments |
| `createTeam` | `lib/teamsApi.ts` | Function | Yes | B | POST /api/orgs/:orgId/teams |
| `rebuildClosure` | `lib/teamsApi.ts` | Function | Yes | B | POST /api/orgs/:orgId/rebuild-closure |
| `getTeam` | `lib/teamsApi.ts` | Function | Yes | B | GET /api/teams/:teamId |
| `getTeamMembers` | `lib/teamsApi.ts` | Function | Yes | B | GET /api/teams/:teamId/members |
| `addTeamMember` | `lib/teamsApi.ts` | Function | Yes | B | POST /api/teams/:teamId/members |
| `updateTeamMember` | `lib/teamsApi.ts` | Function | Yes | B | PUT /api/teams/:teamId/members/:userId |
| `removeTeamMember` | `lib/teamsApi.ts` | Function | Yes | B | DELETE /api/teams/:teamId/members/:userId |
| `reparentTeam` | `lib/teamsApi.ts` | Function | Yes | B | PUT /api/teams/:teamId/reparent |
| `deleteTeam` | `lib/teamsApi.ts` | Function | Yes | B | DELETE /api/teams/:teamId |
| `getMyRole` | `lib/teamsApi.ts` | Function | Yes | B | GET /api/teams/:teamId/my-role |
| `getStoredTokens` | `lib/authStorage.ts:14` | Function | Yes | B | Read tokens from localStorage/sessionStorage |
| `storeStoredTokens` | `lib/authStorage.ts:24` | Function | Yes | B | Write tokens to correct storage |
| `clearStoredTokens` | `lib/authStorage.ts:34` | Function | Yes | B | Clear tokens from both storages |
| `useEventSource` | `lib/useSSE.ts` | Hook | Yes | A | SSE wrapper with reconnect |
| `getVapidPublicKey` | `lib/push.ts` | Function | Yes | B | GET /api/push/vapid-public-key |
| `subscribe` | `lib/push.ts` | Function | Yes | B | POST /api/push/subscribe |
| `unsubscribe` | `lib/push.ts` | Function | Yes | B | POST /api/push/unsubscribe |
| `formatDate` | `lib/formatters.ts` | Function | Yes | B | Date formatting |
| `formatRelativeTime` | `lib/formatters.ts` | Function | Yes | B | Relative time (e.g., "2 days ago") |
| `formatWeekRange` | `lib/formatters.ts` | Function | Yes | B | "Week of Jan 15" |
| `initAnalytics` | `lib/analytics.ts` | Function | Yes | B | PostHog init |
| `posthog` | `lib/analytics.ts` | Instance | Yes | B | PostHog client |
| `supabase` | `lib/supabase.ts:10` | Instance | Yes | B | Optional direct Supabase client |
| `detectInitialLanguage` | `i18n/index.ts:55` | Function | Yes | B | localStorage → navigator → 'en' |
| `useAutoLocale` | `i18n/useAutoLocale.ts` | Hook | Yes | B | Applies detected locale on mount |

---

## 2. Tier A functions (detailed)

### `AuthProvider` — `client/src/context/AuthContext.tsx:43`

**Identity:** `AuthProvider` / `context/AuthContext.tsx:43` / React component / exported / A

**Purpose:** Global authentication state machine: token storage, hydration, login/logout, refresh loop, profile refresh.

**ELI5:** The central ID card office. It holds your badges (tokens), checks them at the door (hydration), renews them before they expire (14-min loop), and tells the rest of the app who you are.

**Technical walkthrough:**
1. State: `user`, `accessToken`, `refreshToken`, `loading`
2. `useEffect` mount → `loadAuthState()` (line 50-105)
   - Reads tokens from `localStorage` → `sessionStorage`
   - If both exist: set tokens, call `GET /api/users/profile` to verify
   - On success: set user, PostHog `identify`, persist language
   - On failure: `clearAuth()`
   - Always: `setLoading(false)`
3. `useEffect` token refresh loop (line 54-59)
   - Every 14 min: `handleRefreshToken()`
4. `login(email, password, rememberMe)` (line 107-141)
   - `POST /api/auth/login` → stores tokens in `localStorage` (rememberMe) or `sessionStorage`
   - PostHog `identify`
5. `signup(...)` (line 143-156) → `POST /api/auth/signup`
6. `logout()` (line 158-172) → `POST /api/auth/logout` → `clearAuth()` → `posthog.reset()`
7. `verifyEmail`, `resendVerificationEmail` → `POST /api/auth/verify-email`, `/resend-verification`
8. `refreshProfile()` (line 200-217) → `GET /api/users/profile`
9. `handleRefreshToken()` (line 219-252) → `POST /api/auth/refresh` → rotates tokens
10. `clearAuth()` (line 254-262) → nulls state, removes from both storages

**Returns:** Context value `{ user, accessToken, loading, login, signup, logout, verifyEmail, resendVerificationEmail, refreshProfile }`

**Calls:** `api.ts` (`apiRequest` indirectly via fetch), `authStorage.ts`, `formatters.ts`, `posthog`

**Side effects:** localStorage/sessionStorage, PostHog, interval timer

---

### `useAuth` — `client/src/context/AuthContext.tsx:283`

**Identity:** `useAuth` / `context/AuthContext.tsx:283` / Hook / exported / A

**Purpose:** Access `AuthContext`; throws if used outside provider.

**Technical:** `const context = useContext(AuthContext); if (!context) throw ...; return context`

---

### `apiRequest` — `client/src/lib/api.ts:38`

**Identity:** `apiRequest` / `lib/api.ts:38` / Function / exported / A

**Purpose:** Generic authenticated fetch with automatic 401 refresh + retry.

**ELI5:** A smart courier that delivers your API requests, automatically renews your expired pass, and retries once if needed.

**Technical:**
1. `getStoredTokens()` → `accessToken`
2. Build headers: `Content-Type: application/json`, `Authorization: Bearer <token>`
3. `sendRequest()` → `fetch(`${API_URL}${endpoint}`, options)`
4. If 401: `refreshAccessToken()` → retry with new token
5. If second 401: `clearStoredTokens()` → `window.location.href = '/login'`
6. Parse JSON → return `data.data ?? data` (unwraps `{ success, data }`)

**Inputs:** `endpoint: string`, `options?: ApiRequestOptions` (extends `RequestInit`)

**Returns:** `Promise<T>` (unwrapped response data)

**Calls:** `getStoredTokens`, `refreshAccessToken`, `clearStoredTokens`

**Side effects:** On 401 retry: token rotation, storage update; on double 401: redirect

**Error handling:** Throws `Error(data.error || 'Request failed')` on non-2xx

---

### `refreshAccessToken` — `client/src/lib/api.ts:5`

**Identity:** `refreshAccessToken` / `lib/api.ts:5` / Function / exported / A

**Purpose:** Call `/api/auth/refresh` with stored refresh token; store new pair.

**Technical:**
1. `getStoredTokens()` → `refreshToken`
2. `POST /api/auth/refresh` with `refreshToken`
3. On success: `storeStoredTokens({ accessToken, refreshToken })`
4. Returns `true`/`false`

---

### `sendChatMessage` — `client/src/lib/chatApi.ts` (SSE)

**Identity:** `sendChatMessage` / `lib/chatApi.ts` / Function / exported / A

**Purpose:** Send message via SSE streaming using `useSSE` hook.

**Technical:**
1. Creates `EventSource` via `useEventSource` hook
2. `POST /api/chat/sessions/:id/messages` with `content`
3. Handles SSE events: `token` (append), `done` (complete), `error`
4. Returns async iterator or callback-based API

**Calls:** `useSSE` hook, `apiRequest` (for non-streaming fallback)

---

### `useEventSource` — `client/src/lib/useSSE.ts`

**Identity:** `useEventSource` / `lib/useSSE.ts` / Hook / exported / A

**Purpose:** React hook wrapping `EventSource` with cleanup, reconnect, parsing.

**Technical:**
- Manages `EventSource` lifecycle
- Parses SSE `data:` lines as JSON
- Handles `onmessage`, `onerror`
- Returns `{ events, error, close }`

---

### `useHasOrg` — `client/src/hooks/useHasOrg.ts`

**Identity:** `useHasOrg` / `hooks/useHasOrg.ts` / Hook / exported / A

**Purpose:** Checks if user belongs to any organization.

**Technical:**
1. `useAuth()` → `user`
2. `useEffect` → if user: `teamsApi.getUserOrgs()` → sets `hasOrg` state
3. Returns `{ hasOrg, loading }`

**Calls:** `teamsApi.getUserOrgs()` → `GET /api/orgs`

---

### `useTeamRole` — `client/src/hooks/useTeamRole.ts`

**Identity:** `useTeamRole` / `hooks/useTeamRole.ts` / Hook / exported / A

**Purpose:** Fetches user's effective role in a team.

**Technical:**
1. `useAuth()` → `user`
2. `useEffect` → if user & teamId: `teamsApi.getMyRole(teamId)` → sets `role` state
3. Returns `{ role, loading }`

**Calls:** `teamsApi.getMyRole()` → `GET /api/teams/:teamId/my-role`

---

### `useAutoLocale` — `client/src/i18n/useAutoLocale.ts`

**Identity:** `useAutoLocale` / `i18n/useAutoLocale.ts` / Hook / exported / B

**Purpose:** On mount, detects locale and calls `i18n.changeLanguage()`.

**Technical:** `useEffect` → `detectInitialLanguage()` → `i18n.changeLanguage(lang)`

---

## 3. Tier B functions (compact)

| Function | File:line | Purpose |
|---|---|---|
| `SubscriptionProvider` | `context/SubscriptionContext.tsx:15` | Org tier state; fetches `/api/subscriptions/:orgId` |
| `useSubscription` | `context/SubscriptionContext.tsx:55` | Access subscription context |
| `useIsLoggedIn` | `hooks/useIsLoggedIn.ts` | `!!useAuth().user` |
| `usePageMeta` | `hooks/usePageMeta.ts` | SEO meta from route + i18n |
| `getEntries` | `lib/api.ts:114` | `apiRequest('/api/entries')` |
| `createEntry` | `lib/api.ts:122` | `apiRequest('POST', '/api/entries', body)` |
| `updateEntry` | `lib/api.ts:129` | `apiRequest('PUT', '/api/entries/:id', body)` |
| `deleteEntry` | `lib/api.ts:139` | `apiRequest('DELETE', '/api/entries/:id')` |
| `generateAppraisal` | `lib/api.ts:168` | `apiRequest('POST', '/api/appraisal/generate', body)` |
| `getAppraisalHistory` | `lib/api.ts:177` | `apiRequest('/api/appraisal/history')` |
| `getAppraisal` | `lib/api.ts:182` | `apiRequest('/api/appraisal/:id')` |
| `getProfile` | `lib/api.ts:215` | `apiRequest('/api/users/profile')` |
| `updateProfile` | `lib/api.ts:219` | `apiRequest('PUT', '/api/users/profile', body)` |
| `updatePassword` | `lib/api.ts:235` | `apiRequest('PUT', '/api/users/password', body)` |
| `deleteAccount` | `lib/api.ts:250` | `apiRequest('DELETE', '/api/users/account')` |
| `getPreferences` | `lib/api.ts:260` | `apiRequest('/api/users/preferences')` |
| `updatePreferences` | `lib/api.ts:267` | `apiRequest('PUT', '/api/users/preferences', body)` |
| `createChatSession` | `lib/chatApi.ts` | `apiRequest('POST', '/api/chat/sessions', body)` |
| `getChatSessions` | `lib/chatApi.ts` | `apiRequest('/api/chat/sessions')` |
| `deleteChatSession` | `lib/chatApi.ts` | `apiRequest('DELETE', '/api/chat/sessions/:id')` |
| `getChatMessages` | `lib/chatApi.ts` | `apiRequest('/api/chat/sessions/:id/messages')` |
| `getGoals` | `lib/goalsApi.ts` | `apiRequest('/api/goals')` |
| `createGoal` | `lib/goalsApi.ts` | `apiRequest('POST', '/api/goals', body)` |
| `updateGoal` | `lib/goalsApi.ts` | `apiRequest('PATCH', '/api/goals/:id', body)` |
| `deleteGoal` | `lib/goalsApi.ts` | `apiRequest('DELETE', '/api/goals/:id')` |
| `addKeyResult` | `lib/goalsApi.ts` | `apiRequest('POST', '/api/goals/:id/key-results', body)` |
| `updateKeyResult` | `lib/goalsApi.ts` | `apiRequest('PATCH', '/api/goals/:id/key-results/:krId', body)` |
| `deleteKeyResult` | `lib/goalsApi.ts` | `apiRequest('DELETE', '/api/goals/:id/key-results/:krId')` |
| `addAssignee` | `lib/goalsApi.ts` | `apiRequest('POST', '/api/goals/:id/assignees', body)` |
| `removeAssignee` | `lib/goalsApi.ts` | `apiRequest('DELETE', '/api/goals/:id/assignees/:userId')` |
| `addCheckIn` | `lib/goalsApi.ts` | `apiRequest('POST', '/api/goals/:id/checkins', body)` |
| `addLink` | `lib/goalsApi.ts` | `apiRequest('POST', '/api/goals/:id/links', body)` |
| `deleteLink` | `lib/goalsApi.ts` | `apiRequest('DELETE', '/api/goals/:id/links/:linkId')` |
| `setParentGoal` | `lib/goalsApi.ts` | `apiRequest('PUT', '/api/goals/:id/parent', body)` |
| `connectJira` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/jira/connect', body)` |
| `confirmJira` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/jira/confirm', body)` |
| `selectJiraSite` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/jira/select-site', body)` |
| `connectGitHub` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/github/connect', body)` |
| `confirmGitHub` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/github/confirm', body)` |
| `connectSlack` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/slack/connect', body)` |
| `confirmSlack` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/slack/confirm', body)` |
| `linkSlackStart` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/slack/link/start', body)` |
| `confirmSlackLink` | `lib/integrationsApi.ts` | `apiRequest('POST', '/api/integrations/slack/link/confirm', body)` |
| `getUserIntegrations` | `lib/integrationsApi.ts` | `apiRequest('/api/integrations/user')` |
| `deleteUserIntegration` | `lib/integrationsApi.ts` | `apiRequest('DELETE', '/api/integrations/user/:provider')` |
| `getOrgIntegrations` | `lib/integrationsApi.ts` | `apiRequest('/api/integrations/org/:orgId')` |
| `deleteOrgIntegration` | `lib/integrationsApi.ts` | `apiRequest('DELETE', '/api/integrations/org/:orgId/:provider')` |
| `getUserOrgs` | `lib/teamsApi.ts` | `apiRequest('/api/orgs')` |
| `createOrg` | `lib/teamsApi.ts` | `apiRequest('POST', '/api/orgs', body)` |
| `getOrgMembers` | `lib/teamsApi.ts` | `apiRequest('/api/orgs/:orgId/members')` |
| `createDepartment` | `lib/teamsApi.ts` | `apiRequest('POST', '/api/orgs/:orgId/departments', body)` |
| `createTeam` | `lib/teamsApi.ts` | `apiRequest('POST', '/api/orgs/:orgId/teams', body)` |
| `rebuildClosure` | `lib/teamsApi.ts` | `apiRequest('POST', '/api/orgs/:orgId/rebuild-closure')` |
| `getTeam` | `lib/teamsApi.ts` | `apiRequest('/api/teams/:teamId')` |
| `getTeamMembers` | `lib/teamsApi.ts` | `apiRequest('/api/teams/:teamId/members')` |
| `addTeamMember` | `lib/teamsApi.ts` | `apiRequest('POST', '/api/teams/:teamId/members', body)` |
| `updateTeamMember` | `lib/teamsApi.ts` | `apiRequest('PUT', '/api/teams/:teamId/members/:userId', body)` |
| `removeTeamMember` | `lib/teamsApi.ts` | `apiRequest('DELETE', '/api/teams/:teamId/members/:userId')` |
| `reparentTeam` | `lib/teamsApi.ts` | `apiRequest('PUT', '/api/teams/:teamId/reparent', body)` |
| `deleteTeam` | `lib/teamsApi.ts` | `apiRequest('DELETE', '/api/teams/:teamId')` |
| `getMyRole` | `lib/teamsApi.ts` | `apiRequest('/api/teams/:teamId/my-role')` |
| `getStoredTokens` | `lib/authStorage.ts:14` | Reads from localStorage → sessionStorage |
| `storeStoredTokens` | `lib/authStorage.ts:24` | Writes to storage that already has refresh token |
| `clearStoredTokens` | `lib/authStorage.ts:34` | Removes from both storages |
| `getVapidPublicKey` | `lib/push.ts` | `apiRequest('/api/push/vapid-public-key')` |
| `subscribe` | `lib/push.ts` | `apiRequest('POST', '/api/push/subscribe', body)` |
| `unsubscribe` | `lib/push.ts` | `apiRequest('POST', '/api/push/unsubscribe', body)` |
| `formatDate` | `lib/formatters.ts` | `new Date().toLocaleDateString()` |
| `formatRelativeTime` | `lib/formatters.ts` | `Intl.RelativeTimeFormat` |
| `formatWeekRange` | `lib/formatters.ts` | "Week of Jan 15" from Monday date |
| `initAnalytics` | `lib/analytics.ts` | `posthog.init(key, { api_host })` |
| `supabase` | `lib/supabase.ts:10` | `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` |
| `detectInitialLanguage` | `i18n/index.ts:55` | localStorage → navigator → 'en' |

---

## Related documents

- [Auth flow](../05-feature-flows/auth-and-onboarding.md)
- [Frontend architecture](../02-architecture/frontend-architecture.md)
- [Client API](../06-api-reference/endpoint-reference-core-ai.md)

## Verification notes

All functions traced from source at commit `7567207`. SSE reconnect behavior not verified at runtime.