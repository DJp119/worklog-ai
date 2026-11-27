# Backend Functions: Core AI (Entries, Appraisals, Summaries, Chat, Feedback)

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `entriesRoutes.get('/')` | `routes/entries.ts:14` | Route | No | A | List user's work log entries |
| `entriesRoutes.get('/:id')` | `routes/entries.ts:43` | Route | No | A | Get single entry |
| `entriesRoutes.post('/')` | `routes/entries.ts:74` | Route | No | A | Create entry |
| `entriesRoutes.put('/:id')` | `routes/entries.ts:166` | Route | No | A | Update entry |
| `entriesRoutes.delete('/:id')` | `routes/entries.ts:215` | Route | No | A | Delete entry |
| `appraisalRoutes.post('/playground-generate')` | `routes/appraisal.ts:29` | Route | No | A | Public appraisal (rate limited) |
| `appraisalRoutes.post('/generate')` | `routes/appraisal.ts:111` | Route | No | A | Generate AI appraisal |
| `appraisalRoutes.get('/history')` | `routes/appraisal.ts:304` | Route | No | A | List user's appraisals |
| `appraisalRoutes.get('/:id')` | `routes/appraisal.ts:333` | Route | No | A | Get single appraisal |
| `summariesRoutes.get('/')` | `routes/summaries.ts:12` | Route | No | A | List monthly summaries |
| `summariesRoutes.post('/generate')` | `routes/summaries.ts:42` | Route | No | A | Generate monthly summary |
| `chatRoutes.get('/sessions')` | `routes/chat.ts:19` | Route | No | A | List chat sessions |
| `chatRoutes.post('/sessions')` | `routes/chat.ts:48` | Route | No | A | Create chat session |
| `chatRoutes.delete('/sessions/:id')` | `routes/chat.ts:90` | Route | No | A | Delete chat session |
| `chatRoutes.get('/sessions/:id/messages')` | `routes/chat.ts:120` | Route | No | A | Get session messages |
| `chatRoutes.post('/sessions/:id/messages')` | `routes/chat.ts:167` | Route | No | A | Send message (SSE) |
| `feedbackRoutes.post('/')` | `routes/feedback.ts:11` | Route | No | A | Submit feedback |
| `feedbackRoutes.get('/')` | `routes/feedback.ts:79` | Route | No | A | List feedback |
| `summaryService.generateMonthlySummary` | `lib/summaryService.ts` | Function | Yes | A | Generate AI monthly summary |
| `summaryService.invalidateMonthlySummary` | `lib/summaryService.ts` | Function | Yes | B | Delete summary for month |
| `chatService.sendMessage` | `lib/chatService.ts` | Function | Yes | A | SSE streaming chat |
| `chatService.createChatSession` | `lib/chatService.ts` | Function | Yes | B | Create session |
| `chatService.getChatHistory` | `lib/chatService.ts` | Function | Yes | B | Fetch messages |
| `aiSummaryService.buildAppraisalPrompt` | `lib/aiSummaryService.ts` | Function | Yes | A | Build appraisal prompt |
| `aiSummaryService.buildSummaryPrompt` | `lib/aiSummaryService.ts` | Function | Yes | B | Build summary prompt |
| `aiSummaryService.buildReportPrompt` | `lib/aiSummaryService.ts` | Function | Yes | B | Build report prompt |
| `mistral` | `lib/mistral.ts:15` | Instance | Yes | B | Mistral client |
| `openRouter` | `lib/openRouter.ts` | Instance | Yes | B | OpenRouter client |

---

## 2. Tier A functions (detailed)

### `entriesRoutes.post('/')` — `server/src/routes/entries.ts:74`

**Identity:** `entriesRoutes.post('/')` / `routes/entries.ts:74` / Route handler / Not exported / async / A

**Purpose:** Create a new weekly work log entry.

**ELI5:** Saves your weekly diary entry — but only one per week.

**Technical:**
1. `requireAuth` → `req.userId`
2. Validates required fields: `week_start_date`, `accomplishments`, `challenges`, `learnings`, `goals_next_week`
3. `supabase.from('work_log_entries').insert({ user_id: userId, ...body }).select().single()`
4. On duplicate `(user_id, week_start_date)` → 409
5. `summaryService.invalidateMonthlySummary(userId, month)` → deletes `monthly_summaries` for that month
6. Returns 201 with created entry

**Inputs:** `CreateWorkLogRequest` body

**Returns:** 201 `{ success: true, data: WorkLogEntry }`

**Errors:** 400 (validation), 409 (duplicate week), 500

**Calls:** `summaryService.invalidateMonthlySummary`, `supabase.from('work_log_entries')`

---

### `appraisalRoutes.post('/generate')` — `server/src/routes/appraisal.ts:111`

**Identity:** `appraisalRoutes.post('/generate')` / `routes/appraisal.ts:111` / Route handler / Not exported / async / A

**Purpose:** Generate AI self-appraisal from user's entries + criteria.

**ELI5:** Feeds your diary + criteria to an AI ghostwriter → returns polished appraisal.

**Technical:**
1. `requireAuth` → `req.userId`
2. Validates: `period_start`, `period_end`, `criteria_text`
2. Fetches entries: `supabase.from('work_log_entries').select('*').eq('user_id', userId).gte('week_start_date', periodStart).lte('week_start_date', periodEnd)`
3. If no entries → 400
4. `buildAppraisalPrompt(entries, criteria, companyGoals, values)` → `lib/aiSummaryService.ts`
5. Calls Mistral (primary) or OpenRouter (fallback):
   - `mistral.chat.complete({ model: 'mistral-large-latest', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] })`
6. Extracts `generatedText`, `wordCount`
7. Saves: `supabase.from('generated_appraisals').insert({ user_id, period_start, period_end, generated_text, word_count }).select().single()`
8. Returns 200 with appraisal

**Inputs:** `{ period_start, period_end, criteria_text, company_goals?, values? }`

**Returns:** 200 `{ success: true, data: GeneratedAppraisal }`

**Errors:** 400 (validation, no entries), 500 (AI failure)

**Calls:** `buildAppraisalPrompt`, `mistral`/`openRouter`, `supabase.from('generated_appraisals')`

---

### `summaryService.generateMonthlySummary` — `server/src/lib/summaryService.ts`

**Identity:** `generateMonthlySummary` / `lib/summaryService.ts` / Function / Exported / async / A

**Purpose:** Generate AI monthly summary from user's entries.

**Technical:**
1. Fetches entries for month
2. If no entries → returns null
3. `buildSummaryPrompt(entries)` → `lib/aiSummaryService.ts`
6. Calls Mistral/OpenRouter with prompt
7. Saves to `monthly_summaries` with `source_entry_ids`
8. Returns `{ summaryText, wordCount, entryCount }`

**Used by:** `summariesRoutes.post('/generate')`, `monthlySummaryJob.ts`

---

### `chatRoutes.post('/sessions/:id/messages')` — `server/src/routes/chat.ts:167`

**Identity:** `chatRoutes.post('/sessions/:id/messages')` / `routes/chat.ts:167` / Route handler / Not exported / async / A

**Purpose:** Send message, stream AI response via SSE.

**Technical:**
1. `requireAuth` → verify session ownership
2. Saves user message to `chat_messages`
3. Calls `chatService.sendMessage(sessionId, content, userId)` → `lib/chatService.ts`
4. `chatService.sendMessage`:
   - Fetches session → gets period
   - Fetches entries in period
   - Builds context prompt
   - Streams from Mistral/OpenRouter
   - Yields SSE tokens: `{ type: 'token', content }` → `{ type: 'done' }`
5. On done: saves assistant message to `chat_messages`
6. Returns SSE stream

**Returns:** `text/event-stream`

---

### `chatService.sendMessage` — `server/src/lib/chatService.ts`

**Identity:** `sendMessage` / `lib/chatService.ts` / Function / Exported / async / A

**Purpose:** Core chat logic: context building + AI streaming + persistence.

**Technical:**
1. Validates session belongs to user
2. Fetches `work_log_entries` for session period
3. Builds system prompt: "You are a helpful assistant. Use the user's work log entries to answer questions."
4. Builds user prompt: entries + conversation history + new message
5. Streams from `mistral.chat.stream()` or `openRouter`
6. On completion: saves assistant message to `chat_messages`

---

## 3. Tier B functions (compact)

| Function | File:line | Purpose |
|---|---|---|
| `entriesRoutes.get('/')` | `routes/entries.ts:14` | List entries (desc by week) |
| `entriesRoutes.get('/:id')` | `routes/entries.ts:43` | Single entry |
| `entriesRoutes.put('/:id')` | `routes/entries.ts:166` | Update entry + invalidate summary |
| `entriesRoutes.delete('/:id')` | `routes/entries.ts:215` | Delete entry + invalidate summary |
| `appraisalRoutes.post('/playground-generate')` | `routes/appraisal.ts:29` | Public appraisal (rate limited) |
| `appraisalRoutes.get('/history')` | `routes/appraisal.ts:304` | List appraisals |
| `appraisalRoutes.get('/:id')` | `routes/appraisal.ts:333` | Single appraisal |
| `summariesRoutes.get('/')` | `routes/summaries.ts:12` | List summaries |
| `summariesRoutes.post('/generate')` | `routes/summaries.ts:42` | Trigger summary generation |
| `chatRoutes.get('/sessions')` | `routes/chat.ts:19` | List sessions |
| `chatRoutes.post('/sessions')` | `routes/chat.ts:48` | Create session |
| `chatRoutes.delete('/sessions/:id')` | `routes/chat.ts:90` | Delete session + messages |
| `chatRoutes.get('/sessions/:id/messages')` | `routes/chat.ts:120` | Get messages |
| `feedbackRoutes.post('/')` | `routes/feedback.ts:11` | Submit feedback |
| `feedbackRoutes.get('/')` | `routes/feedback.ts:79` | List feedback |
| `summaryService.invalidateMonthlySummary` | `lib/summaryService.ts` | Delete summary for month |
| `chatService.createChatSession` | `lib/chatService.ts` | Create session |
| `chatService.getChatHistory` | `lib/chatService.ts` | Fetch messages |
| `aiSummaryService.buildAppraisalPrompt` | `lib/aiSummaryService.ts` | Build appraisal prompt |
| `aiSummaryService.buildSummaryPrompt` | `lib/aiSummaryService.ts` | Build summary prompt |
| `aiSummaryService.buildReportPrompt` | `lib/aiSummaryService.ts` | Build report prompt |
| `mistral` | `lib/mistral.ts:15` | `new Mistral({ apiKey: MISTRAL_API_KEY })` |
| `openRouter` | `lib/openRouter.ts` | Custom fetch to OpenRouter API |

---

## Related documents

- [Core AI endpoints](../06-api-reference/endpoint-reference-core-ai.md)
- [Appraisal flow](../05-feature-flows/appraisal-generation.md)
- [Chat flow](../05-feature-flows/ai-chat.md)
- [Weekly logging flow](../05-feature-flows/weekly-logging.md)
- [Dashboard flow](../05-feature-flows/dashboard-and-summaries.md)

## Verification notes

All functions traced from source at commit `7567207`. SSE streaming and AI fallback behavior not verified at runtime.