# Enterprise Suite Transformation Plan

## Executive Summary

This plan transforms Worklog AI from a standalone weekly logging tool into an **enterprise-grade performance management suite** by addressing two critical feedback points:

1. **Integration with Source Systems** (GitHub, Jira, etc.) to auto-populate work logs and eliminate manual entry
2. **Positioning Shift** from "AI replaces reviews" to "AI removes admin drag while humans keep decision ownership"

---

## The Strategic Shift

### Before (Current State)
- **Value Prop:** "AI自动生成 performance appraisals"
- **User Effort:** Manual weekly entries (15-20 mins/week)
- **Bottleneck:** "Appraisal fatigue" - users don't want to write; managers hate reviewing box-checking exercises

### After (Enterprise Suite)
- **Value Prop:** "AI removes administrative drag from performance management while humans keep decision ownership"
- **User Effort:** Zero manual entry (auto-sync from GitHub, Jira, linear, etc.), weekly review only (5 mins/week)
- **Differentiation:** Trust, compliance, fairness through data authenticity + human-in-the-loop control

---

## Core Pillars

### Pillar 1: Integration Hub (GitHub, Jira, Linear, GitLab, Bitbucket)

**Problem Solved:** appraisal fatigue caused by manual logging

**Approach:**
1. **OAuth2 Connections** - Users authorize connections to their work tools
2. **Automated Data Ingestion** - Fetch commits, PRs, issues, sprints, tickets
3. **AI-Generated Draft Entries** - Transform raw activity→structured weekly logs
4. **Human Review Gate** - User verifies/edits before committing (compliance guardrail)
5. **Audit Trail** - Every entry traces back to source (Jira ticket #, PR link)

**Why This Works for Enterprise:**
- **Trust:** Data is verifiable against source systems
- **Compliance:** RLS + data lineage for HR audits
- **Fairness:** No ``hindsight bias`` - actual data, not remembered highlights

---

### Pillar 2: Human-in-the-Loop Governance

**Problem Solved:** HR workflows blocked by trust/fairness/compliance concerns

**Approach:**
1. **AI Drafts, Human Decides** - AI generates context; managers write final reviews
2. **Evidence-Based Reviews** - Managers click any claim to see source evidence
3. **Bias Detection** - Flag potential patterns (e.g., under-weighting remote work)
4. **Calibration Tools** - Compare rating distributions across teams
5. **Export Controls** - GDPR-compliant data export/deletion

**Why This Works for Enterprise:**
- **Decision Ownership:** Managers retain final say (legal requirement in many jurisdictions)
- **Compliance-Ready:** Full audit trail for labor law requirements
- **Fairness-by-Design:** Bias checks built into review workflow

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Enable GitHub integration + reframe positioning

#### Deliverables:

**1.1 Database Schema Extensions**
```sql
-- OAuth connections table
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'jira', 'linear', 'gitlab', 'bitbucket')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[] NOT NULL,
    provider_user_id TEXT,
    provider_organization_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider, provider_user_id)
);

-- Source data reference table (proves data lineage)
CREATE TABLE log_source_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_log_entry_id UUID NOT NULL REFERENCES work_log_entries(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('commit', 'pr', 'issue', 'ticket', 'sprint')),
    source_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_data JSONB NOT NULL, -- Full snapshot for audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration sync history
CREATE TABLE integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    items_fetched INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

**1.2 Shared Types**
```typescript
export type IntegrationProvider = 'github' | 'jira' | 'linear' | 'gitlab' | 'bitbucket'
export type SourceType = 'commit' | 'pr' | 'issue' | 'ticket' | 'sprint'

export interface Integration {
    id: string
    user_id: string
    provider: IntegrationProvider
    access_token: string
    refresh_token?: string
    token_expires_at?: string
    scopes: string[]
    provider_user_id?: string
    provider_organization_id?: string
    is_active: boolean
}

export interface SourceReference {
    work_log_entry_id: string
    provider: IntegrationProvider
    source_type: SourceType
    source_id: string
    source_url: string
    source_data: any
}

export interface FetchedActivity {
    provider: IntegrationProvider
    source_type: SourceType
    id: string
    title: string
    description?: string
    url: string
    timestamp: string
    metadata: any
}
```

**1.3 Server Integration Service**
- File: `server/src/lib/integrationService.ts`
- Responsibilities:
  - OAuth2 flow (GitHub OAuth App setup)
  - Token refresh automation
  - Activity fetching (PRs, commits, issues by date range)
  - Rate limiting handling (exponential backoff)
  - Data normalization across providers

**1.4 Server Integration Routes**
- File: `server/src/routes/integrations.ts`
- Endpoints:
  - `GET /api/integrations` - List connected providers
  - `POST /api/integrations/:provider/connect` - Start OAuth flow
  - `GET /api/integrations/:provider/callback` - OAuth callback handler
  - `DELETE /api/integrations/:id` - Disconnect provider
  - `POST /api/integrations/:provider/sync` - Manual trigger sync
  - `GET /api/integrations/:provider/activity` - Fetch raw activity for preview

**1.5 Mnagers-Only Dashboard View**
- File: `client/src/pages/ManagerDashboard.tsx`
- Features:
  - Team integration coverage (% connected)
  - Auto-logged vs manual entry ratio
  - Compliance readiness score

---

### Phase 2: Auto-Log Generation (Weeks 5-8)

**Goal:** Transform raw activity into draft weekly logs

#### Deliverables:

**2.1 AI Activity Summarization Service**
- File: `server/src/lib/autoLogService.ts`
- Responsibilities:
  - Fetch user's activity for a given week from all connected providers
  - Generate structured weekly log draft using Mistral
  - Attach source references for every claim

**Prompt Template:**
```typescript
const autoLogPrompt = `Analyze this week's work activity and generate a weekly log draft.

RULES:
- Use ONLY the activity data provided below
- Group activities into: Completed Work, In Progress, Blockers, Learnings
- For each item, cite the source (PR #, ticket ID, commit hash)
- If activity is unclear, mark as "Needs Review"
- Output should be 200-400 words

WEEK ACTIVITY:
${JSON.stringify(formattedActivity, null, 2)}

Generate draft log:`
```

**2.2 Weekly Auto-Sync Job**
- File: `server/src/jobs/autoLogJob.ts`
- Runs: Daily at 11 PM UTC
- For all users with active integrations:
  1. Fetch activities for incomplete weeks
  2. Generate draft entries
  3. Mark as `pending_review` status
  4. Send email/notification: "Your draft is ready for review"

**2.3 Database Schema Extension**
```sql
ALTER TABLE work_log_entries ADD COLUMN status TEXT DEFAULT 'manual' 
    CHECK (status IN ('manual', 'auto-generated', 'auto-generated-verified', 'auto-generated-edited'));

ALTER TABLE work_log_entries ADD COLUMN auto_generated_at TIMESTAMPTZ;
ALTER TABLE work_log_entries ADD COLUMN pending_review BOOLEAN DEFAULT false;
```

**2.4 Client Auto-Log UI**
- File: `client/src/pages/AutoLogReview.tsx`
- Features:
  - Show this week's draft (highlighting AI-generated content)
  - Edit mode for user to refine
  - "Accept & Submit" button (changes status to `auto-generated-verified`)
  - Click any item to see source link (PR, ticket)

---

### Phase 3: Enterprise Governance Features (Weeks 9-12)

**Goal:** Governance tools for HR/Manager trust

#### Deliverables:

**3.1 Evidence Linking System**
- Every claim in appraisal links back to source
- File: `server/src/routes/evidence.ts`
- Endpoints:
  - `GET /api/appraisals/:id/evidence` - All source references for an appraisal
  - `GET /api/evidence/:id` - Single evidence item with full payload

**3.2 Manager Review Workflow**
- File: `client/src/pages/ManagerReview.tsx`
- Features:
  - View team's weekly logs with evidence panels
  - AI-generated review suggestions (separate from final)
  - Human-written review input with inline citations
  - "Request clarification" button to send back to employee

**3.3 Bias Detection Service**
- File: `server/src/lib/biasDetectionService.ts`
- Checks:
  - Comment sentiment by demographic (if data available)
  - Claim-to-evidence ratio by reviewer
  - Rating variance vs. team average (outlier detection)
  - Word count asymmetry in feedback

**3.4 Compliance Audit Export**
- File: `server/src/routes/compliance.ts`
- Endpoints:
  - `GET /api/compliance/export?user_id=xxx&period=xxx` - Full data export
  - `GET /api/compliance/lineage?entry_id=xxx` - Data lineage for specific entry
  - Response includes: original source data, transformation steps, human review record

---

### Phase 4: Positioning & Messaging Updates (Week 13)

**Goal:** Update all user-facing messaging to reflect enterprise positioning

#### Deliverables:

**4.1 Landing Page Rewrite**
- File: `client/src/components/LandingPage.tsx`
- New Headline: "Remove Administrative Drag from Performance Management"
- Subhead: "AI automates the data gathering. Your managers keep decision ownership."
- Key Features:
  - "Auto-sync from GitHub, Jira, Linear — no more manual logging"
  - "Evidence-based reviews — every claim links to source data"
  - "Compliance-ready — full audit trail for HR requirements"

**4.2 Onboarding Flow**
- File: `client/src/pages/Onboarding.tsx`
- Step 1: "Connect your work tools" (GitHub/Jira/Linear)
- Step 2: "We'll auto-generate your weekly drafts — you review in 5 mins"
- Step 3: "Your manager writes evidence-backed reviews, you own the final call"

**4.3 In-App Messaging**
- Update all "AI appraisal" language to "AI-assisted, human-decided appraisal"
- Update "Appraisal Generation" button to "Generate Review Draft"

---

## File Structure Changes

### New Files
```
server/src/
├── lib/
│   ├── integrationService.ts    # NEW - OAuth + activity fetching
│   ├── autoLogService.ts        # NEW - Activity → draft log generation
│   └── biasDetectionService.ts  # NEW - Fairness analysis
├── routes/
│   ├── integrations.ts         # NEW - OAuth endpoints
│   └── compliance.ts           # NEW - Audit/export endpoints
├── jobs/
│   └── autoLogJob.ts           # NEW - Daily draft generation
└── middleware/
    └── integrationAuth.ts      # NEW - Provider token validation

client/src/
├── pages/
│   ├── AutoLogReview.tsx           # NEW - Weekly draft review
│   ├── ManagerDashboard.tsx        # NEW - Team analytics
│   ├── ManagerReview.tsx           # NEW - Review workflow
│   ├── Onboarding.tsx              # NEW - Connect integrations
│   └── Integrations.tsx            # NEW - Settings page
├── components/
│   └── Integration/
│       ├── ProviderCard.tsx        # NEW - OAuth connection UI
│       ├── ActivityPreview.tsx     # NEW - Raw activity display
│       └── EvidencePanel.tsx       # NEW - Source reference display
└── lib/
    └── integrations.ts             # NEW - Provider API clients
```

### Modified Files
```
server/src/
├── index.ts            # Register new routes + jobs
├── routes/entries.ts   # Add status + source reference fields
└── routes/appraisal.ts # Add evidence endpoint

shared/src/index.ts     # Add Integration, SourceReference types

supabase-schema.sql     # Add integrations, log_source_references tables
client/src/
├── pages/LandingPage.tsx   # Update messaging
├── pages/Dashboard.tsx     # Add integration status badge
└── App.tsx                 # Add new routes
```

---

## Engineering Trade-offs

### GitHub First, then Expand

**Why:** GitHub has largest SMB/market share + clean API + generous rate limits

**Trade-off:** Delay Jira/Linear until product-market fit proven

**Mitigation:** Design abstraction layer (IntegrationProvider interface) for easy addition

### Pull vs Push Architecture

**Chosen:** Pull (cron jobs fetch activity)
- Pros: Simpler, no webhook complexity, predictable rate limiting
- Cons: Delayed activity (up to 24h)

**Fallback:** Webhook architecture for real-time features (not MVP)

### AI Drafts vs Raw Activity Display

**Chosen:** AI-drafted weekly logs (structured)
- Pros: Familiar format, reduces cognitive load, matches existing UX
- Cons: Another AI translation layer (activity → log → appraisal)

**Alternative:** Show raw activity for user to comment on (used by Level, Perform)

---

## Security & Compliance

### Data Handling
1. **OAuth Tokens:** Store in encrypted column (application-level encryption)
2. **Source Data:** Retain only 90 days (GDPR minimization)
3. **PII:** Never store full names/emails from provider (only IDs)
4. **Audit Log:** Every data access (view, export, delete)

### Enterprise Requirements
- SSO/SAML for team plans (Phase 2)
- SOC 2 Type II readiness (audit log schema designed)
- GDPR Article 15 export (compliance export endpoint)
- Right to erasure (integration cascade deletes)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Weekly active integrations | 60% of users | `is_active` integrations |
| Auto-log adoption | 40% of entries | `auto-generated` entries / total |
| Draft verification rate | 70% | Verified submissions / Drafts sent |
| Time-to-submit reduction | -50% | from 15 min → 7 min average |
| Manager review cycle time | -40% | From 2 weeks → 8 days |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub API downtime | Auto-log failures | Cache last successful fetch, allow manual override |
| OAuth token expiration | Stale data | Automatic refresh + user notification on failure |
| GDPR data deletion requests | Cascade deletes | `ON DELETE CASCADE` policies, sync log retention |
| False AI summaries | User distrust | Mark AI content clearly, easy edit mode, source citations |
| Enterprise security review delays | Sales cycle >6 months | Security questionnaire pre-packaged, penetration test report |

---

## Implementation Timeline

```
Weeks 1-4:   Phase 1 - Foundation
    ├─ Integration schema + OAuth flows (GitHub)
    ├─ Activity fetching service
    ├─ Sync job infrastructure
    └─ Integration settings UI

Weeks 5-8:   Phase 2 - Auto-Log Generation
    ├─ AI draft generation service
    ├─ Daily auto-sync job
    ├─ AutoLog review page
    └─ Email notifications

Weeks 9-12:  Phase 3 - Enterprise Governance
    ├─ Evidence linking system
    ├─ Manager review workflow
    ├─ Bias detection (basic)
    └─ Compliance export

Week 13:     Phase 4 - Positioning
    ├─ Landing page rewrite
    ├─ Onboarding redesign
    └─ In-app messaging updates
```

---

## Exit Criteria

✅ **Phase 1 Complete:** Users can connect GitHub, view fetched activity

✅ **Phase 2 Complete:** Auto-generated drafts appear, users can accept/edit

✅ **Phase 3 Complete:** Managers can view evidence, use compliance export

✅ **Phase 4 Complete:** All user-facing copy reflects new positioning

---

## Appendix A: OAuth Flow (GitHub Example)

```
1. User clicks "Connect GitHub"
   → GET /api/integrations/github/connect
   → Returns: OAuth authorization URL

2. User authorizes on GitHub
   → GitHub redirects to /api/integrations/github/callback?code=xxx

3. Server exchanges code for token
   → POST https://github.com/login/oauth/access_token
   → Store token in integrations table

4. Server fetches user info
   → GET https://api.github.com/user
   → Link account to Worklog AI user

5. Immediate sync trigger
   → Fetch past 7 days of activity
   → Generate first draft
   → Send email: "Your draft is ready"
```

---

## Appendix B: Data Lineage Example

```json
{
  "entry_id": "uuid-1234",
  "status": "auto-generated-edited",
  "created_at": "2025-05-17T10:00:00Z",
  "background": {
    "auto_generated_at": "2025-05-17T00:00:00Z",
    "source_job_id": "job-uuid-5678"
  },
  "evidence": [
    {
      "statement": "Shipped JWT token rotation feature",
      "references": [
        {
          "provider": "github",
          "source_type": "pr",
          "id": "#234",
          "url": "https://github.com/org/repo/pull/234",
          "snapshot": {
            "title": "Add JWT token rotation",
            "merged_at": "2025-05-15T14:30:00Z",
            "author": "user-name",
            "commits": 3
          }
        }
      ]
    }
  ]
```

End of Plan