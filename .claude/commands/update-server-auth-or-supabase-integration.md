---
name: update-server-auth-or-supabase-integration
description: Workflow command scaffold for update-server-auth-or-supabase-integration in worklog-ai.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-server-auth-or-supabase-integration

Use this workflow when working on **update-server-auth-or-supabase-integration** in `worklog-ai`.

## Goal

Change authentication logic or update Supabase integration in the server, often for logging, error handling, or token refresh.

## Common Files

- `server/src/middleware/auth.ts`
- `server/src/lib/supabase.ts`
- `server/src/index.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit server/src/middleware/auth.ts to update authentication logic.
- Edit server/src/lib/supabase.ts to change Supabase integration or logging.
- Optionally update server/src/index.ts or related route files if needed.
- Commit changes to auth and supabase files.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.