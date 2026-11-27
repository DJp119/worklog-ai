# Testing Guide

> **Status:** Partially verified (config inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Test inventory

| Area | Framework | Files | Status |
|---|---|---|---|
| Server unit/integration | Vitest 4 | 6 files in `server/src/__tests__/` | Configured |
| Client unit | None configured | 2 files in `client/test/` | **Not runnable** |
| E2E | None | — | Missing |
| API contract | None | — | Missing |
| Load/performance | None | — | Missing |

---

## 2. Server tests (Vitest)

### 2.1 Configuration (`server/vitest.config.ts`)

```ts
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['dist/**', 'dist-stale/**', 'node_modules/**'],
  },
})
```

### 2.2 Test files

| File | Coverage | Lines |
|---|---|---|
| `audit-fixes.test.ts` | Security audit fixes | 32k |
| `authz.test.ts` | `authz.ts` rank logic, team closure | 25k |
| `channelPreferences.test.ts` | Channel preference CRUD | 2.5k |
| `goalService.test.ts` | Goal rollup, edit checks | 4k |
| `slackOAuth.test.ts` | Slack OAuth state handling | 0.7k |
| `webhookSecurity.test.ts` | Signature verification | 5.7k |

### 2.3 Running tests

```bash
# From repo root
npm test --workspace=server

# Or from server/
cd server && npm test
```

### 2.4 Test patterns observed

- **No database** — tests mock `SupabaseClient` or use in-memory fixtures
- **Authz tests** — exhaustive rank map and closure table scenarios
- **Webhook tests** — HMAC verification with valid/invalid signatures
- **Goal service** — rollup calculations, permission checks
- **No integration tests** against live Supabase

---

## 3. Client tests (not runnable)

### 3.1 Files

| File | Purpose |
|---|---|
| `client/test/authStorage.test.ts` | `authStorage.ts` token storage logic |
| `client/test/useHasOrg.test.js` | `useHasOrg` hook |

### 3.2 Issues

| Issue | Evidence |
|---|---|
| No test script in `client/package.json` | `"scripts": { "dev", "build", "lint", "preview", "typecheck" }` |
| No Vitest/Jest dependency | `devDependencies` lacks test runner |
| Test files use Jest-style `test()` but no runner | `authStorage.test.ts` uses `describe`, `test`, `expect` |

### 3.3 Fix to enable

```json
// client/package.json
{
  "devDependencies": {
    "vitest": "^4.1.9",
    "@vitest/coverage-v8": "^4.1.9",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^24.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**`client/vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
  },
})
```

---

## 4. Manual testing checklist

From `TESTING_CHECKLIST.md` (abridged):

### 4.1 Auth
- [ ] Signup → verification email → verify → login
- [ ] Login with rememberMe → tokens in localStorage
- [ ] Login without rememberMe → tokens in sessionStorage
- [ ] Token refresh at 14 min
- [ ] 401 → refresh → retry
- [ ] Forgot password → reset → all refresh tokens revoked
- [ ] Change password → all refresh tokens revoked
- [ ] Logout → tokens cleared

### 4.2 Work logs
- [ ] Create entry (all fields)
- [ ] Edit entry
- [ ] Delete entry
- [ ] Duplicate week blocked
- [ ] Dashboard shows entries

### 4.3 Appraisals
- [ ] Generate appraisal (with entries)
- [ ] Playground (no auth)
- [ ] History list
- [ ] View single appraisal

### 4.4 Chat
- [ ] Create session
- [ ] Send message → SSE stream
- [ ] Multiple messages
- [ ] Delete session

### 4.5 Teams/Goals
- [ ] Create org → owner
- [ ] Create department
- [ ] Create team → add members
- [ ] Create goal (all scopes)
- [ ] Add KRs, links, assignees, check-ins
- [ ] Rollup progress

### 4.6 Integrations
- [ ] Jira OAuth (user + org)
- [ ] GitHub OAuth (user)
- [ ] GitHub App install
- [ ] Slack org install
- [ ] Slack user link
- [ ] Webhook signature verification

### 4.7 AI Pulse
- [ ] Articles list
- [ ] Impact cards
- [ ] Bookmarks
- [ ] OG image generation

### 4.8 Billing/Reports
- [ ] Subscription tier display
- [ ] Enterprise report generation

### 4.9 Notifications
- [ ] Push subscription
- [ ] Weekly reminder (job)
- [ ] Weekly digest (job)

---

## 5. Automated quality gates (current)

| Gate | Command | Runs in CI |
|---|---|---|
| TypeScript | `npm run typecheck` | ❌ (no CI) |
| ESLint | `npm run lint` | ❌ |
| Server tests | `npm test --workspace=server` | ❌ |
| Client tests | N/A | ❌ |
| Build | `npm run build` | ❌ |

---

## 6. Recommended CI pipeline

```yaml
# .github/workflows/ci.yml (proposed)
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
  test-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test --workspace=server
  build:
    needs: [typecheck, lint, test-server]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
```

---

## 7. Coverage goals

| Metric | Target | Current |
|---|---|---|
| Server line coverage | >80% | Unknown (no coverage config) |
| Server branch coverage | >70% | Unknown |
| Authz coverage | 100% (critical) | High (dedicated test file) |
| Webhook security | 100% | High (dedicated test file) |
| Client coverage | >60% | 0% (not runnable) |

---

## 8. Test data management

| Approach | Used |
|---|---|
| Fixtures | `server/src/__tests__/fixtures/` (not found) |
| Factories | Inline in test files |
| Database | None (mocks only) |
| Snapshots | Not used |

---

## Related documents

- [Server test files](../03-codebase-structure/file-by-file-server.md#7-tests-6-files)
- [Server authz functions](../04-function-documentation/backend-teams-goals.md)
- [Webhook security](../08-security/security-architecture.md#5-webhook-security)
- [CI/CD proposal](../10-environment-and-deployment/deployment-guide.md#6-cicd-not-present-in-repo)

## Verification notes

Test files read from `server/src/__tests__/` and `client/test/` at commit `7567207`.
Vitest config read from `server/vitest.config.ts`. Client test runnability
assessed from `client/package.json` and test file syntax.