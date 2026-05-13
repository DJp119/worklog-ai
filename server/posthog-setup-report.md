<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the WorkLog AI server. The `posthog-node` SDK (v5.21.2) was already present; the integration wires up event capture, user identification, and exception tracking across all key API routes.

**Changes made:**

- `src/lib/posthog.ts` — Updated env var from `POSTHOG_KEY` to `POSTHOG_API_KEY`, added `enableExceptionAutocapture: true` to the client constructor, removed unnecessary `flushAt`/`flushInterval` overrides, and added a `captureException()` helper function.
- `src/routes/auth.ts` — Added `user_signed_up` (with `identifyUser`), `email_verified`, `user_logged_in` (with `identifyUser`), `user_logged_out`, `password_reset_requested`, and `password_reset_completed` events. Added `captureException` in all catch blocks.
- `src/routes/entries.ts` — Added `work_log_created`, `work_log_updated`, and `work_log_deleted` events with contextual properties. Added `captureException` in all catch blocks.
- `src/routes/appraisal.ts` — Added `appraisal_generated` (the core conversion event) with `work_log_count`, `word_count`, and period properties. Added `captureException` in the catch block.
- `src/routes/users.ts` — Added `profile_updated` (with updated field names) and `account_deleted` events. Added `captureException` in all catch blocks.
- `src/index.ts` — Imported `captureException`, added a global Express error handler that calls `captureException`, and fixed the startup log message referencing the old env var name.
- `server/.env` — Created with `POSTHOG_API_KEY` and `POSTHOG_HOST` values.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully created a new account | `src/routes/auth.ts` |
| `email_verified` | User verified their email address | `src/routes/auth.ts` |
| `user_logged_in` | User successfully authenticated | `src/routes/auth.ts` |
| `user_logged_out` | User revoked their session token | `src/routes/auth.ts` |
| `password_reset_requested` | User requested a password reset email | `src/routes/auth.ts` |
| `password_reset_completed` | User successfully reset their password via token | `src/routes/auth.ts` |
| `work_log_created` | User created a new weekly work log entry | `src/routes/entries.ts` |
| `work_log_updated` | User updated an existing work log entry | `src/routes/entries.ts` |
| `work_log_deleted` | User deleted a work log entry | `src/routes/entries.ts` |
| `appraisal_generated` | User successfully generated an AI self-appraisal | `src/routes/appraisal.ts` |
| `profile_updated` | User updated their profile information | `src/routes/users.ts` |
| `account_deleted` | User deleted their account and all data | `src/routes/users.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1581202)
- [New Signups Over Time](/insights/pKECdYfw) — weekly signup trend
- [Appraisals Generated](/insights/YPsgbiWA) — core conversion metric over time
- [Weekly Active Users](/insights/uSvFhGkp) — unique users creating work logs per week
- [Signup to Appraisal Conversion Funnel](/insights/kats0hKJ) — drop-off from signup → first log → appraisal
- [Account Deletions (Churn)](/insights/zjLwGzva) — weekly churn bar chart

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
