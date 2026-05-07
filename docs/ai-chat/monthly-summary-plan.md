# Implementation Plan: Pre-Computed Monthly Summaries + AI Chat

## The Approach

Instead of compressing work logs on-the-fly, we **pre-compute a monthly summary at the end of each month** and store it in a `monthly_summaries` table. When the user asks an appraisal question for any range (3 months, 6 months, 1 year), we simply **pick the relevant monthly summaries** and pass them to Claude.

---

## How It Works End-to-End

```
USER'S WORK LOGS (raw weekly entries)
──────────────────────────────────────
Jan W1 │ Jan W2 │ Jan W3 │ Jan W4 │ Feb W1 │ Feb W2 │ ... │ Dec W4
──────────────────────────────────────
         │                    │                         │
         ▼                    ▼                         ▼
   ┌───────────┐       ┌───────────┐             ┌───────────┐
   │ Jan       │       │ Feb       │             │ Dec       │
   │ Summary   │       │ Summary   │     ...     │ Summary   │
   │ (~300     │       │ (~300     │             │ (~300     │
   │  words)   │       │  words)   │             │  words)   │
   └───────────┘       └───────────┘             └───────────┘
         │                    │                         │
         └────────────────────┼─────────────────────────┘
                              │
                    User picks "1 Year"
                              │
                              ▼
                    ┌───────────────────┐
                    │ Stitch 12 monthly │
                    │ summaries together│
                    │ (~3,600 words)    │
                    └────────┬──────────┘
                             │
                             ▼
                    ┌───────────────────┐
                    │ System Prompt +   │
                    │ Stitched summary +│
                    │ User's question   │──▶ Claude API ──▶ Answer
                    └───────────────────┘
```

---

## Part A: Monthly Summary Generation

### A1. When Is a Monthly Summary Created?

Two triggers:

| Trigger | When | How |
|---------|------|-----|
| **Automatic (cron)** | 1st of every month at 2 AM | Background job scans all users, generates summary for the previous month |
| **On-demand** | When user creates/edits/deletes a work log entry for a past month | Regenerate that month's summary |

### A2. What Goes INTO the Summary

For a given month, we fetch all `work_log_entries` where `week_start_date` falls in that month:

```typescript
// Example: Generate summary for January 2025
const { data: logs } = await supabase
  .from('work_log_entries')
  .select('*')
  .eq('user_id', userId)
  .gte('week_start_date', '2025-01-01')
  .lt('week_start_date', '2025-02-01')
  .order('week_start_date', { ascending: true });
```

Typically 4-5 entries per month → ~2,000 chars raw input.

### A3. The AI Prompt for Summary Generation

```typescript
const summaryPrompt = `Summarize this month's work logs into a structured monthly summary.

RULES:
- Preserve ALL project names, technologies, tools, and specific metrics
- Group items into: Key Accomplishments, Challenges Faced, Skills Developed
- Keep specific dates for milestones
- Use bullet points, be factual, no fluff
- Output should be 200-350 words

WORK LOGS FOR ${monthLabel}:
${formattedLogs}

Generate the monthly summary:`;
```

### A4. What the Output Looks Like

```
## January 2025

**Key Accomplishments:**
• Led sprint planning for auth module redesign (Jan 6-10)
• Shipped JWT token rotation feature, reducing security incidents by 40%
• Completed API documentation for 12 endpoints
• Mentored 2 junior devs on TypeScript patterns

**Challenges Faced:**
• CI pipeline instability — resolved by migrating to GitHub Actions
• Third-party API rate limits causing test failures

**Skills Developed:**
• Advanced rate limiting patterns (token bucket algorithm)
• Kubernetes pod scaling for staging environment
```

~250 words = ~330 tokens per month.
For 12 months: ~3,000 words = ~4,000 tokens. **Very manageable.**

### A5. Where It's Stored

```sql
CREATE TABLE monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year DATE NOT NULL,          -- first day of the month: '2025-01-01'
    summary_text TEXT NOT NULL,         -- the AI-generated summary
    entry_count INTEGER NOT NULL,       -- how many work logs went into this
    word_count INTEGER NOT NULL,
    source_entry_ids UUID[] NOT NULL,   -- which work_log_entries were used
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_year)        -- one summary per user per month
);

CREATE INDEX idx_monthly_summaries_user_month 
  ON monthly_summaries(user_id, month_year);
```

**Key design choices:**
- `source_entry_ids` — tracks exactly which entries were summarized, so we know when to regenerate
- `UNIQUE(user_id, month_year)` — exactly one summary per user per month, upsert-friendly
- `entry_count` — quick check: if 0 entries, no summary exists

---

## Part B: Invalidation (When Logs Change)

### B1. When Should a Summary Be Regenerated?

| User Action | What Happens |
|---|---|
| **Creates** a new entry for Jan 2025 | Regenerate Jan 2025 summary |
| **Edits** an existing Jan 2025 entry | Regenerate Jan 2025 summary |
| **Deletes** a Jan 2025 entry | Regenerate Jan 2025 summary (or delete summary if 0 entries left) |

### B2. How It's Triggered

In `entries.ts` route handlers (POST, PUT, DELETE), after the DB operation succeeds, we call:

```typescript
// After creating/updating/deleting an entry:
await invalidateMonthlySummary(userId, weekStartDate);
```

```typescript
async function invalidateMonthlySummary(userId: string, weekStartDate: string) {
  const date = new Date(weekStartDate);
  const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  
  // Option A: Delete the summary — it will be regenerated on next access
  await supabase
    .from('monthly_summaries')
    .delete()
    .eq('user_id', userId)
    .eq('month_year', monthYear);
  
  // Option B: Regenerate immediately (better UX, slightly slower write)
  // await generateMonthlySummary(userId, monthYear);
}
```

**Recommended: Option A (lazy regeneration).** Delete the stale summary and regenerate it only when the user starts a chat session that needs that month. This avoids unnecessary AI calls when users edit entries repeatedly.

---

## Part C: Chat with Context (Using Monthly Summaries)

### C1. User Starts a New Chat Session

```
User selects: Period = "Last 1 Year" (Jan 2025 – Dec 2025)
User types: "How did I demonstrate leadership this year?"
```

### C2. Backend Fetches Monthly Summaries for the Range

```typescript
// Fetch all monthly summaries for the selected range
const { data: summaries } = await supabase
  .from('monthly_summaries')
  .select('*')
  .eq('user_id', userId)
  .gte('month_year', '2025-01-01')   // period_start
  .lte('month_year', '2025-12-01')   // period_end
  .order('month_year', { ascending: true });
```

### C3. Handle Missing Summaries (Lazy Generation)

Some months might not have a summary yet (new entries, or summary was invalidated):

```typescript
async function getSummariesForRange(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<MonthlySummary[]> {
  // 1. Get all months in range
  const months = getMonthsBetween(periodStart, periodEnd);
  
  // 2. Fetch existing summaries
  const { data: existing } = await supabase
    .from('monthly_summaries')
    .select('*')
    .eq('user_id', userId)
    .in('month_year', months);
  
  // 3. Find months that have work logs but no summary
  const existingMonths = new Set(existing?.map(s => s.month_year) || []);
  const missingMonths = months.filter(m => !existingMonths.has(m));
  
  // 4. Generate missing summaries on-the-fly
  const newSummaries: MonthlySummary[] = [];
  for (const month of missingMonths) {
    const summary = await generateMonthlySummary(userId, month);
    if (summary) newSummaries.push(summary);
  }
  
  // 5. Return all summaries sorted by month
  return [...(existing || []), ...newSummaries]
    .sort((a, b) => a.month_year.localeCompare(b.month_year));
}
```

### C4. Stitch Summaries into Context

```typescript
function stitchSummaries(summaries: MonthlySummary[]): string {
  if (summaries.length === 0) return 'No work data available for this period.';
  
  return summaries.map(s => {
    const date = new Date(s.month_year);
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return `### ${label}\n${s.summary_text}`;
  }).join('\n\n');
}

// Output:
// ### January 2025
// **Key Accomplishments:** ...
// 
// ### February 2025
// **Key Accomplishments:** ...
// ... (up to 12 months)
```

### C5. Build System Prompt with Stitched Summaries

```typescript
function buildSystemPrompt(
  stitchedSummaries: string,
  userProfile: UserProfile
): string {
  return `You are an AI appraisal assistant for ${userProfile.name || 'a professional'}.
Job Title: ${userProfile.job_title || 'Not specified'}
Company: ${userProfile.company_name || 'Not specified'}

YOUR DATA SOURCE — Monthly work summaries:
${stitchedSummaries}

RULES:
- Answer appraisal questions using ONLY the work data above
- Write in first person ("I") as if the user is speaking
- Be specific — cite project names, metrics, dates from the summaries
- If data is insufficient for a question, say so honestly
- Keep responses focused and professional`;
}
```

### C6. Token Budget (with monthly summaries)

```
┌─────────────────────────────────────────────────┐
│          FOR A 1-YEAR CHAT SESSION              │
│                                                  │
│  System instructions ......... ~500 tokens       │
│  12 monthly summaries ........ ~4,000 tokens     │
│  Conversation history ........ ~4,000 tokens     │
│  New user message ............ ~200 tokens       │
│  Response buffer ............. ~2,048 tokens     │
│  ─────────────────────────────────────           │
│  TOTAL ....................... ~10,748 tokens     │
│                                                  │
│  Claude Sonnet limit: 200,000 tokens ✅          │
│  Cost per message: ~$0.03                        │
└─────────────────────────────────────────────────┘
```

---

## Part D: Conversation Memory (Follow-Up Prompts)

### D1. How Messages Are Stored

```sql
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
```

### D2. Message Flow (First Message)

```
Claude receives:
  system: "You are an AI assistant... MONTHLY SUMMARIES: [Jan] [Feb] ... [Dec]"
  messages: [
    { role: "user", content: "How did I show leadership?" }
  ]

Claude responds → both messages saved to chat_messages
```

### D3. Message Flow (Follow-Up)

```
Claude receives:
  system: "You are an AI assistant... MONTHLY SUMMARIES: [same as before]"
  messages: [
    { role: "user",      content: "How did I show leadership?" },
    { role: "assistant", content: "Based on your work data, you showed..." },
    { role: "user",      content: "Make it more concise and focus on Q3" }  ← NEW
  ]
```

Claude has full conversation context — it knows what "it" and "Q3" refer to.

### D4. Sliding Window for Long Conversations

After ~20 messages, keep only the most recent ones that fit in ~4,000 tokens:

```typescript
function applySlidingWindow(messages: ChatMessage[], maxTokens = 4000): ChatMessage[] {
  let tokenCount = 0;
  const result: ChatMessage[] = [];
  
  // Work backwards from most recent
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = Math.ceil(messages[i].content.length / 4);
    if (tokenCount + tokens > maxTokens) break;
    tokenCount += tokens;
    result.unshift(messages[i]);
  }
  
  return result;
}
```

---

## Part E: Monthly Summary Cron Job

New file: `server/src/jobs/monthlySummaryJob.ts`

```typescript
// Runs on the 1st of every month at 2:00 AM
// 1. Find all users who have work logs for the previous month
// 2. For each user, check if a summary already exists
// 3. If not, generate one using Claude
// 4. Store in monthly_summaries table

import cron from 'node-cron';

class MonthlySummaryJob {
  start(): void {
    // Run on 1st of every month at 2 AM
    cron.schedule('0 2 1 * *', () => this.generateAllSummaries());
  }

  async generateAllSummaries(): Promise<void> {
    const lastMonth = getPreviousMonth(); // e.g., '2025-04-01'
    
    // Find users with entries in that month but no summary
    const { data: users } = await supabase
      .from('work_log_entries')
      .select('user_id')
      .gte('week_start_date', lastMonth)
      .lt('week_start_date', getNextMonth(lastMonth));
    
    const uniqueUserIds = [...new Set(users?.map(u => u.user_id))];
    
    for (const userId of uniqueUserIds) {
      await generateMonthlySummary(userId, lastMonth);
    }
  }
}
```

---

## Part F: API Design

### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/summaries` | List user's monthly summaries |
| `POST` | `/api/summaries/generate` | Force-generate a specific month's summary |
| `POST` | `/api/chat/sessions` | Create new chat session (picks summaries for range) |
| `GET` | `/api/chat/sessions` | List user's chat sessions |
| `GET` | `/api/chat/sessions/:id/messages` | Get message history |
| `POST` | `/api/chat/sessions/:id/messages` | Send message (streams response via SSE) |
| `DELETE` | `/api/chat/sessions/:id` | Delete a chat session |

### SSE Streaming (for chat responses)

```typescript
// POST /api/chat/sessions/:id/messages
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');

const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 2048,
  system: systemPrompt,        // includes stitched monthly summaries
  messages: conversationHistory // past messages + new one
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    res.write(`data: ${JSON.stringify({ type: 'delta', text: event.delta.text })}\n\n`);
  }
}
res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
res.end();
```

---

## Part G: Complete File List

| Layer | File | Action | Purpose |
|-------|------|--------|---------|
| **DB** | `migrations/001_monthly_summaries_and_chat.sql` | CREATE | All 3 new tables |
| **Shared** | `shared/src/index.ts` | MODIFY | Add new types |
| **Server** | `server/src/lib/summaryService.ts` | CREATE | Monthly summary generation logic |
| **Server** | `server/src/lib/chatService.ts` | CREATE | Context stitching + sliding window |
| **Server** | `server/src/routes/summaries.ts` | CREATE | Summary CRUD endpoints |
| **Server** | `server/src/routes/chat.ts` | CREATE | Chat session + message endpoints |
| **Server** | `server/src/routes/entries.ts` | MODIFY | Add invalidation hook on create/update/delete |
| **Server** | `server/src/jobs/monthlySummaryJob.ts` | CREATE | Cron job for auto-generation |
| **Server** | `server/src/index.ts` | MODIFY | Register new routes + start cron job |
| **Client** | `client/src/lib/chatApi.ts` | CREATE | Chat + summary API functions |
| **Client** | `client/src/lib/useSSE.ts` | CREATE | SSE streaming hook |
| **Client** | `client/src/pages/Chat.tsx` | CREATE | Main chat page |
| **Client** | `client/src/components/Chat/SessionList.tsx` | CREATE | Chat session sidebar |
| **Client** | `client/src/components/Chat/ChatWindow.tsx` | CREATE | Message display + input |
| **Client** | `client/src/components/Chat/MessageBubble.tsx` | CREATE | Single message component |
| **Client** | `client/src/App.tsx` | MODIFY | Add `/chat` route |

## Part H: Implementation Order

```
Step 1 ─── DB Migration (create tables)
  │
Step 2 ─── Shared Types (MonthlySummary, ChatSession, ChatMessage, etc.)
  │
Step 3 ─── summaryService.ts (AI prompt + generate + store logic)
  │
Step 4 ─── monthlySummaryJob.ts (cron) + entries.ts (invalidation hooks)
  │
Step 5 ─── summaries.ts routes (list/force-generate endpoints)
  │
Step 6 ─── chatService.ts (stitch summaries + sliding window + Claude call)
  │
Step 7 ─── chat.ts routes (sessions CRUD + SSE streaming)
  │
Step 8 ─── index.ts (register routes + start cron)
  │
Step 9 ─── Client API layer (chatApi.ts + useSSE.ts)
  │
Step 10 ── Chat UI components (page + sidebar + window + bubble)
  │
Step 11 ── App.tsx routing + navigation link
```

> **Important:** The existing `/api/appraisal/generate` endpoint stays untouched. The new chat system is a separate, additive feature.
