---
name: update-vercel-deployment-config
description: Workflow command scaffold for update-vercel-deployment-config in worklog-ai.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-vercel-deployment-config

Use this workflow when working on **update-vercel-deployment-config** in `worklog-ai`.

## Goal

Update or fix Vercel deployment configuration, including environment schema, SPA routing, and output directory preparation.

## Common Files

- `vercel.json`
- `client/vercel.json`
- `scripts/vercel-prepare-output.mjs`
- `client/public/scripts/vercel-prepare-output.mjs`
- `client/src/App.tsx`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit vercel.json to update configuration or environment schema.
- Optionally update or create scripts/vercel-prepare-output.mjs or client/public/scripts/vercel-prepare-output.mjs to prepare output directory.
- Edit client/src/App.tsx or client/main.tsx if SPA routing is involved.
- Commit changes to vercel.json and related scripts.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.