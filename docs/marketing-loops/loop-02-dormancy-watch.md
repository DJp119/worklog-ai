# Loop 02: Dormancy Watch

Identifies users who haven't logged work in 14+ days and sends a re-engagement email.

## Anatomy

| Part | Definition |
|------|------------|
| **Check cadence** | Daily, 10:00 AM UTC |
| **Acts when** | Users exist with `email_verified = true`, no `work_log_entries` in the last 14 days, and haven't been contacted in the last 21 days |
| **Purpose** | Re-engage dormant users before they churn permanently |
| **Skills used** | `churn-prevention` (implicit), `emails` |
| **Loop body** | 1. Query all verified users 2. Find users with no recent entries 3. Cross-reference `marketing_logs` cooldown (21 days) 4. Send re-engagement email 5. Log action |
| **Self-check** | Confirms dormant user count is within normal range (no spike from a tracking bug) |
| **State / idempotency** | `marketing_logs(loop_name='dormancy_watch', user_id)` — 21-day cooldown; also stores dormant-list snapshot |
| **Stop / bail-out** | Disabled via `MARKETING_LOOPS_ENABLED=false`; error-halt on failures |
| **Output** | Email sent via Brevo; dormant list staged to `marketing_logs` with detail payload |

## Automation boundary

- **Autonomous**: Querying dormant users, sending re-engagement email
- **Human review**: None needed (low-risk re-engagement for existing users)

## Source

`server/src/jobs/marketing/dormancyWatch.ts` — cron `0 10 * * *`
