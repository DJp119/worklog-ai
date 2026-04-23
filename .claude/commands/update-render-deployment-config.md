---
name: update-render-deployment-config
description: Workflow command scaffold for update-render-deployment-config in worklog-ai.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-render-deployment-config

Use this workflow when working on **update-render-deployment-config** in `worklog-ai`.

## Goal

Update Render deployment configuration, such as build/start commands or Procfile.

## Common Files

- `render.yaml`
- `server/Procfile`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit render.yaml to update build or start commands.
- Optionally edit server/Procfile if process commands change.
- Commit changes to render.yaml and/or Procfile.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.