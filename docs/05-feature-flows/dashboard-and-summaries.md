# Feature Flow: Dashboard & Summaries

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. What does this feature do?

Displays the user's work log history, streak statistics, and monthly AI-generated summaries. Provides quick actions for creating entries and generating appraisals.

---

## 2. User interaction trace

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant F as Frontend (Dashboard.tsx)
    participant A as API (entriesRoutes, summariesRoutes)
    participant D as Database (work_log_entries, monthly_summaries)

    %% LOAD DASHBOARD
    F->>A: GET /api/entries (Bearer JWT)
    A->>A: requireAuth → req.userId
    A->>D: SELECT * FROM work_log_entries WHERE user_id = req.userId ORDER BY week_start_date DESC
    A-->>F: 200 { success: true, data: WorkLogEntry[] }
    F->>A: GET /api/summaries
    A->>D: SELECT * FROM monthly_summaries WHERE user_id = req.userId ORDER BY month_year DESC
    A-->>F: 200 { success: true, data: MonthlySummary[] }
    F->>B: Renders stats cards, entry list, summary list

    %% STATS CALCULATION (client-side)
    F->>F: Computes total logs, current streak, weeks logged
    Note: Streak = consecutive weeks with entries ending at current/previous week

    %% QUICK ACTIONS
    alt "New Entry"
        U->>F: Clicks "Log Week" → navigates to /log
    else "Generate Appraisal"
        U->>F: Clicks "Generate Appraisal" → navigates to /appraisals
    else "View Summary"
        U->>F: Clicks summary → navigates to /appraisals?summaryId=...
    end

    %% MONTHLY SUMMARY GENERATION (background job)
    participant J as monthlySummaryJob (1st of month)
    J->>D: Find users with entries in previous month
    loop For each user
        J->>D: SELECT entries for month
        J->>A: Call summaryService.generateMonthlySummary(entries)
        J->>A: AI (Mistral/OpenRouter) generates summary
        J->>D: INSERT monthly_summaries
    end
```

---

## 3. Files involved

| File | Responsibility |
|---|---|
| `client/src/pages/Dashboard.tsx` | Stats, entry list, summary list, quick actions |
| `client/src/lib/api.ts` | `getEntries()`, `getSummaries()` |
| `client/src/lib/formatters.ts` | `formatRelativeTime`, `formatWeekRange` |
| `server/src/routes/entries.ts` | `GET /api/entries` |
| `server/src/routes/summaries.ts` | `GET /api/summaries`, `POST /api/summaries/generate` |
| `server/src/lib/summaryService.ts` | `generateMonthlySummary`, `invalidateMonthlySummary` |
| `server/src/jobs/monthlySummaryJob.ts` | Cron: 1st of month, generates summaries |
| `server/src/lib/mistral.ts` | AI client |
| `server/src/lib/openRouter.ts` | AI fallback |

---

## 4. Functions involved (in execution order)

### Dashboard load
1. `Dashboard.tsx` mount → `useEffect` → `getEntries()` + `getSummaries()` → `lib/api.ts`
2. `entriesRoutes.get('/')` → `server/src/routes/entries.ts:14`
3. `summariesRoutes.get('/')` → `server/src/routes/summaries.ts:12`
4. Client computes: `totalLogs = entries.length`, `currentStreak` (consecutive weeks)

### Manual summary generation
1. `Dashboard` "Generate Summary" → `summariesApi.generateSummary(month)` → `lib/api.ts` (not yet implemented, would be `POST /api/summaries/generate`)
2. `summariesRoutes.post('/generate')` → `server/src/routes/summaries.ts:42`
3. `summaryService.generateMonthlySummary(userId, monthYear)` → `lib/summaryService.ts`
4. Fetches entries for month → calls Mistral/OpenRouter → saves to `monthly_summaries`

### Monthly job (1st of month, cron)
1. `monthlySummaryJob.start()` → `server/src/jobs/monthlySummaryJob.ts`
2. For each user with entries in previous month:
   - `summaryService.generateMonthlySummary(userId, monthYear)`
   - AI generates summary → insert `monthly_summaries`

---

## 5. Data transformation

| Stage | Data shape |
|---|---|
| Entries response | `WorkLogEntry[]` (descending by week_start_date) |
| Summaries response | `MonthlySummary[]` (descending by month_year) |
| Client stats | `{ totalLogs, currentStreak, weeksLogged }` |
| Summary generation input | `WorkLogEntry[]` for month |
| AI prompt | Entries formatted as bullet points + "Summarize this month's work" |
| Summary insert | `{ user_id, month_year, summary_text, entry_count, word_count, source_entry_ids, generated_at }` |

---

## 6. Failure scenarios

| Failure point | Behavior |
|---|---|
| No entries | Dashboard shows empty state + "Log your first week" CTA |
| No summaries | Shows "No monthly summaries yet" + "Generate" button |
| AI summary fails | Job logs error; user can trigger manually later |
| 401 on request | `apiRequest` refreshes token → retries |
| Supabase error | 500; shows error toast |

---

## 7. Simple story

Every Monday morning, Maya opens her dashboard:

1. **At a glance**: "12 weeks logged", "Current streak: 3 weeks", "3 monthly summaries"
2. **Recent work**: Last 3 entries with "Week of Jan 15" headers
3. **Monthly recaps**: "January 2026 summary" — click to read AI-generated paragraph
3. **Actions**: "Log this week" → opens entry form; "Generate appraisal" → opens criteria page

Behind the scenes, on the 1st of each month, a background job reads everyone's entries and writes a summary paragraph so Maya doesn't have to.

---

## Related documents

- [Weekly logging flow](./weekly-logging.md)
- [Appraisal flow](./appraisal-generation.md)
- [Summary functions](../04-function-documentation/backend-core-ai.md)
- [Monthly summary job](../04-function-documentation/backend-jobs-infra.md)

## Verification notes

All paths traced from `client/src/pages/Dashboard.tsx`, `server/src/routes/entries.ts`, `server/src/routes/summaries.ts`, `server/src/lib/summaryService.ts`, `server/src/jobs/monthlySummaryJob.ts` at commit `7567207`. Not verified at runtime: AI summary quality, job scheduling reliability.