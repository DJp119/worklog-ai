# Loop 01: Activation Loop

Converts email-verified signups who haven't created a work log entry within 7 days into active users.

## Anatomy

| Part | Definition |
|------|------------|
| **Check cadence** | Weekly, Monday 9:00 AM UTC |
| **Acts when** | Users exist with `email_verified = true`, `created_at > 7 days ago`, and zero `work_log_entries` |
| **Purpose** | Reduce signup-to-first-log dropout |
| **Skills used** | `emails`, onboarding (implicit) |
| **Loop body** | 1. Query stalled users 2. Cross-reference `marketing_logs` for cooldown (7 days) 3. Send re-engagement email 4. Log action to `marketing_logs` |
| **Self-check** | Compares current activation rate vs prior week; skips if rate is already healthy |
| **State / idempotency** | `marketing_logs(loop_name='activation', user_id)` — 7-day cooldown window prevents double-sends |
| **Stop / bail-out** | Env var `MARKETING_LOOPS_ENABLED=false` disables; job halts on any unhandled error |
| **Output** | Email sent via Brevo; action logged to `marketing_logs` |

## Automation boundary

- **Autonomous**: Querying stalled users, sending re-engagement email
- **Human review**: None needed (low-risk, user opted in when signing up)

## Source

`server/src/jobs/marketing/activationLoop.ts` — cron `0 9 * * 1`
