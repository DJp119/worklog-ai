# Loop 03: Weekly Marketing Review

Compiles key product and marketing metrics into a single report each Monday.

## Anatomy

| Part | Definition |
|------|------------|
| **Check cadence** | Weekly, Monday 6:00 AM UTC |
| **Acts when** | Always — produces a report every run |
| **Purpose** | Provide a single source of truth for marketing performance week-over-week |
| **Skills used** | `analytics` (implicit) |
| **Loop body** | 1. Count new users (this week vs last week) 2. Count unique active loggers 3. Calculate activation rate (% of verified users with ≥1 entry) 4. Count dormant users (no entry in 14 days) 5. Count marketing emails sent 6. Log report to server log |
| **Self-check** | N/A — always runs |
| **State / idempotency** | No user-level state; report is generated fresh each run |
| **Stop / bail-out** | Disabled via `MARKETING_LOOPS_ENABLED=false`; error-halt on query failures |
| **Output** | Structured JSON report logged via `logger.with('report', report).info()` |

## Metrics

| Metric | Data source | Notes |
|--------|-------------|-------|
| New users (this/last week) | `users` table | Compared WoW for growth signal |
| Active loggers | `work_log_entries` | Unique users who logged in the week |
| Activation rate | `users` + `work_log_entries` | % verified users with any entry ever |
| Dormant users | `users` + `work_log_entries` | No entry in 14 days |
| Marketing emails sent | `marketing_logs` | Total `email_sent` actions in the week |

## Automation boundary

- **Autonomous**: Data collection and report generation
- **Human review**: Read the report (log output); no auto-publishing

## Source

`server/src/jobs/marketing/weeklyReview.ts` — cron `0 6 * * 1`
