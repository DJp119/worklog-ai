# Graph Report - worklog-ai  (2026-07-14)

## Corpus Check
- 100 files · ~64,272 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 878 nodes · 872 edges · 67 communities (65 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e33dace6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_App.tsx|App.tsx]]
- [[_COMMUNITY_PART 1 Backend Testing (Local or Deployed URL)|PART 1: Backend Testing (Local or Deployed URL)]]
- [[_COMMUNITY_Production Deployment Guide|Production Deployment Guide]]
- [[_COMMUNITY_Custom Authentication Migration Guide|Custom Authentication Migration Guide]]
- [[_COMMUNITY_AI Impact Hub - Zero-Cost MVP Plan|AI Impact Hub - Zero-Cost MVP Plan]]
- [[_COMMUNITY_Enterprise Suite Transformation Plan|Enterprise Suite Transformation Plan]]
- [[_COMMUNITY_AI Impact Hub - Implementation Complete (Phase 0)|AI Impact Hub - Implementation Complete (Phase 0)]]
- [[_COMMUNITY_Implementation Plan Pre-Computed Monthly Summaries + AI Chat|Implementation Plan: Pre-Computed Monthly Summaries + AI Chat]]
- [[_COMMUNITY_AI Impact Hub - Complete Implementation|AI Impact Hub - Complete Implementation]]
- [[_COMMUNITY_Env & Secrets Manager|Env & Secrets Manager]]
- [[_COMMUNITY_SKILL|SKILL.md]]
- [[_COMMUNITY_Triage|Triage]]
- [[_COMMUNITY_Hub.tsx|Hub.tsx]]
- [[_COMMUNITY_AI Impact Hub - Implementation Status|AI Impact Hub - Implementation Status]]
- [[_COMMUNITY_SKILL|SKILL.md]]
- [[_COMMUNITY_AI Impact Hub - Phase 0 Implementation Complete|AI Impact Hub - Phase 0 Implementation Complete]]
- [[_COMMUNITY_PostHog Analytics Setup Guide|PostHog Analytics Setup Guide]]
- [[_COMMUNITY_Deployment Steps|Deployment Steps]]
- [[_COMMUNITY_Development Checklist|Development Checklist]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]
- [[_COMMUNITY_AI Pulse Database Deployment Checklist|AI Pulse Database Deployment Checklist]]
- [[_COMMUNITY_Environment Setup Guide|Environment Setup Guide]]
- [[_COMMUNITY_Worklog AI|Worklog AI]]
- [[_COMMUNITY_Credential Rotation Workflow|Credential Rotation Workflow]]
- [[_COMMUNITY_Quick Fix Chat 401 Authentication Errors|Quick Fix: Chat 401 Authentication Errors]]
- [[_COMMUNITY_Server Limitations|Server Limitations]]
- [[_COMMUNITY_Diagnose|Diagnose]]
- [[_COMMUNITY_Process|Process]]
- [[_COMMUNITY_ChatWindow.tsx|ChatWindow.tsx]]
- [[_COMMUNITY_Worklog AI - Complete Technical Documentation|Worklog AI - Complete Technical Documentation]]
- [[_COMMUNITY_main|main]]
- [[_COMMUNITY_CONTEXT.md Format|CONTEXT.md Format]]
- [[_COMMUNITY_SKILL|SKILL.md]]
- [[_COMMUNITY_Writing Skills|Writing Skills]]
- [[_COMMUNITY_Dependency categories|Dependency categories]]
- [[_COMMUNITY_Deployment Environment Variables Checklist|Deployment Environment Variables Checklist]]
- [[_COMMUNITY_During the session|During the session]]
- [[_COMMUNITY_vercel-prepare-output.mjs|vercel-prepare-output.mjs]]
- [[_COMMUNITY_Domain Docs|Domain Docs]]
- [[_COMMUNITY_5. API Reference|5. API Reference]]
- [[_COMMUNITY_7. Deployment Guide|7. Deployment Guide]]
- [[_COMMUNITY_ADR Format|ADR Format]]
- [[_COMMUNITY_Process|Process]]
- [[_COMMUNITY_Issue tracker GitHub|Issue tracker: GitHub]]
- [[_COMMUNITY_8. Security Measures|8. Security Measures]]
- [[_COMMUNITY_Process|Process]]
- [[_COMMUNITY_Language|Language]]
- [[_COMMUNITY_10. Troubleshooting|10. Troubleshooting]]
- [[_COMMUNITY_1. Executive Summary|1. Executive Summary]]
- [[_COMMUNITY_3. Authentication Flow|3. Authentication Flow]]
- [[_COMMUNITY_4. Database Design|4. Database Design]]
- [[_COMMUNITY_6. Frontend Implementation|6. Frontend Implementation]]
- [[_COMMUNITY_9. Cost Structure|9. Cost Structure]]
- [[_COMMUNITY_Next steps|Next steps]]
- [[_COMMUNITY_hitl-loop.template.sh|hitl-loop.template.sh]]
- [[_COMMUNITY_Appendix A Environment Variables Reference|Appendix A: Environment Variables Reference]]
- [[_COMMUNITY_triage-labels|triage-labels.md]]
- [[_COMMUNITY_test-api.sh|test-api.sh]]

## God Nodes (most connected - your core abstractions)
1. `Worklog AI - Complete Technical Documentation` - 15 edges
2. `Env & Secrets Manager` - 15 edges
3. `PART 1: Backend Testing (Local or Deployed URL)` - 14 edges
4. `Enterprise Suite Transformation Plan` - 14 edges
5. `useAuth()` - 13 edges
6. `Custom Authentication Migration Guide` - 13 edges
7. `Environment Setup Guide` - 13 edges
8. `AI Impact Hub - Complete Implementation` - 13 edges
9. `AI Impact Hub - Implementation Complete (Phase 0)` - 13 edges
10. `PART 2: Frontend Testing` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  client/src/App.tsx → client/src/context/AuthContext.tsx
- `LandingPage()` --calls--> `useAuth()`  [EXTRACTED]
  client/src/components/LandingPage.tsx → client/src/context/AuthContext.tsx
- `AIPulseHub()` --calls--> `useAuth()`  [EXTRACTED]
  client/src/pages/ai-pulse/Hub.tsx → client/src/context/AuthContext.tsx
- `Login()` --calls--> `useAuth()`  [EXTRACTED]
  client/src/pages/Login.tsx → client/src/context/AuthContext.tsx
- `Layout()` --calls--> `useAuth()`  [EXTRACTED]
  client/src/components/Layout.tsx → client/src/context/AuthContext.tsx

## Import Cycles
- None detected.

## Communities (67 total, 2 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.06
Nodes (22): ProtectedRoute(), LandingPage(), Layout(), LayoutProps, AuthContext, AuthContextType, AuthProvider(), useAuth() (+14 more)

### Community 1 - "PART 1: Backend Testing (Local or Deployed URL)"
Cohesion: 0.05
Nodes (41): 10. Generate AI Appraisal, 10. Update Profile, 11. Get Appraisal History, 12. Test Token Refresh, 13. Test Logout, 1. Health Check, 1. Start Client, 2. Signup Flow (+33 more)

### Community 2 - "Production Deployment Guide"
Cohesion: 0.05
Nodes (36): CORS Configuration, CORS Errors, Cost Estimates, Custom Domain Setup, Database Errors, Email Configuration (Resend), Emails Not Sending, Magic Link Not Working (+28 more)

### Community 3 - "Custom Authentication Migration Guide"
Cohesion: 0.06
Nodes (34): 1. Database Migration, 1. Health Check, 2. Environment Variables, 2. Signup, 3. Brevo Setup (Free Tier), 3. Verify Email, 4. Install Dependencies, 4. Login (+26 more)

### Community 4 - "AI Impact Hub - Zero-Cost MVP Plan"
Cohesion: 0.06
Nodes (34): 1. Data Ingestion (Replace Paid APIs), 2. AI Summarization (Minimize API Calls), 3. Impact Scoring (No ML Model), 4. SEO Pages (Free Tier on Vercel/Railway), 5. Email Digest (Free Tier), 6. Caching (No Redis Needed), Action Plan: Start Today (Cost: $0), AI Impact Hub - Zero-Cost MVP Plan (+26 more)

### Community 5 - "Enterprise Suite Transformation Plan"
Cohesion: 0.06
Nodes (33): After (Enterprise Suite), AI Drafts vs Raw Activity Display, Appendix A: OAuth Flow (GitHub Example), Appendix B: Data Lineage Example, Before (Current State), Core Pillars, Data Handling, Deliverables: (+25 more)

### Community 6 - "AI Impact Hub - Implementation Complete (Phase 0)"
Cohesion: 0.06
Nodes (31): AI Impact Hub - Implementation Complete (Phase 0), Analytics Dashboard Setup, Analytics & Tracking (Complete), Backend API (Complete), Build Verification, Cost Summary, database migration, Database Schema (Complete) (+23 more)

### Community 7 - "Implementation Plan: Pre-Computed Monthly Summaries + AI Chat"
Cohesion: 0.06
Nodes (30): A1. When Is a Monthly Summary Created?, A2. What Goes INTO the Summary, A3. The AI Prompt for Summary Generation, A4. What the Output Looks Like, A5. Where It's Stored, B1. When Should a Summary Be Regenerated?, B2. How It's Triggered, C1. User Starts a New Chat Session (+22 more)

### Community 8 - "AI Impact Hub - Complete Implementation"
Cohesion: 0.06
Nodes (30): 1. Database Migration, 2. Run Application, 3. Visit, AI Impact Hub - Complete Implementation, Analytics Events, API Authentication, Architecture, Backend API (+22 more)

### Community 9 - "Env & Secrets Manager"
Cohesion: 0.06
Nodes (30): Alerting Strategy, Application Access Patterns, Audit Logging, Best Practices, CI/CD Secret Injection, Cloud-Native Audit Trails, Cloud Secret Store Integration, Common Pitfalls (+22 more)

### Community 10 - "SKILL.md"
Cohesion: 0.06
Nodes (25): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket" (+17 more)

### Community 11 - "Triage"
Cohesion: 0.06
Nodes (28): Bad agent brief, Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Examples, Explicit scope boundaries, Good agent brief (bug), Good agent brief (enhancement) (+20 more)

### Community 12 - "Hub.tsx"
Cohesion: 0.10
Nodes (19): BookmarkBtn(), BookmarkBtnProps, ImpactCard(), ImpactCardProps, impactStyles, SEOHead(), SEOHeadProps, ShareCard() (+11 more)

### Community 13 - "AI Impact Hub - Implementation Status"
Cohesion: 0.09
Nodes (22): 1. Database Migration, 2. Start Development Server, 3. Visit, AI Impact Hub - Implementation Status, Backend, Completed (Phase 0 - Manual MVP), Current Cost (Phase 0), Database (+14 more)

### Community 14 - "SKILL.md"
Cohesion: 0.09
Nodes (17): Deep Modules, Interface Design for Testability, Designing for Mockability, When to Mock, Refactor Candidates, 1. Planning, 2. Tracer Bullet, 3. Incremental Loop (+9 more)

### Community 15 - "AI Impact Hub - Phase 0 Implementation Complete"
Cohesion: 0.10
Nodes (19): 1. Run Database Migration, 2. Restart Server, 3. Verify, AI Impact Hub - Phase 0 Implementation Complete, Backend API, Budget Guardrails, Cost Breakdown (Phase 0), Database Schema (+11 more)

### Community 16 - "PostHog Analytics Setup Guide"
Cohesion: 0.10
Nodes (19): 1. Create a PostHog Account, 2. Get Your API Keys, 3. Configure Environment Variables, 4. Restart Your Development Servers, Client (.env), Client-Side (Automatic), Dashboard & Insights, Events Not Appearing (+11 more)

### Community 17 - "Deployment Steps"
Cohesion: 0.11
Nodes (18): 1. Run Database Migration, 2. Configure Environment Variables (Optional for AI Summaries), 3. Start Development Server, 4. Verify Cron Job, 5. Test RSS Collection (Optional - Manual Trigger), AI Impact Hub - Implementation Plan, Deployment Steps, Executive Summary (+10 more)

### Community 18 - "Development Checklist"
Cohesion: 0.11
Nodes (17): 1. Install Dependencies, 2. Set Up Supabase, 3. Configure Environment Variables, 4. Run Development Servers, API Endpoints, Development Checklist, Pages, Phase 0 - Scaffold ✅ (+9 more)

### Community 19 - "CLAUDE.md"
Cohesion: 0.12
Nodes (13): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, Agent skills, Architecture Overview, Commands, Database Schema (+5 more)

### Community 20 - "AI Pulse Database Deployment Checklist"
Cohesion: 0.12
Nodes (15): AI Pulse Database Deployment Checklist, Alternative: Run Seed File Separately, API still fails after migration, Environment Variables Checklist, Error: "permission denied", Error: "relation already exists", Files Reference, Problem (+7 more)

### Community 21 - "Environment Setup Guide"
Cohesion: 0.12
Nodes (15): Client `.env` (in `client/.env`), Configuration Files, Environment Setup Guide, Features Requiring Optional APIs, Minimum Setup to Run, Quick Start Checklist, Quick Summary, Server `.env` (in `server/.env`) (+7 more)

### Community 22 - "Worklog AI"
Cohesion: 0.14
Nodes (13): Client (.env), Core Loop, Development, Environment Variables, Getting Started, Installation, License, Monorepo Structure (+5 more)

### Community 23 - "Credential Rotation Workflow"
Cohesion: 0.14
Nodes (13): Credential Rotation Workflow, env-secrets-manager reference, Pre-commit Hook Installation, Required Variable Validation Script, Scan Git History (post-incident), Scan Working Tree, Secret Leak Detection, Step 1 — Detect & Confirm (+5 more)

### Community 24 - "Quick Fix: Chat 401 Authentication Errors"
Cohesion: 0.15
Nodes (12): Contact Support, Immediate Fix Steps, Long-Term Solution, Problem, Quick Fix: Chat 401 Authentication Errors, Rollback If Needed, Root Cause, Step 1: Check Server Environment Variables (+4 more)

### Community 25 - "Server Limitations"
Cohesion: 0.17
Nodes (11): 1. Authentication & Security, 2. Rate Limiting & DDoS Protection, 3. Database & Scalability, 4. AI / Chat Service, 5. Email Service, 6. Monitoring & Observability, 7. Background Jobs, 8. Deployment & Infrastructure (+3 more)

### Community 26 - "Diagnose"
Cohesion: 0.17
Nodes (11): Diagnose, Iterate on the loop itself, Non-deterministic bugs, Phase 1 — Build a feedback loop, Phase 2 — Reproduce, Phase 3 — Hypothesise, Phase 4 — Instrument, Phase 5 — Fix + regression test (+3 more)

### Community 27 - "Process"
Cohesion: 0.17
Nodes (11): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the issues to the issue tracker, Acceptance criteria, Blocked by, Parent (+3 more)

### Community 28 - "ChatWindow.tsx"
Cohesion: 0.18
Nodes (3): ChatWindowProps, MessageBubbleProps, SessionListProps

### Community 29 - "Worklog AI - Complete Technical Documentation"
Cohesion: 0.22
Nodes (8): 2.1 High-Level Diagram, 2.2 Data Flow Sequence, 2. System Architecture, Appendix B: Database Migration Scripts, Appendix C: API Testing Examples, Table of Contents, Using curl, Worklog AI - Complete Technical Documentation

### Community 30 - "main"
Cohesion: 0.44
Nodes (8): Namespace, Path, is_candidate(), iter_files(), main(), parse_args(), scan_file(), severity_counts()

### Community 31 - "CONTEXT.md Format"
Cohesion: 0.22
Nodes (6): CONTEXT.md Format, Rules, Single vs multi-context repos, Structure, Domain awareness, File structure

### Community 32 - "SKILL.md"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 33 - "Writing Skills"
Cohesion: 0.22
Nodes (8): Description Requirements, Process, Review Checklist, SKILL.md Template, Skill Structure, When to Add Scripts, When to Split Files, Writing Skills

### Community 34 - "Dependency categories"
Cohesion: 0.25
Nodes (8): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer

### Community 35 - "Deployment Environment Variables Checklist"
Cohesion: 0.29
Nodes (6): Client (Vercel) - Required Variables, Critical Issues to Check:, Deployment Environment Variables Checklist, Server (Render) - Required Variables, Troubleshooting 401 Errors, Troubleshooting Network Errors

### Community 36 - "During the session"
Cohesion: 0.29
Nodes (7): Challenge against the glossary, Cross-reference with code, Discuss concrete scenarios, During the session, Offer ADRs sparingly, Sharpen fuzzy language, Update CONTEXT.md inline

### Community 37 - "vercel-prepare-output.mjs"
Cohesion: 0.33
Nodes (4): candidateSourceDirs, cwd, sourceDir, targetDir

### Community 38 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 39 - "5. API Reference"
Cohesion: 0.33
Nodes (6): 5.1 Authentication Endpoints, 5.2 User Endpoints, 5.3 Work Log Endpoints, 5.4 Appraisal Endpoints, 5.5 Chat & Summaries Endpoints, 5. API Reference

### Community 40 - "7. Deployment Guide"
Cohesion: 0.33
Nodes (6): 7.1 Prerequisites, 7.2 Database Setup, 7.3 Backend Deployment (Render), 7.4 Frontend Deployment (Vercel), 7.5 Post-Deployment Verification, 7. Deployment Guide

### Community 41 - "ADR Format"
Cohesion: 0.33
Nodes (6): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR

### Community 42 - "Process"
Cohesion: 0.33
Nodes (6): 1. Explore, 2. Present candidates, 3. Grilling loop, Glossary, Improve Codebase Architecture, Process

### Community 43 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 44 - "8. Security Measures"
Cohesion: 0.40
Nodes (5): 8.1 Authentication Security, 8.2 Database Security, 8.3 API Security, 8.4 Environment Secrets, 8. Security Measures

### Community 45 - "Process"
Cohesion: 0.40
Nodes (5): 1. Frame the problem space, 2. Spawn sub-agents, 3. Present and compare, Interface Design, Process

### Community 46 - "Language"
Cohesion: 0.40
Nodes (5): Language, Principles, Rejected framings, Relationships, Terms

### Community 47 - "10. Troubleshooting"
Cohesion: 0.50
Nodes (4): 10.1 Common Issues, 10.2 Debugging Steps, 10.3 Support Resources, 10. Troubleshooting

### Community 48 - "1. Executive Summary"
Cohesion: 0.50
Nodes (4): 1.1 Product Overview, 1.2 Technology Stack, 1.3 Business Model, 1. Executive Summary

### Community 49 - "3. Authentication Flow"
Cohesion: 0.50
Nodes (4): 3.1 User Registration, 3.2 Login & Token Generation, 3.3 Token Refresh, 3. Authentication Flow

### Community 50 - "4. Database Design"
Cohesion: 0.50
Nodes (4): 4.1 Schema Overview, 4.2 Detailed Table Schemas, 4.3 Row Level Security (RLS), 4. Database Design

### Community 51 - "6. Frontend Implementation"
Cohesion: 0.50
Nodes (4): 6.1 Component Structure, 6.2 Authentication Context, 6.3 API Client, 6. Frontend Implementation

### Community 52 - "9. Cost Structure"
Cohesion: 0.50
Nodes (4): 9.1 Free Tier (0-100 users), 9.2 Growth Tier (100-1,000 users), 9.3 Revenue Model, 9. Cost Structure

### Community 53 - "Next steps"
Cohesion: 0.50
Nodes (3): Agent skill, Next steps, PostHog post-wizard report

### Community 54 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 56 - "Appendix A: Environment Variables Reference"
Cohesion: 0.67
Nodes (3): Appendix A: Environment Variables Reference, Backend (.env), Frontend (.env)

## Knowledge Gaps
- **584 isolated node(s):** `ChatWindowProps`, `MessageBubbleProps`, `SessionListProps`, `LayoutProps`, `BookmarkBtnProps` (+579 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Worklog AI - Complete Technical Documentation` connect `Worklog AI - Complete Technical Documentation` to `5. API Reference`, `7. Deployment Guide`, `8. Security Measures`, `10. Troubleshooting`, `1. Executive Summary`, `3. Authentication Flow`, `4. Database Design`, `6. Frontend Implementation`, `9. Cost Structure`, `Appendix A: Environment Variables Reference`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `ChatWindowProps`, `MessageBubbleProps`, `SessionListProps` to the rest of the system?**
  _584 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05697278911564626 - nodes in this community are weakly interconnected._
- **Should `PART 1: Backend Testing (Local or Deployed URL)` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `Production Deployment Guide` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Custom Authentication Migration Guide` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `AI Impact Hub - Zero-Cost MVP Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._