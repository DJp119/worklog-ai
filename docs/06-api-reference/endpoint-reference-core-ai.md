# API Reference: Core & AI

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Work Log Entries (`/api/entries`)

### 1.1 `GET /api/entries`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Query params | None |
| Success | 200 `{ success: true, data: WorkLogEntry[] }` |
| Errors | 401, 500 |

**Response (`WorkLogEntry[]`):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "week_start_date": "YYYY-MM-DD",
    "accomplishments": "string",
    "challenges": "string",
    "learnings": "string",
    "goals_next_week": "string",
    "hours_logged": "number|null",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
]
```

**Order:** `week_start_date DESC`

---

### 1.2 `GET /api/entries/:id`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Success | 200 `{ success: true, data: WorkLogEntry }` |
| Errors | 401, 404 (not found or not owned), 500 |

---

### 1.3 `POST /api/entries`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ week_start_date: "YYYY-MM-DD", accomplishments: string, challenges: string, learnings: string, goals_next_week: string, hours_logged?: number }` |
| Validation | All fields required (except `hours_logged`), unique `(user_id, week_start_date)` |
| Success | 201 `{ success: true, data: WorkLogEntry }` |
| Errors | 400 (validation), 409 (duplicate week), 500 |

**Side effect:** Invalidates monthly summary for the month (`summaryService.invalidateMonthlySummary`).

---

### 1.4 `PUT /api/entries/:id`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Request body | Partial create body |
| Success | 200 `{ success: true, data: WorkLogEntry }` |
| Errors | 401, 404, 500 |

**Ownership:** `.eq('user_id', req.userId)` enforced.

**Side effect:** Invalidates monthly summary.

---

### 1.5 `DELETE /api/entries/:id`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 404, 500 |

**Side effect:** Invalidates monthly summary.

---

## 2. Appraisals (`/api/appraisal`)

### 2.1 `POST /api/appraisal/playground-generate`

| Property | Value |
|---|---|
| Auth | None |
| Rate limit | Custom `playgroundLimiter` |
| Request body | `{ period_start, period_end, criteria_text, company_goals?, values? }` |
| Success | 200 `{ success: true, data: { generated_text, word_count } }` |
| Errors | 400 (validation), 429, 500 (AI failure) |

**Public playground:** No auth, uses entries from a demo user or empty context.

---

### 2.2 `POST /api/appraisal/generate`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ period_start: "YYYY-MM-DD", period_end: "YYYY-MM-DD", criteria_text: string, company_goals?: string, values?: string }` |
| Success | 200 `{ success: true, data: GeneratedAppraisal }` |
| Errors | 400 (validation), 401, 500 (AI failure) |

**Flow:**
1. Fetch user's `work_log_entries` in period
2. Build prompt with entries + criteria + company_goals + values
3. Call Mistral (`mistral-large-latest`) or fallback provider
4. Save to `generated_appraisals` (with `word_count`)
5. Return saved appraisal

**Response (`GeneratedAppraisal`):**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "criteria_id": "uuid|null",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "generated_text": "string",
  "word_count": "number",
  "created_at": "ISO8601"
}
```

---

### 2.3 `GET /api/appraisal/history`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: GeneratedAppraisal[] }` |
| Errors | 401, 500 |

**Order:** `created_at DESC`

---

### 2.4 `GET /api/appraisal/:id`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Success | 200 `{ success: true, data: GeneratedAppraisal }` |
| Errors | 401, 404, 500 |

---

## 3. Monthly Summaries (`/api/summaries`)

### 3.1 `GET /api/summaries`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: MonthlySummary[] }` |
| Errors | 401, 500 |

**Response (`MonthlySummary[]`):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "month_year": "YYYY-MM",
    "summary_text": "string",
    "entry_count": "number",
    "word_count": "number",
    "source_entry_ids": "uuid[]",
    "generated_at": "ISO8601"
  }
]
```

---

### 3.2 `POST /api/summaries/generate`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ month_year: "YYYY-MM" }` (optional, defaults to previous month) |
| Success | 200 `{ success: true, data: MonthlySummary }` |
| Errors | 401, 400 (no entries in month), 500 (AI failure) |

**Flow:**
1. Fetch entries for month
2. Call `summaryService.generateMonthlySummary` (Mistral/OpenRouter)
3. Save to `monthly_summaries`
4. Return saved summary

---

## 4. Chat (`/api/chat`)

### 4.1 `GET /api/chat/sessions`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: ChatSession[] }` |
| Errors | 401, 500 |

**Response (`ChatSession[]`):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "title": "string",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
]
```

**Order:** `updated_at DESC`

---

### 4.2 `POST /api/chat/sessions`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ period_start: "YYYY-MM-DD", period_end: "YYYY-MM-DD" }` |
| Success | 201 `{ success: true, data: ChatSession }` |
| Errors | 401, 400 (validation), 500 |

---

### 4.3 `DELETE /api/chat/sessions/:id`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Success | 200 `{ success: true }` |
| Errors | 401, 404, 500 |

**Cascades:** Deletes `chat_messages` for session.

---

### 4.4 `GET /api/chat/sessions/:id/messages`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Success | 200 `{ success: true, data: ChatMessage[] }` |
| Errors | 401, 404, 500 |

**Response (`ChatMessage[]`):**
```json
[
  {
    "id": "uuid",
    "session_id": "uuid",
    "user_id": "uuid",
    "role": "'user' | 'assistant'",
    "content": "string",
    "created_at": "ISO8601"
  }
]
```

**Order:** `created_at ASC`

---

### 4.5 `POST /api/chat/sessions/:id/messages`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `id` (uuid) |
| Request body | `{ content: string }` |
| Response | **Server-Sent Events (SSE) stream** |
| Errors | 401, 404, 500 |

**SSE format:**
```
data: {"type":"token","content":"..."}

data: {"type":"done"}

data: {"type":"error","message":"..."}
```

**Flow:**
1. Save user message to `chat_messages`
2. Fetch user's entries in session period
3. Build context prompt
4. Stream from AI (Mistral/OpenRouter) via `chatService.sendMessage`
5. Save assistant response to `chat_messages`

---

## 5. Feedback (`/api/feedback`)

### 5.1 `POST /api/feedback`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ category: string, message: string }` |
| Success | 201 `{ success: true, data: Feedback }` |
| Errors | 401, 400 (validation), 500 |

---

### 5.2 `GET /api/feedback`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: Feedback[] }` |
| Errors | 401, 500 |

**Response (`Feedback[]`):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "category": "string",
    "message": "string",
    "created_at": "ISO8601"
  }
]
```

**Order:** `created_at DESC`

---

## Related documents

- [API overview](./api-overview.md)
- [Auth architecture](../02-architecture/auth-and-authorization.md)
- [Backend core AI functions](../04-function-documentation/backend-core-ai.md)

## Verification notes

All endpoints traced from `server/src/routes/entries.ts`, `appraisal.ts`, `summaries.ts`, `chat.ts`, `feedback.ts` at commit `7567207`. SSE behavior from `chatService.ts`. Not verified at runtime: AI provider responses, streaming reliability.