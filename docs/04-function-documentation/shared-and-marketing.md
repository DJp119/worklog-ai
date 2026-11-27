# Backend Functions: Shared Types & Marketing Site

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. `shared/` — Type Contracts

### 1.1 File: `shared/src/index.ts` (603 lines)

**Purpose:** Single source of truth for all API request/response types and domain models. Consumed by both `client/` and `server/` via npm workspace.

**Exports (by domain):**

#### API Response
```ts
ApiResponse<T> { success: boolean, data?: T, error?: string }
```

#### Work Log Entries
```ts
WorkLogEntry, CreateWorkLogRequest, UpdateWorkLogRequest
```

#### Appraisal
```ts
GeneratedAppraisal, AppraisalCriteria, GenerateAppraisalRequest, GenerateAppraisalResponse
```

#### Monthly Summary
```ts
MonthlySummary
```

#### Chat
```ts
ChatSession, ChatMessage, CreateChatSessionRequest, SendChatMessageRequest
```

#### User Profile
```ts
UserProfile, UpdateProfileRequest
```

#### Auth
```ts
LoginRequest, SignupRequest, AuthTokenResponse, PasswordChangeRequest,
ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest
```

#### Reminder Log
```ts
ReminderLog
```

#### Error
```ts
ApiError
```

#### AI Pulse
```ts
AIArticle, AIImpactCard, BookmarkRequest, Bookmark
```

#### Corporate Teams
```ts
OrgRole, TeamRole, Organization, OrgMember, Department, Team, TeamMember,
CreateOrgRequest, CreateTeamRequest, CreateDepartmentRequest
```

#### Goals
```ts
GoalScope, GoalStatus, GoalPeriod, ProgressMode, MetricType,
Goal, GoalKeyResult, GoalLinkProvider, GoalLink, GoalAssignee, GoalUpdate,
GoalWithDetails, CreateGoalRequest, UpdateGoalRequest, CreateKeyResultRequest,
CreateCheckInRequest, AssignGoalRequest, LinkWorkItemRequest
```

#### Integrations
```ts
IntegrationProvider, UserIntegration, OrgIntegrationProvider, OrgIntegration,
JiraSite, JiraConnectStartResponse, JiraOAuthConfirmRequest,
SlackLinkPinRequest, SlackLinkPinStartResponse
```

#### Subscriptions & Billing
```ts
SubscriptionTier, SubscriptionStatus, Subscription
```

#### Channel Preferences
```ts
ChannelProvider, ChannelType, ChannelPreference
```

#### AI Performance Reports
```ts
ReportType, ReportStatus, PerformanceReport, GenerateReportRequest
```

### 1.2 Build artifacts (excluded from docs)

| File | Origin | Why excluded |
|---|---|---|
| `shared/index.js` | `tsc` compilation | Build output |
| `shared/index.d.ts` | `tsc` declaration emit | Build output |
| `shared/index.js.map` | Source map | Build output |
| `shared/index.d.ts.map` | Source map | Build output |

### 1.3 Dependency graph

```
shared/src/index.ts (source)
    ↓ tsc
shared/index.js + .d.ts (consumed by client/ and server/ via "file:../shared")
```

---

## 2. `worklog-marketing/` — Next.js Marketing Site

### 2.1 Structure

```text
worklog-marketing/
├── public/                       # Static assets
├── src/
│   ├── app/                      # App Router pages
│   │   ├── layout.tsx            # Root layout, fonts, metadata
│   │   ├── page.tsx              # Landing page
│   │   ├── blog/
│   │   │   ├── page.tsx          # Blog index
│   │   │   └── [slug]/page.tsx   # Blog post detail
│   │   ├── templates/self-appraisal/
│   │   │   ├── page.tsx          # Template index (SEO)
│   │   │   └── [role]/page.tsx   # Role-specific template
│   │   ├── privacy/page.tsx      # Privacy policy
│   │   ├── terms/page.tsx        # Terms of service
│   │   ├── robots.ts             # robots.txt generator
│   │   └── sitemap.ts            # sitemap.xml generator
│   ├── components/               # 3 shared components
│   │   ├── FaqAccordion.tsx      # Expandable FAQ
│   │   ├── PainGrid.tsx          # Problem/solution grid
│   │   └── PlaygroundWidget.tsx  # Public appraisal playground
│   └── content/
│       └── blogPosts.ts          # Blog content (hardcoded array)
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tsconfig.json
└── vercel.json
```

### 2.2 Page functions (Tier A)

| Function | File:line | Purpose |
|---|---|---|
| `layout.tsx` | `app/layout.tsx` | Root layout, fonts (Inter), global metadata, `<html lang>` |
| `page.tsx` | `app/page.tsx` | Landing page (hero, features, testimonials, CTA) |
| `blog/page.tsx` | `app/blog/page.tsx` | Blog index (lists `blogPosts`) |
| `blog/[slug]/page.tsx` | `app/blog/[slug]/page.tsx` | Blog post (markdown from `blogPosts`) |
| `templates/self-appraisal/page.tsx` | `app/templates/self-appraisal/page.tsx` | Template index (role cards) |
| `templates/self-appraisal/[role]/page.tsx` | `app/templates/self-appraisal/[role]/page.tsx` | Role-specific template (SEO) |
| `privacy/page.tsx` | `app/privacy/page.tsx` | Privacy policy |
| `terms/page.tsx` | `app/terms/page.tsx` | Terms of service |
| `robots.ts` | `app/robots.ts` | Generates `robots.txt` with sitemap reference |
| `sitemap.ts` | `app/sitemap.ts` | Generates `sitemap.xml` from known routes |

### 2.3 Component functions (Tier B)

| Function | File:line | Purpose |
|---|---|---|
| `FaqAccordion` | `components/FaqAccordion.tsx` | Expandable FAQ list |
| `PainGrid` | `components/PainGrid.tsx` | Problem/solution grid |
| `PlaygroundWidget` | `components/PlaygroundWidget.tsx` | Public appraisal playground |

### 2.4 Content

| File | Purpose |
|---|---|
| `content/blogPosts.ts` | Array of blog posts: `slug`, `title`, `date`, `excerpt`, `content` (markdown), `tags`, `readTime` |

### 2.5 Config

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js config (`output: 'export'` for static, images unoptimized) |
| `tsconfig.json` | TS config (paths, strict) |
| `eslint.config.mjs` | ESLint flat config |
| `postcss.config.mjs` | PostCSS (Tailwind) |
| `vercel.json` | Vercel config (rewrites for SPA fallback) |

### 2.6 Relationship to product app

- **No code dependency.** No imports from `shared/`, `client/`, or `server/`.
- **Content overlap:** `PlaygroundWidget` mirrors `client/src/components/landing/PlaygroundWidget.tsx` but separate implementation.
- **Links:** Buttons point to deployed app URL (configured via env or hardcoded).
- **Separate deployment:** Separate Vercel project (or project folder) from main app.

---

## 3. Cross-cutting observations

### Shared types as contract

- `client/` and `server/` both declare `"shared": "file:../shared"` in `package.json`.
- TypeScript project references (`tsconfig.json` at root) ensure `shared` builds first.
- **Risk:** if `shared` types drift from actual DB schema, runtime errors occur.
  - Example: `UserProfile` in `shared` includes `firstName`, `industry`, `function`, etc. that come from `user_profiles` table, but the server `users` table has different columns. The server maps manually in `auth.ts:386-393`.

### Marketing site as separate deployment

- The marketing site is a **completely separate Vercel project** (or project folder).
- It shares no runtime code with the product.
- This is intentional: marketing can iterate on SEO/landing pages without touching the SPA.

### Generated files policy

| Generated file | Source | Documented? |
|---|---|---|
| `shared/index.js` | `shared/src/index.ts` | No (build artifact) |
| `shared/index.d.ts` | `shared/src/index.ts` | No (build artifact) |
| `worklog-marketing/out/` | `next build` | No (build output) |
| `client/dist/` | `vite build` | No (build output) |
| `server/dist/` | `tsc` | No (build output) |

---

## Related documents

- [Directory map](../03-codebase-structure/directory-map.md)
- [Module dependencies](../03-codebase-structure/module-dependencies.md)
- [Project overview](../01-project-overview.md)

## Verification notes

Generated by reading `shared/src/index.ts` entirely and all files under `worklog-marketing/src` at commit `7567207`. Build artifacts excluded.