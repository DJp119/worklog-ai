# Backend Functions: Platform & Miscellaneous (AI Pulse, Push, Translate, Waitlist, Feedback)

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `aiPulseRoutes.get('/articles')` | `routes/aiPulse.ts:70` | Route | No | A | Paginated articles (optionalAuth) |
| `aiPulseRoutes.get('/articles/:slug')` | `routes/aiPulse.ts:101` | Route | No | A | Single article + view count |
| `aiPulseRoutes.get('/impact-cards')` | `routes/aiPulse.ts:125` | Route | No | A | All impact cards |
| `aiPulseRoutes.get('/impact-cards/:industry')` | `routes/aiPulse.ts:162` | Route | No | A | Single impact card |
| `aiPulseRoutes.get('/bookmarks')` | `routes/aiPulse.ts:197` | Route | No | A | User's bookmarks (requireAuth) |
| `aiPulseRoutes.post('/bookmarks')` | `routes/aiPulse.ts:220` | Route | No | A | Create bookmark |
| `aiPulseRoutes.delete('/bookmarks/:id')` | `routes/aiPulse.ts:256` | Route | No | A | Delete bookmark |
| `aiPulseRoutes.post('/admin/articles')` | `routes/aiPulse.ts:285` | Route | No | A | Admin create article |
| `aiPulseRoutes.post('/admin/impact-cards')` | `routes/aiPulse.ts:335` | Route | No | A | Admin create impact card |
| `aiPulseRoutes.get('/for-you')` | `routes/aiPulse.ts:387` | Route | No | A | Personalized feed (requireAuth) |
| `aiPulseRoutes.get('/og/article/:slug')` | `routes/aiPulse.ts:465` | Route | No | A | OG HTML |
| `aiPulseRoutes.get('/og/article/:slug.png')` | `routes/aiPulse.ts:517` | Route | No | A | OG PNG |
| `aiPulseRoutes.post('/admin/collect-news')` | `routes/aiPulse.ts:523` | Route | No | A | Trigger news collection |
| `pushRoutes.get('/vapid-public-key')` | `routes/push.ts:11` | Route | No | B | VAPID public key |
| `pushRoutes.post('/subscribe')` | `routes/push.ts:21` | Route | No | A | Save push subscription |
| `pushRoutes.post('/unsubscribe')` | `routes/push.ts:59` | Route | No | A | Remove push subscription |
| `translateRoutes.get('/languages')` | `routes/translate.ts:67` | Route | No | B | Supported languages |
| `translateRoutes.get('/:languageCode')` | `routes/translate.ts:71` | Route | No | B | Translation cache |
| `waitlistRoutes.post('/')` | `routes/waitlist.ts:25` | Route | No | A | Join waitlist (rate limited) |
| `feedbackRoutes.post('/')` | `routes/feedback.ts:11` | Route | No | A | Submit feedback |
| `feedbackRoutes.get('/')` | `routes/feedback.ts:79` | Route | No | A | List feedback |
| `newsService.collectNews` | `lib/newsService.ts` | Function | Yes | A | RSS → Mistral → articles/cards |
| `newsService.processArticle` | `lib/newsService.ts` | Function | Yes | B | Categorize + summarize |
| `newsService.categorizeArticle` | `lib/newsService.ts` | Function | Yes | B | Mistral categorize |
| `webPush.sendPushNotification` | `lib/webPush.ts` | Function | Yes | A | Send push to user's subscriptions |
| `webPush.getVapidKeys` | `lib/webPush.ts` | Function | Yes | B | VAPID keys |
| `email.sendEmail` | `lib/email.ts:88` | Function | Yes | A | Brevo send |
| `email.sendVerificationEmail` | `lib/email.ts` | Function | Yes | B | Signup verification |
| `email.sendPasswordResetEmail` | `lib/email.ts` | Function | Yes | B | Password reset |
| `email.sendWeeklyReminder` | `lib/email.ts` | Function | Yes | B | Weekly reminder |
| `email.sendWeeklyDigest` | `lib/email.ts` | Function | Yes | B | Weekly digest |
| `email.translateStatic` | `lib/email.ts:76` | Function | Yes | B | Google Translate memoized |

---

## 2. Tier A functions (detailed)

### `aiPulseRoutes.get('/articles')` — `server/src/routes/aiPulse.ts:70`

**Identity:** `aiPulseRoutes.get('/articles')` / `routes/aiPulse.ts:70` / Route handler / Not exported / async / A

**Purpose:** Paginated article listing with optional category filter.

**Technical:**
1. `optionalAuth` → may attach user
2. Query params: `category`, `search`, `page`, `limit`
3. `supabase.from('ai_articles').select('*').eq('category', category).order('published_at', { ascending: false }).range(from, to)`
4. Count query for total
5. Returns `{ articles, total, page, limit }`

---

### `aiPulseRoutes.get('/articles/:slug')` — `server/src/routes/aiPulse.ts:101`

**Identity:** `aiPulseRoutes.get('/articles/:slug')` / `routes/aiPulse.ts:101` / Route handler / Not exported / async / A

**Purpose:** Single article detail + view count increment.

**Technical:**
1. `optionalAuth`
2. `supabase.from('ai_articles').select('*').eq('slug', slug).single()`
3. If found: `supabase.from('ai_articles').update({ views_count: views_count + 1 }).eq('slug', slug)`
3. Returns article

---

### `aiPulseRoutes.post('/bookmarks')` — `server/src/routes/aiPulse.ts:220`

**Identity:** `aiPulseRoutes.post('/bookmarks')` / `routes/aiPulse.ts:220` / Route handler / Not exported / async / A

**Purpose:** Bookmark article or impact card.

**Technical:**
1. `requireAuth` → `req.userId`
2. Validates: exactly one of `article_id` or `impact_card_id`
3. `supabase.from('user_bookmarks').insert({ user_id: req.userId, article_id, impact_card_id }).select().single()`
4. Returns bookmark

---

### `aiPulseRoutes.get('/og/article/:slug.png')` — `server/src/routes/aiPulse.ts:517`

**Identity:** `aiPulseRoutes.get('/og/article/:slug.png')` / `routes/aiPulse.ts:517` / Route handler / Not exported / async / A

**Purpose:** Generate OG image PNG for social sharing.

**Technical:**
1. Fetches article by slug
2. Generates PNG via server-side canvas/HTML-to-image (implementation in route)
3. Sets `Content-Type: image/png`
4. Returns binary PNG

---

### `newsService.collectNews` — `server/src/lib/newsService.ts`

**Identity:** `collectNews` / `lib/newsService.ts` / Function / Exported / async / A

**Purpose:** Daily news collection: RSS fetch → Mistral categorize → insert articles + impact cards.

**Technical:**
1. Fetches RSS feeds (configured in code)
2. For each article: `categorizeArticle` (Mistral) → `INSERT ai_articles` (dedup by slug)
3. Aggregates by industry → `processArticle` → `INSERT/UPDATE ai_impact_cards`
4. Cleans up old articles (>90 days)

**Used by:** `newsCollectionJob.ts`, `aiPulseRoutes.post('/admin/collect-news')`

---

### `webPush.sendPushNotification` — `server/src/lib/webPush.ts`

**Identity:** `sendPushNotification` / `lib/webPush.ts` / Function / Exported / async / A

**Purpose:** Send web push to all user's subscriptions.

**Technical:**
1. `getVapidKeys()` → VAPID keys
2. `supabase.from('push_subscriptions').select('*').eq('user_id', userId)`
3. For each subscription: `web-push.sendNotification(subscription, JSON.stringify(payload), { vapidDetails })`
3. Handles expired subscriptions (could auto-delete)

**Used by:** Notification jobs, goal reminders

---

### `email.sendEmail` — `server/src/lib/email.ts:88`

**Identity:** `sendEmail` / `lib/email.ts:88` / Function / Exported / async / A

**Purpose:** Send email via Brevo API.

**Technical:**
1. `fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': BREVO_API_KEY }, body: { sender, to, subject, htmlContent, textContent } })`
2. Returns `{ success, messageId }`
3. On failure: logs warning, returns `{ success: false }`

**Used by:** All email sending (verification, reset, reminders, digests, notifications)

---

## 2. Tier B functions (compact)

| Function | File:line | Purpose |
|---|---|---|
| `aiPulseRoutes.get('/impact-cards')` | `aiPulse.ts:125` | All impact cards |
| `aiPulseRoutes.get('/impact-cards/:industry')` | `aiPulse.ts:162` | Single impact card |
| `aiPulseRoutes.get('/bookmarks')` | `aiPulse.ts:197` | User's bookmarks |
| `aiPulseRoutes.delete('/bookmarks/:id')` | `aiPulse.ts:256` | Delete bookmark |
| `aiPulseRoutes.post('/admin/articles')` | `aiPulse.ts:285` | Admin create article |
| `aiPulseRoutes.post('/admin/impact-cards')` | `aiPulse.ts:335` | Admin create impact card |
| `aiPulseRoutes.get('/for-you')` | `aiPulse.ts:387` | Personalized feed |
| `aiPulseRoutes.get('/og/article/:slug')` | `aiPulse.ts:465` | OG HTML |
| `aiPulseRoutes.post('/admin/collect-news')` | `aiPulse.ts:523` | Trigger news collection |
| `pushRoutes.get('/vapid-public-key')` | `push.ts:11` | VAPID public key |
| `pushRoutes.post('/subscribe')` | `push.ts:21` | Save push subscription |
| `pushRoutes.post('/unsubscribe')` | `push.ts:59` | Remove push subscription |
| `translateRoutes.get('/languages')` | `translate.ts:67` | Supported languages |
| `translateRoutes.get('/:languageCode')` | `translate.ts:71` | Translation cache |
| `waitlistRoutes.post('/')` | `waitlist.ts:25` | Join waitlist (rate limited) |
| `feedbackRoutes.post('/')` | `feedback.ts:11` | Submit feedback |
| `feedbackRoutes.get('/')` | `feedback.ts:79` | List feedback |
| `newsService.processArticle` | `newsService.ts` | Categorize + summarize |
| `newsService.categorizeArticle` | `newsService.ts` | Mistral categorize |
| `webPush.getVapidKeys` | `webPush.ts` | VAPID keys |
| `email.sendVerificationEmail` | `email.ts` | Signup verification |
| `email.sendPasswordResetEmail` | `email.ts` | Password reset |
| `email.sendWeeklyReminder` | `email.ts` | Weekly reminder |
| `email.sendWeeklyDigest` | `email.ts` | Weekly digest |
| `email.translateStatic` | `email.ts:76` | Google Translate memoized |

---

## Related documents

- [Platform endpoints](../06-api-reference/endpoint-reference-platform-misc.md)
- [AI Pulse flow](../05-feature-flows/ai-pulse.md)
- [Notifications & jobs flow](../05-feature-flows/notifications-and-jobs.md)
- [External services](../09-integrations/external-services.md)

## Verification notes

All functions traced from source at commit `7567207`. OG image generation, push delivery, Brevo delivery, Google Translate not verified at runtime.