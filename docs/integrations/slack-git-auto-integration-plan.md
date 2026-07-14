# Slack & Git Auto-Integration Plan

## Context

WorkLog AI currently requires users to manually type weekly logs (15-20 mins/week). This plan automates data collection from **Slack** (messages, mentions, thread participation) and **Git platforms** (GitHub/GitLab commits, PRs, reviews) so users only need to review and submit auto-generated drafts (~5 mins/week).

Based on existing `docs/enterprise-integration-plan.md` architecture, this implementation focuses specifically on Slack + Git integrations.

---

## Recommended Workflow Pattern: **Orchestrator**

**Why Orchestrator pattern?**
- **Multiple independent data sources** (Slack API, GitHub API, GitLab API) that can be fetched in parallel
- **Specialist agents** needed per integration (each has unique auth, rate limits, data formats)
- **Central coordinator** needed to normalize, deduplicate, and synthesize into weekly logs
- **Error isolation** - if Slack fails, Git still works; retry logic per-source
- **Background job orchestration** - daily/weekly sync jobs with timeout/budget controls

**Pattern Flow:**
```
[Coordinator Job] → [Parallel Fetch: Slack, GitHub, GitLab] → [Normalize & Dedupe] → [AI Synthesis] → [Draft Entry] → [User Review Gate]
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR JOB (weeklySyncJob.ts)               │
│  - Fires Monday 9AM UTC                                                     │
│  - Iterates users with active integrations                                  │
│  - Coordinates per-user: fetch → normalize → synthesize → draft             │
│  - Budget: 30s/user, Timeout: 5min/job                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
    ┌─────────────────────┐ ┌─────────────────┐ ┌──────────────────┐
    │ SlackAdapter        │ │ GitHubAdapter   │ │ GitLabAdapter    │
    │ ─────────────────   │ │ ─────────────── │ │ ──────────────── │
    │ - OAuth2 token mgmt │ │ - OAuth2 token  │ │ - OAuth2 token   │
    │ - channels filtering│ │ - repo filtering│ │ - project filtering│
    │ - conversations.api │ │ - search API    │ │ - merge requests │
    │ - mentions Threads  │ │ - PRs Commits   │ │ - push events    │
    │ Rate limit: 100/min │ │ Rate limit: 5000│ │ Rate limit: 2000 │
    └─────────────────────┘ └─────────────────┘ └──────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │ ActivityNormalizer                │
                    │ ─────────────────────             │
                    │ - Unified Activity interface      │
                    │ - Dedupe by source_url            │
                    │ - Group by week (Monday-Sunday)   │
                    │ - Taxonomy classify (code/chat)   │
                    └───────────────────────────────────┘
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │ AutoLogSynthesizer (Mistral AI)   │
                    │ ───────────────────────────       │
                    │ - Input: 50-200 normalized items  │
                    │ - Output: 200-400 word draft log  │
                    │ - Citations: source references    │
                    │ - Tone: professional, first-person│
                    └───────────────────────────────────┘
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │ DraftEntryCreator                 │
                    │ ───────────────────               │
                    │ - Creates work_log_entries        │
                    │ - status = 'auto-generated'       │
                    │ - Links log_source_references     │
                    │ - pending_review = true           │
                    └───────────────────────────────────┘
```

---

## Data Flow

### Step 1: OAuth Authentication (One-time per user)
```
User clicks "Connect Slack" / "Connect GitHub"
  → GET /api/integrations/{provider}/connect
  → Redirect to OAuth provider with scopes
  → Provider redirects back with code
  → POST /api/integrations/{provider}/callback
  → Exchange code for access_token + refresh_token
  → Store in `user_integrations` table
  → Trigger immediate initial sync
```

### Step 2: Weekly Data Fetch (Automated)
```
Cron: Monday 9AM UTC
For each user with active integrations:
  ├─ SlackAdapter.fetchWeekActivity(user, weekStart, weekEnd)
  │   - conversations.messages() for linked channels
  │   - searches for mentions (@user)
  │   - threads.replies() for thread participation
  │   - Filter: work-hours only (configurable)
  │
  ├─ GitHubAdapter.fetchWeekActivity(user, weekStart, weekEnd)
  │   - search/issues (PRs merged this week)
  │   - search/commits (pushed this week)
  │   - search/issues (reviewed this week)
  │   - Filter: user's repos + organization repos
  │
  └─ GitLabAdapter.fetchWeekActivity(user, weekStart, weekEnd)
      - merge_requests (merged)
      - commits (pushed)
      - events (reviewed)
```

### Step 3: Normalization & Deduplication
```typescript
interface NormalizedActivity {
  id: string              // SHA256(provider + source_id)
  provider: 'slack' | 'github' | 'gitlab'
  type: 'commit' | 'pr' | 'review' | 'message' | 'thread'
  title: string           // "Fixed auth bug" / "Reviewed #234"
  body?: string           // Full text (commit message, Slack message)
  url: string             // Direct link
  timestamp: Date
  metadata: {
    repo?: string
    channel?: string
    mentions?: string[]
    labels?: string[]
  }
}

// Dedupe strategy:
// - Exact URL match → skip
// - Same timestamp + title → fuzzy match, keep higher-fidelity source
```

### Step 4: AI Synthesis (Mistral)
```
Prompt template:
"Generate a weekly work log from this activity data.

RULES:
- Group into: Completed Work, In Progress, Blockers, Learnings
- For each item, cite source (#[PR number] or @channel link)
- If <5 activities, be detailed; if >20, summarize by theme
- 200-400 words, professional first-person tone
- Highlight impactful work first

ACTIVITY DATA (normalised, sorted by timestamp):
${JSON.stringify(formattedActivity, null, 2)}

Output format (markdown):
## Completed Work
- Item 1 [source link]
- Item 2 [source link]

## In Progress
- Item 3 [source link]

## Blockers
- Challenge description

## Learnings
- New skill/insight"
```

### Step 5: Draft Entry Creation
```sql
INSERT INTO work_log_entries (
  user_id, week_start_date, accomplishments, challenges,
  learnings, goals_next_week, status, auto_generated_at,
  pending_review
) VALUES (
  $1, $2, $3, $4, $5, $6, 'auto-generated', NOW(), true
);

-- Link source references
INSERT INTO log_source_references (
  work_log_entry_id, provider, source_type, source_id,
  source_url, source_data
) VALUES
  (last_insert_id(), 'github', 'pr', '234', 'https://...', {...}),
  (last_insert_id(), 'slack', 'message', 'msg123', 'https://...', {...});
```

### Step 6: User Review Gate
```
User logs in → Dashboard shows:
  "Ready for Review: Week of May 20-26"
  [View Draft] [Edit] [Submit] [Reject]

If user clicks [Edit]:
  → Opens LogEntry.tsx with pre-filled accomplishments/challenges/learnings
  → Highlights AI-generated content
  → On submit: status = 'auto-generated-edited'

If user clicks [Submit]:
  → status = 'auto-generated-verified'
  → pending_review = false
  → Send confirmation email

If user clicks [Reject]:
  → Delete draft entry
  → Log reason (optional)
  → Allow manual entry
```

---

## Failure Recovery Strategy

### Retry Policy (per adapter)
```typescript
const retryPolicy = {
  maxAttempts: 3,
  backoff: 'exponential',  // 1s → 2s → 4s
  onRetry: (error, attempt) => {
    if (error.rateLimit) {
      waitUntilReset(error.rateLimitReset)
    } else if (error.authExpired) {
      refreshAuthToken() // retry once after refresh
    }
  }
}
```

### Circuit Breaker (per user per provider)
```typescript
// Track consecutive failures
if (consecutiveFailures >= 5) {
  circuitBreaker.open(provider)
  notifyUser("Slack sync temporarily unavailable. Try reconnecting later.")
  // Close circuit after 24h or user re-auth
}
```

### Graceful Degradation
```
Scenario: GitHub API rate limit exhausted
  → Fetch what's possible (cached data)
  → Sync with Slack only
  → Log: "GitHub data incomplete due to rate limit"
  → Draft includes only Slack data
  → Display: "Some sources unavailable - [Retry Now]"
```

### Rollback Strategy
```sql
-- If AI draft is completely wrong, user can:
1. Reject (delete draft)
2. Manual entry (overwrites)
3. Partial edit (keep some AI content)

-- Audit trail preserved:
SELECT * FROM integration_sync_logs WHERE user_id = $1 AND week = $2
  → Shows what was fetched, what failed, what was generated
```

---

## Database Schema Extensions

```sql
-- 1. OAuth connections table (renamed from integrations for clarity)
CREATE TABLE user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('slack', 'github', 'gitlab')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    config JSONB,  -- Slack: {channels: []}, GitHub: {repos: []}
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- 2. Source references (proves data lineage)
CREATE TABLE log_source_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_log_entry_id UUID NOT NULL REFERENCES work_log_entries(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('commit', 'pr', 'review', 'message', 'thread')),
    source_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_data JSONB NOT NULL,  -- Full snapshot for audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, provider)  -- Prevent duplicate references
);

-- 3. Integration sync history
CREATE TABLE integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'partial', 'failed')),
    items_fetched INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    synthesize_duration_ms INTEGER
);

-- 4. Work log entry status extension
ALTER TABLE work_log_entries 
  ADD COLUMN status TEXT DEFAULT 'manual' 
  CHECK (status IN ('manual', 'auto-generated', 'auto-generated-verified', 'auto-generated-edited', 'auto-generated-rejected'));

ALTER TABLE work_log_entries
  ADD COLUMN auto_generated_at TIMESTAMPTZ,
  ADD COLUMN pending_review BOOLEAN DEFAULT false;

-- 5. User integration preferences
CREATE TABLE integration_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slack_channels TEXT[],  -- Channel IDs to sync
    github_repos TEXT[],    -- "org/repo" format
    gitlab_projects TEXT[], -- "project_id" or "namespace/project"
    sync_enabled BOOLEAN DEFAULT true,
    sync_frequency TEXT CHECK (sync_frequency IN ('daily', 'weekly')),
    last_sync_week_date DATE,
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_user_integrations_active ON user_integrations(user_id, is_active);
CREATE INDEX idx_log_source_refs_entry ON log_source_references(work_log_entry_id);
CREATE INDEX idx_sync_logs_user_date ON integration_sync_logs(user_id, started_at DESC);
```

---

## Critical Files to Modify

### New Files
```
server/src/
├── lib/
│   ├── slackAdapter.ts        # NEW - Slack API client
│   ├── githubAdapter.ts       # NEW - GitHub API client
│   ├── gitlabAdapter.ts       # NEW - GitLab API client
│   ├── activityNormalizer.ts  # NEW - Unified interface
│   └── autoLogSynthesizer.ts  # NEW - Mistral synthesis
├── routes/
│   └── integrations.ts        # NEW - OAuth + sync endpoints
├── jobs/
│   └── weeklySyncJob.ts       # NEW - Orchestrator job
└── middleware/
    └── integrationAuth.ts     # NEW - Token validation

client/src/
├── pages/
│   ├── Integrations.tsx           # NEW - Connect providers
│   ├── AutoLogReview.tsx          # NEW - Draft review UI
│   └── IntegrationSettings.tsx    # NEW - Channel/repo config
└── components/
    └── Integration/
        ├── ProviderCard.tsx       # NEW - OAuth button
        ├── ActivityFeed.tsx       # NEW - Raw activity preview
        └── DraftDiff.tsx          # NEW - Compare AI draft vs edits
```

### Modified Files
```
server/src/
├── index.ts                # Register integration routes + weeklySyncJob
├── routes/entries.ts       # Add pending_review handling
└── lib/database.ts         # New migrations

shared/src/index.ts         # Add Integration, Activity, SyncLog types

supabase-schema.sql         # Add new tables
client/src/
├── pages/Dashboard.tsx     # Show pending AI drafts
└── App.tsx                 # Add new routes
```

---

## Verification Steps

### 1. Slack Integration Flow
```
1. Navigate to /integrations
2. Click "Connect Slack"
3. Authorize in Slack OAuth
4. Select channels to sync
5. Save preferences
6. Manual sync: Click "Sync Now"
7. Verify: Check /logs for draft entry with Slack data
```

### 2. GitHub Integration Flow
```
1. Navigate to /integrations
2. Click "Connect GitHub"
3. Authorize GitHub OAuth app
4. Select repos/organizations
5. Save preferences
6. Manual sync: Click "Sync Now"
7. Verify: Check /logs for draft with PR/commit data
```

### 3. Weekly Auto-Sync
```
1. Set system clock to Monday 9AM UTC (or wait until real Monday)
2. Check integration_sync_logs table
3. Verify: Each user with active integrations has a sync entry
4. Check work_log_entries for pending_review = true
5. User dashboard shows "Ready for Review" card
```

### 4. Error Recovery
```
1. Set invalid Slack token
2. Trigger sync
3. Verify: Sync log shows failed status
4. Verify: User receives error notification
5. User reconnects OAuth
6. Sync succeeds, error cleared
```

### 5. Draft Review & Edit
```
1. User views draft from AutoLogReview.tsx
2. Edits accomplishments field
3. Clicks "Submit"
4. Verify: status = 'auto-generated-edited'
5. Verify: Source references preserved
6. Verify: Monthly summary cache invalidated
```

---

## Environment Variables Needed

```bash
# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=

# GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=

# GitLab
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_REDIRECT_URI=

# Job configuration
WEEKLY_SYNC_HOUR=9  # UTC
SYNC_JOB_TIMEOUT_MS=300000  # 5 minutes
```

---

## TODO: Implementation Questions

Before implementation, need to clarify:

1. **Slack Workspace Type**: Personal workspace or enterprise grid? (affects channel listing API)
2. **Sync Granularity**: Should users pick specific channels, or sync all?
3. **GitHub Scope**: Personal repos only, or organizations too?
4. **First Provider**: Start with GitHub (simpler API), then Slack?
5. **AI Model**: Continue using Mistral, or switch provider for synthesis?

---

## Phase Rollout Plan

**Week 1-2 (MVP)**: GitHub only, manual trigger, no AI synthesis
- Users connect GitHub
- Fetch PRs/commits for week
- Display raw activity list
- User manually converts to log entry

**Week 3-4**: Add AI synthesis
- Autogenerate draft from GitHub data
- User review/edit/submit flow

**Week 5-6**: Slack integration
- Same pattern as GitHub
- Combined data from both sources

**Week 7**: Auto-schedule
- Weekly cron job
- Email notifications
- Dashboard improvements

---

## What Already Exists

**Leverage from existing code:**

1. **Background Job Pattern** (`server/src/jobs/reminderJob.ts`):
   - Class-based singleton with `start()`/`stop()` methods
   - node-cron scheduling
   - Error handling with logger
   - MDC tagging for tracing

2. **AI Service Pattern** (`server/src/lib/mistral.ts`):
   - Mistral SDK integration
   - Environment variable handling
   - Default "dummy" key for dev

3. **Route Structure** (`server/src/routes/entries.ts`):
   - Express Router pattern
   - requireAuth middleware
   - Standard ApiResponse format

4. **Existing Types** (`shared/src/index.ts`):
   - WorkLogEntry, CreateWorkLogRequest
   - GeneratedAppraisal types

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ EXISTING SYSTEM                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  client/                    server/                                      │
│  ├── pages/                 ├── routes/                                  │
│  │   └── LogEntry.tsx       │   ├── entries.ts (CREATE/READ/WRITE)      │
│  │                          ├── jobs/                                    │
│  │                          │   ├── reminderJob.ts (CRON PATTERN)       │
│  │                          │   └── monthlySummaryJob.ts                 │
│  │                          ├── lib/                                     │
│  │                          │   ├── mistral.ts (AI SYNTHESIS PATTERN)   │
│  │                          │   └── database.ts                          │
│  │                          └── middleware/                              │
│  │                              └── auth.ts (requireAuth)                │
│                                                                          │
│  └──────────────────────────────────────────────────────────────────────┘
│                              ▼ INTEGRATION LAYER (NEW)                   │
│  ┌──────────────────────────────────────────────────────────────────────┐
│  │  NEW: Integration Stack                                               │
│  ├── routes/integrations.ts ──→ OAuth flows, manual sync trigger        │
│  ├── jobs/weeklySyncJob.ts ──→ Orchestrator cron (Mondays 9AM)         │
│  ├── lib/                                                              │
│  │   ├── slackAdapter.ts ────→ Slack API client                         │
│  │   ├── githubAdapter.ts ───→ GitHub API client                        │
│  │   ├── gitlabAdapter.ts ───→ GitLab API client                        │
│  │   ├── activityNormalizer.ts ─→ Unified interface, dedupe            │
│  │   └── autoLogSynthesizer.ts ─→ Mistral prompt + generation          │
│  └──────────────────────────────────────────────────────────────────────┘
│                              ▼ DATABASE (NEW TABLES)                     │
│  ┌──────────────────────────────────────────────────────────────────────┐
│  │  user_integrations (OAuth tokens)                                    │
│  │  log_source_references (Audit trail)                                 │
│  │  integration_sync_logs (Sync history)                                │
│  │  integration_preferences (User config)                               │
│  │  work_log_entries.status (Extension: auto-generated states)          │
│  └──────────────────────────────────────────────────────────────────────┘
```

---

## Error & Rescue Registry

| Failure Mode | Detection | Recovery | User Impact |
|--------------|-----------|----------|-------------|
| OAuth token expired | API returns 401 | Refresh token + retry once | "Reconnect required" notification |
| Rate limit exceeded | API returns 429 | Exponential backoff, skip to next provider | "Some data incomplete" warning |
| Slack workspace revoked | Token validation fails | Set is_active=false, notify user | Must reconnect in settings |
| GitHub org access lost | API returns 404 on repo | Skip inaccessible repos, log warning | Partial data sync |
| Mistral API down | 5xx response | Return "Synthesis failed" error | Manual entry required |
| Weekly sync timeout | Job > 5min | Log partial results, mark as 'partial' | Some weeks incomplete |
| Database constraint violation | UNIQUE violation on source_id | Skip duplicate, increment items_skipped | No user impact |

---

## Failure Modes Registry

| Mode | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OAuth flow broken due to redirect URI mismatch | Low | High | Validate REDIRECT_URI before build, test localhost + prod |
| Slack scope permissions insufficient | Medium | Medium | Document required scopes, show clear error if missing |
| GitHub search API rate limiting | High | Medium | Use search optimization, cache results, exponential backoff |
| AI synthesis produces nonsense | Low | Medium | Word count validation, "reject" flow, manual fallback |
| User privacy concerns about Slack monitoring | Medium | High | Opt-in during onboarding, clear privacy policy, channel whitelist |
| Duplicate activity (commit + PR both logged) | Medium | Low | Dedupe by source_url, prefer higher-fidelity source |
| Timezone drift between providers | Medium | Low | Normalize to UTC, use ISO 8601 everywhere |

---

## Dream State Delta

**CURRENT STATE:**
```
User → Manual Entry (15-20 min/week) → work_log_entries
```

**THIS PLAN:**
```
User → Connect GitHub/Slack → Auto-Sync (5 min review/week) → work_log_entries(status='auto-generated-verified')
```

**12-MONTH IDEAL:**
```
User → Zero Input (real-time sync) → work_log_entries(status='auto-generated-verified')
+ Manager Dashboard → Team analytics, risk flags, recognition suggestions
```

**DELTA FROM THIS PLAN:**
- Current: 15-20 min/week manual typing
- This Plan: 5 min/week review (67% reduction)
- 12-Month Ideal: <1 min/week (95% reduction), manager tools built

---

## CEO Review Findings

### Premise Challenge

**Premises stated or assumed:**
1. Users find manual logging burdensome (assumed)
2. Automatic activity capture is better than manual summary (assumed)
3. GitHub + Slack are primary work signals (assumed)
4. AI synthesis adds value over raw activity list (assumed)

**Evaluation:**
- Premise 1: **Validated** via existing app behavior (low weekly entry completion)
- Premise 2: **Reasonable** - "show don't tell" approach; reduces recall bias
- Premise 3: **Valid** for developer-heavy orgs; may not fit PM/design roles
- Premise 4: **Questionable** - AI synthesis may be overkill; raw activity + user summary could work

**6-Month Regret Scenario:**
Build full Slack integration + AI synthesis, but users just want GitHub commits displayed simply. Complexity debt without proportional value.

**Corrective Add**: **PHASE 1-2 validation gate** - Ship GitHub-only first, measure adoption, then proceed to Slack.

---

### Scope Calibration

**In Scope (Approved):**
- GitHub integration (commits, PRs, reviews)
- GitLab integration (commits, merge requests - defer to Phase 2.5)
- Database schema for OAuth + audit trails
- Background job infrastructure
- Manual sync trigger + weekly auto-sync
- Draft review UI (AutoLogReview.tsx)
- Error handling + recovery

**Borderline (TASTE DECISION - Auto-Approved per P2):**
- Slack integration - defer to Phase 3 based on GitHub adoption metrics
- Reasoning: Slack API is more complex (workspace permissions, channel filtering debates), lower ROI than GitHub for devs. Don't know if GitHub-only satisfies yet.

**Out of Scope:**
- Jira/Linear integration (Phase 3)
- Manager dashboard (Phase 3)
- Real-time webhooks (Perpetual Beta)
- SSO/SAML for enterprise (Phase 4)

---

### Implementation Alternatives

| Approach | Effort | Risk | Pros | Cons |
|----------|--------|------|------|------|
| **A: This Plan** (GitHub→Slack iterative) | 6 weeks | Medium | Validated scope, low risk | Longer time to "full" feature |
| B: GitHub + Slack + GitLab simultaneously | 8 weeks | High | Complete offering Day 1 | Complexity suffered, no validation |
| C: GitHub-only forever | 3 weeks | Low | Fastest, most focused | May not satisfy PM/design roles |

**Decision: Alternative A** - Iterative validation per Principle 2 (boil lakes in blast radius) and Principle 3 (pragmatic: validate before scaling).

---

### Competitive Risks

**Direct Competitors:**
- **Range** - Integrates with GitHub, Slack, Jira; CEO-facing summaries
- **Staffbase** - Enterprise employee communications, weak on dev tools
- **Level** - OKR-focused, weak on auto-log capture

**Risk:** Range has 3+ year lead on integrations; they holistically capture enabled channels (not just GitHub). Differentiation: lower cost, developer-first UX, "human-in-the-loop" governance.

**Mitigation:** GitHub-first approach; add Slack only after proving GitHub has traction.

---

## NOT in Scope

**Deferred to TODOs.md:**
1. **Slack integration** - See CEO review; validate GitHub-only first
2. **GitLab integration** - Wait for GitHub PM; GitLab users = <5% of SMB dev market
3. **Jira/Linear integration** - Requires more complex OAuth + ticket workflow; Phase 3
4. **Real-time webhooks** - Employee preference: "catch-up" model beats "live stream"
5. **Manager dashboard analytics** - Single-user focus first; B2B2C expansion Phase 3

---

## What Already Exists

**File Mapping: Sub-problems to Existing Code**

| Sub-problem | Existing Code | Reuse Pattern |
|-------------|---------------|---------------|
| Background jobs | `server/src/jobs/reminderJob.ts` | Class-based singleton, node-cron |
| AI synthesis | `server/src/lib/mistral.ts` | Mistral SDK with env var handling |
| Auth middleware | `server/src/middleware/auth.ts` | requireAuth pattern |
| Express routes | `server/src/routes/entries.ts` | Router + requireAuth + ApiResponse |
| Shared types | `shared/src/index.ts` | WorkLogEntry, ApiResponse |

**No existing code for:**
- OAuth flows (new)
- Activity fetching (new)
- Activity normalization (new)
- ISLOG_SOURCE_REFERENCES audit trail (new SQL)

---

## Test Plan

### Test Coverage by Component

| Component | Unit Tests | Integration Tests | E2E Tests |
|-----------|------------|-------------------|-----------|
| GitHubAdapter | ✓ OAuth exchange, PR/commit fetch | ✓ Token refresh, rate limit backoff | ✓ Full sync flow |
| SlackAdapter | Defer to Phase 2 | Defer to Phase 2 | Defer to Phase 2 |
| ActivityNormalizer | ✓ Dedupe logic, week grouping | N/A | N/A |
| AutoLogSynthesizer | ✓ Prompt construction, output validation | ✓ Mistral mock integration | N/A |
| weeklySyncJob | ✓ Per-user iteration, timeout enforcement | ✓ Multi-provider sync | ✓ Monday 9AM cron trigger |
| Integrations routes | ✓ OAuth callback handling | ✓ Token storage, initial sync | ✓ Connect GitHub flow |
| AutoLogReview.tsx | ✓ Draft display, edit mode | ✓ Form submit, status update | ✓ View→Edit→Submit flow |

### Test Categories

**Unit Test Checklist:**
1. Activity dedupe by URL - edge case: 3 identical PRs across repos
2. Week boundary grouping - edge case: Friday 11:59PM commit
3. AI output word count validation - edge case: 150-word draft (reject)
4. Token refresh failure - edge case: refresh token also expired

**Integration Test Checklist:**
1. GitHub OAuth callback → token storage → immediate sync
2. Weekly job → fetch all providers → normalization → synthesis
3. Invalid token → 401 → refresh → 401 again → mark inactive

**E2E Checklist:**
1. User clicks "Connect GitHub" → authorize → dashboard shows "Connected"
2. Monday 9AM → email draft ready → user reviews → submits
3. Revoke GitHub access → next sync → "Reconnect required" notification

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | GitHub-first, defer Slack | Taste (P2) | Boil lakes in blast radius | Validate GitHub adoption before Slack complexity | Slack Day 1 - same effort assumption false; Slack adds 2 weeks |
| 2 | CEO | Week 1-2 MVP without AI synthesis | Taste (P3) | Pragmatic - simpler first | Users may prefer raw activity list; AI could been overkill | Include AI Phase 1 - risk: wrong prompt = user distrust |
| 3 | Eng | Monolithic weeklySyncJob vs microservices | Mechanical (P5) | Explicit over clever | Single job easier to debug, deploy, monitor | Microservices - premature scaling |
| 4 | Eng | Mistral for synthesis (reuse existing) | Mechanical (P1) | Choose completeness | Already have API key; no switching cost | Switch to fine-tuned model - deferred |
| 5 | DX | OAuth scopes as URL parameters | Mechanical (P5) | Explicit over clever | Standard OAuth pattern, easy to understand | Interactive scope picker - extra UX complexity |

---

## GDPR Privacy Compliance Notes

**Data Minimization:**
- Delete raw activity data (source_data JSON) after 90 days
- Retain only metadata: source_type, timestamp, source_url
- Source URL references are not PII

**Right to Erasure:**
- Cascade deletes: user_integrations → log_source_references → work_log_entries (if only auto-generated)
- ORPHANED manual entries: retain, alert user "linked data deleted"

**Consent:**
- Explicit opt-in during onboarding ("Connect your work tools")
- Per-provider opt-in (User must click "Connect GitHub", not auto-enroll)
- Revocation via "Disconnect" in settings → immediate token deletion

**Data Residency:**
- Tokens stored encrypted at rest (Supabase encryption)
- OAuth scopes documented in UI prior to authorization

---

## Review Scores

**CEO: 7/10** - Sound strategy, pragmatic scope decisions. Gap: Slack deferral requires explicit success metrics to avoid "half-finished" feeling.

**Eng: 8/10** - Clean architecture, reuses existing patterns well. Gap: Test plan coverage incomplete for token refresh edge cases.

**Design: Skipped - No UI scope.** (Only draft review UI per existing LogEntry.tsx pattern)

**DX: 6/10** - Standard OAuth flow, minimal friction. Gap: No "why connect?" motivation copy shown during onboarding flow.

---

## Implementation Tasks (aggregated)

- [ ] **CR1 (P1, human: 3h / CC: 30m) — Database** — Add user_integrations, log_source_references, integration_sync_logs tables
  - Surfaced by: CEO - Schema validation
  - Files: supabase-schema.sql
- [ ] **CR2 (P1, human: 30m / CC: 15m) — Types** — Add Integration, SourceReference, SyncLog interfaces
  - Surfaced by: Eng - Type extension
  - Files: shared/src/index.ts
- [ ] **DA1 (P1, human: 2d / CC: 4h) — SDK** — Implement GitHubAdapter with OAuth + PR/commit fetching
  - Surfaced by: Eng - Stage 1 implementation
  - Files: server/src/lib/githubAdapter.ts
- [ ] **DA2 (P1, human: 4h / CC: 1h) — Middleware** — Implement activityNormalizer with dedupe
  - Surfaced by: Eng - Normalization layer
  - Files: server/src/lib/activityNormalizer.ts
- [ ] **DA3 (P1, human: 2h / CC: 30m) — SDK** — Implement autoLogSynthesizer with Mistral
  - Surfaced by: Eng - AI synthesis
  - Files: server/src/lib/autoLogSynthesizer.ts
- [ ] **OR1 (P2, human: 1d / CC: 2h) — Routes** — Implement integrations.ts routes
  - Surfaced by: Eng - OAuth flow
  - Files: server/src/routes/integrations.ts
- [ ] **OR2 (P2, human: 3h / CC: 1h) — Jobs** — Implement weeklySyncJob orchestration
  - Surfaced by: Eng - Background job
  - Files: server/src/jobs/weeklySyncJob.ts
- [ ] **UI1 (P2, human: 2d / CC: 3h) — Frontend** — Build AutoLogReview.tsx page
  - Surfaced by: Eng - User review flow
  - Files: client/src/pages/AutoLogReview.tsx
- [ ] **UI2 (P3, human: 4h / CC: 1h) — Frontend** — Update Dashboard.tsx for pending drafts
  - Surfaced by: DX - In-app messaging
  - Files: client/src/pages/Dashboard.tsx
- [ ] **IT1 (P3, human: 1h / CC: 30m) — Config** — Update server/index.ts to register routes + start jobs
  - Surfaced by: Eng - System integration
  - Files: server/src/index.ts
- [ ] **QT1 (P1, human: 4h / CC: 1h) — Testing** — GitHubAdapter unit + integration tests
  - Surfaced by: Test plan
  - Files: server/tests/githubAdapter.test.ts
- [ ] **QT2 (P2, human: 2h / CC: 30m) — Testing** — AutoLogSynthesizer tests
  - Surfaced by: Test plan
  - Files: server/tests/autoLogSynthesizer.test.ts

## Next Actions

1. Run database migration (supabase-schema.sql additions)
2. Add shared types (shared/src/index.ts)
3. Implement GitHubAdapter
4. Wire-up weeklySyncJob
5. Build AutoLogReview UI
6. E2E test end-to-end

Ready to implement.