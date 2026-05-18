---
name: enterprise_transformation_plan
description: Plan to transform Worklog AI into enterprise SaaS with GitHub/Jira integrations and human-in-the-loop governance
metadata:
  type: project
  created: 2026-05-18
  status: planned
---

# Enterprise Transformation — Key Decisions

## Core Strategy
Transform from "AI replaces reviews" to **"AI removes admin drag while humans keep decision ownership"**

## Two-Pillar Approach
1. **Integration Hub** - OAuth2 connections to GitHub, Jira, Linear, GitLab, Bitbucket. Auto-fetch commits, PRs, issues → generate draft weekly logs.
2. **Human-in-the-Loop** - AI drafts, user reviews/edits, manager writes final review with evidence citations.

## Implementation Plan Location
Full plan: `docs/enterprise-integration-plan.md`

## Critical Design Decisions
- **Pull architecture** (cron jobs) over webhooks for MVP simplicity
- **GitHub first**, then expand to Jira/Linear
- **AI-drafted structured logs** vs raw activity display
- **90-day source data retention** for GDPR minimization
- **Status field** on work_log_entries: manual, auto-generated, auto-generated-verified, auto-generated-edited

## Success Metrics
- 60% weekly active integrations
- 40% auto-log adoption
- 70% draft verification rate
- -50% time-to-submit (15 min → 7 min)