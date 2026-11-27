# API Reference: Platform & Miscellaneous

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. AI Pulse (`/api/ai-pulse`)

### 1.1 `GET /api/ai-pulse/articles`

| Property | Value |
|---|---|
| Auth | `optionalAuth` |
| Query params | `category?`, `search?`, `page?`, `limit?` |
| Success | 200 `{ success: true, data: { articles: AIArticle[], total: number, page: number, limit: number } }` |
| Errors | 500 |

**Response (`AIArticle`):**
```json
{
  "id": "uuid",
  "title": "string",
  "slug": "string",
  "summary": "string",
  "content": "string",
  "source_url": "string|null",
  "source_name": "string|null",
  "category": "'news'|'models'|'startups'|'research'|'tools'|'open_source'|'funding'|'india_ai'|'world_ai'",
  "published_at": "ISO8601",
  "impact_summary": "string|null",
  "cta_text": "string|null",
  "cta_link": "string|null",
  "thumbnail_url": "string|null",
  "views_count": "number",
  "bookmark_count": "number",
  "share_count": "number",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

### 1.2 `GET /api/ai-pulse/articles/:slug`

| Property | Value |
|---|---|
| Auth | `optionalAuth` |
| Path params | `slug` (string) |
| Success | 200 `{ success: true, data: AIArticle }` |
| Side effect | Increments `views_count` |
| Errors | 404, 500 |

---

### 1.3 `GET /api/ai-pulse/impact-cards`

| Property | Value |
|---|---|
| Auth | `optionalAuth` |
| Success | 200 `{ success: true, data: AIImpactCard[] }` |
| Errors | 500 |

**Response (`AIImpactCard`):**
```json
{
  "id": "uuid",
  "slug": "string",
  "industry": "'jobs'|'healthcare'|'education'|'finance'|'marketing'|'engineering'|'design'|'hr'|'agriculture'|'manufacturing'",
  "industry_display_name": "string",
  "what_changed": "string",
  "impact_level": "'high'|'medium'|'low'",
  "companies_involved": "string[]",
  "future_prediction": "string",
  "opportunities": "string[]",
  "risks": "string[]",
  "tools": "string[]",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

### 1.4 `GET /api/ai-pulse/impact-cards/:industry`

| Property | Value |
|---|---|
| Auth | `optionalAuth` |
| Path params | `industry` (enum) |
| Success | 200 `{ success: true, data: AIImpactCard }` |
| Errors | 404, 500 |

---

### 1.5 `GET /api/ai-pulse/bookmarks`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: Bookmark[] }` |
| Errors | 401, 500 |

**Response (`Bookmark[]`):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "article_id": "uuid|null",
    "impact_card_id": "uuid|null",
    "created_at": "ISO8601"
  }
]
```

---

### 1.6 `POST /api/ai-pulse/bookmarks`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ article_id?: string, impact_card_id?: string }` (exactly one) |
| Success | 201 `{ success: true, data: Bookmark }` |
| Errors | 401, 400 (validation), 409 (already bookmarked), 500 |

---

### 1.7 `DELETE /api/ai-pulse/bookmarks/:id`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 404, 500 |

---

### 1.8 `POST /api/ai-pulse/admin/articles`

| Property | Value |
|---|---|
| Auth | None (admin check in handler) |
| Request body | `AIArticle` (without id, counts, timestamps) |
| Success | 201 `{ success: true, data: AIArticle }` |
| Errors | 400, 500 |

---

### 1.9 `POST /api/ai-pulse/admin/impact-cards`

| Property | Value |
|---|---|
| Auth | None (admin check in handler) |
| Request body | `AIImpactCard` (without id, timestamps) |
| Success | 201 `{ success: true, data: AIImpactCard }` |
| Errors | 400, 500 |

---

### 1.10 `GET /api/ai-pulse/for-you`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { articles: AIArticle[], impact_cards: AIImpactCard[] } }` |
| Errors | 401, 500 |

**Personalized:** Based on user's bookmarks and reading history.

---

### 1.11 `GET /api/ai-pulse/og/article/:slug`

| Property | Value |
|---|---|
| Auth | None |
| Path params | `slug` (string) |
| Success | 200 `text/html` (Open Graph meta tags) |
| Errors | 404, 500 |

---

### 1.12 `GET /api/ai-pulse/og/article/:slug.png`

| Property | Value |
|---|---|
| Auth | None |
| Path params | `slug` (string) |
| Success | 200 `image/png` (generated OG image) |
| Errors | 404, 500 |

**Generation:** Server-side image generation for social sharing.

---

### 1.13 `POST /api/ai-pulse/admin/collect-news`

| Property | Value |
|---|---|
| Auth | None (admin) |
| Success | 200 `{ success: true, message: "News collection started" }` |
| Errors | 500 |

**Triggers:** `newsCollectionJob` logic inline.

---

## 2. Push Notifications (`/api/push`)

### 2.1 `GET /api/push/vapid-public-key`

| Property | Value |
|---|---|
| Auth | None |
| Success | 200 `{ success: true, data: { publicKey: string } }` |
| Errors | 500 |

**Key:** VAPID public key for browser push subscription.

---

### 2.2 `POST /api/push/subscribe`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ endpoint: string, keys: { p256dh: string, auth: string } }` |
| Success | 201 `{ success: true, data: PushSubscription }` |
| Errors | 401, 400, 500 |

**Storage:** `push_subscriptions` table (user_id + endpoint + keys).

---

### 2.3 `POST /api/push/unsubscribe`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ endpoint: string }` |
| Success | 200 `{ success: true }` |
| Errors | 401, 404, 500 |

---

## 3. Translation (`/api/translate`)

### 3.1 `GET /api/translate/languages`

| Property | Value |
|---|---|
| Auth | None |
| Success | 200 `{ success: true, data: { languages: { code: string, name: string }[] } }` |
| Errors | 500 |

**Returns:** Supported languages for i18n dynamic backend.

---

### 3.2 `GET /api/translate/:languageCode`

| Property | Value |
|---|---|
| Auth | None |
| Path params | `languageCode` (e.g. `es`, `fr-FR`) |
| Success | 200 `{ success: true, data: { translations: Record<string, string> } }` |
| Errors | 404, 500 |

**Source:** `translation_cache` table (populated by client requests).

---

## 4. Waitlist (`/api/waitlist`)

### 4.1 `POST /api/waitlist`

| Property | Value |
|---|---|
| Auth | None |
| Rate limit | Custom `waitlistLimiter` |
| Request body | `{ email: string, name?: string, company?: string, role?: string }` |
| Success | 201 `{ success: true, message: "Joined waitlist" }` |
| Errors | 400 (validation), 409 (exists), 429, 500 |

**Storage:** `waitlist` table.

---

## 5. Subscriptions (`/api/subscriptions`)

### 5.1 `GET /api/subscriptions/:orgId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, data: Subscription }` |
| Errors | 401, 403, 404, 500 |

**Response (`Subscription`):**
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "tier": "'free'|'pro'|'enterprise'",
  "status": "'trialing'|'active'|'past_due'|'paused'|'canceled'|'unpaid'",
  "current_period_start": "ISO8601|null",
  "current_period_end": "ISO8601|null",
  "cancel_at_period_end": "boolean",
  "max_members": "number|null",
  "ai_reports_enabled": "boolean",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

**Note:** No payment provider fields. Tier resolution in `subscriptionService.getOrgTier`.

---

## 6. Reports (`/api/reports`)

### 6.1 `POST /api/reports/:orgId/generate`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` + `requireTier('enterprise')` |
| Path params | `orgId` (uuid) |
| Request body | `{ reportType: "'self'|'individual'|'team'|'organization'", targetUserId?: string, targetTeamId?: string, periodStart: "YYYY-MM-DD", periodEnd: "YYYY-MM-DD" }` |
| Success | 202 `{ success: true, data: { reportId: uuid, status: "generating" } }` |
| Errors | 401, 403 (not enterprise), 400, 500 |

**Async:** Returns immediately; generation runs in background.

---

### 6.2 `GET /api/reports/:orgId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` + `requireTier('enterprise')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, data: PerformanceReport[] }` |
| Errors | 401, 403, 500 |

---

### 6.3 `GET /api/reports/:orgId/:reportId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` + `requireTier('enterprise')` |
| Path params | `orgId`, `reportId` (uuid) |
| Success | 200 `{ success: true, data: PerformanceReport }` |
| Errors | 401, 403, 404, 500 |

**Response (`PerformanceReport`):**
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "report_type": "'self'|'individual'|'team'|'organization'",
  "target_user_id": "uuid|null",
  "target_team_id": "uuid|null",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "generated_by": "uuid",
  "report_content": "object",
  "report_markdown": "string|null",
  "ai_model": "string|null",
  "token_usage": "number|null",
  "generation_time_ms": "number|null",
  "status": "'generating'|'completed'|'failed'|'expired'",
  "error_message": "string|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

---

## 7. Channel Preferences (`/api/channel-preferences`)

### 7.1 `GET /api/channel-preferences/:orgId/mine`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, data: ChannelPreference[] }` |
| Errors | 401, 403, 500 |

---

### 7.2 `PUT /api/channel-preferences/:orgId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` |
| Path params | `orgId` (uuid) |
| Request body | `{ provider: "'slack'|'github'|'jira'", channel_type: "'notification'|'sync'", channel_config: object, is_active?: boolean, team_id?: string|null }` |
| Success | 200 `{ success: true, data: ChannelPreference }` |
| Errors | 401, 403, 400, 500 |

**Upsert:** Creates or updates by `(org_id, user_id, team_id, provider, channel_type)`.

---

### 7.3 `DELETE /api/channel-preferences/:orgId/:prefId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('admin')` |
| Path params | `orgId`, `prefId` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 403, 404, 500 |

---

### 7.4 `GET /api/channel-preferences/:orgId/team-slack`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('admin')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, data: { channel_ids: string[] } }` |
| Errors | 401, 403, 500 |

---

### 7.5 `POST /api/channel-preferences/:orgId/team-slack`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('admin')` |
| Path params | `orgId` (uuid) |
| Request body | `{ team_id: string, channel_ids: string[] }` |
| Success | 201 `{ success: true, data: ChannelPreference }` |
| Errors | 401, 403, 400, 500 |

---

## Related documents

- [API overview](./api-overview.md)
- [AI Pulse architecture](../02-architecture/system-architecture.md#6-content-and-marketing)
- [Push notifications](../05-feature-flows/notifications-and-jobs.md)
- [Backend platform functions](../04-function-documentation/backend-ai-pulse-misc.md)

## Verification notes

All endpoints traced from `server/src/routes/aiPulse.ts`, `push.ts`, `translate.ts`, `waitlist.ts`, `subscriptions.ts`, `reports.ts`, `channelPreferences.ts` at commit `7567207`. Not verified at runtime: OG image generation, VAPID push delivery, report generation async completion, translation cache population.