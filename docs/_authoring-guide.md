# Documentation Authoring Guide

> Internal guide for everyone (human or AI) extending this documentation set.
> Last updated: 2026-11-27
> Source commit: `7567207`

This guide keeps 50+ documents consistent. Read it before adding or editing a page.

---

## 1. Ground rules

1. **Code is the source of truth.** The root `README.md`, `CLAUDE.md`, and `AGENTS.md` are stale. Never copy architectural claims from them without verifying the implementation.
2. **Never invent behavior.** If a path cannot be traced, label it `Partially verified` or `Not verified`.
3. **Never modify application code.** Documentation changes only.
4. **Never print secrets.** Environment variables are documented by name and purpose, never by value.
5. **Pin evidence.** Every non-obvious claim gets a `path:line` reference. Line numbers refer to commit `7567207`.
6. **Explain twice.** Every complex concept gets a plain-language analogy and a technical explanation.
7. **Trace, don't summarize.** Say which function calls which, with what data, and what happens on failure.

---

## 2. Page metadata

Every page starts with:

```markdown
# Title

> **Status:** Verified | Partially verified | Not verified | Not applicable
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Beginner / Junior / Senior (list all that apply)
```

At the end of each page:

```markdown
---

## Related documents

- [Link](./relative-path.md) — why it is related

## Verification notes

- What was inspected.
- What could not be inspected and why.
```

---

## 3. Function documentation tiers

Every application-defined function appears in `04-function-documentation/function-index.md`.
No function is silently omitted. Depth depends on tier:

### Tier A — full template

Use for route handlers, services, middleware, jobs, contexts, hooks, pages, stateful components, API clients, and non-trivial libraries.

Required sections:

1. Identity (name, file:line, module, type, exported?, async?)
2. Purpose (one sentence)
3. Explain like I am five (analogy)
4. Technical explanation (ordered walkthrough)
5. Inputs table
6. Return value
7. Execution flow (numbered, real)
8. Dependencies
9. Call relationships (who calls it, what it calls)
10. Side effects
11. Error handling (implemented vs unhandled)
12. Real usage example
13. One-line summary

### Tier B — compact template

Use for exported helpers, event handlers, and small components.

Required: identity, purpose, inputs, returns, calls, side effects, failure behavior, one-line summary.

### Tier C — inventory row

Use only for trivial presentational components, one-line helpers, constants, and generated code.

Required columns: name, file:line, kind, one-line purpose, why no deeper writeup is needed.

### Tier assignment rules

- If it touches the database, network, auth, money, or background execution → **Tier A**.
- If it transforms data used by a Tier A function → **Tier B**.
- If it only renders markup or returns a constant → **Tier C**.
- When unsure, promote one tier.

---

## 4. API documentation format

Each endpoint gets a block with:

| Property | Value |
|---|---|
| Method | |
| Path | |
| Auth | |
| Authorization | |
| Middleware | |
| Request body / query | |
| Success response | |
| Status codes | |
| Handler | `file:line` |
| Services / tables | |
| Failure modes | |

Use realistic example payloads derived from the code. Do not invent fields.

---

## 5. Database documentation format

For each table:

- Purpose in one sentence.
- Column table: name, type, nullable, default, references, notes.
- Indexes and constraints.
- RLS policies (and whether they are actually enforced, given the service-role client).
- Writers and readers (function references).
- Migration that created it.

Distinguish **schema declared** from **schema required at runtime**. Some tables exist only in older schema files.

---

## 6. Feature flow format

1. What the user sees.
2. Trigger.
3. Frontend component/handler.
4. API client call.
5. Route + middleware.
6. Service logic.
7. Database/external calls.
8. Response.
9. State update and render.
10. Failure paths.
11. Sequence diagram (Mermaid).
12. Files and functions involved.
13. Simple story.

Only include steps that exist.

---

## 7. Mermaid conventions

- Use `flowchart LR` for data flow, `sequenceDiagram` for request lifecycles, `erDiagram` for tables.
- Quote labels containing punctuation.
- Keep diagrams under ~25 nodes; split larger ones.
- Every diagram gets a plain-language explanation underneath.

---

## 8. Status labels

| Label | Meaning |
|---|---|
| **Verified** | Implementation inspected end to end at the cited lines. |
| **Partially verified** | Main path inspected; some branches or runtime behavior not exercised. |
| **Not verified** | Exists in code but behavior depends on unavailable services/credentials. |
| **Not applicable** | Concept does not exist in this project. |

Never use "complete" as a status.

---

## 9. Evidence and line numbers

- Cite ranges for blocks: `server/src/routes/auth.ts:326-410`.
- Cite a single line for a specific check: `server/src/index.ts:115`.
- If a file is generated, say so and cite the generator.
- If code moved since `7567207`, update the reference and note the new commit.

---

## 10. Writing style

- Prefer short sentences and concrete nouns.
- Define a term the first time it appears; add it to the glossary.
- Avoid "handles", "manages", "processes" without saying exactly how.
- Use tables for inventories and numbered lists for execution order.
- Put the beginner explanation before the technical one.
- Never pad a page to look complete.

---

## 11. Coverage bookkeeping

When a page is finished:

1. Add it to `docs/README.md`.
2. Update `docs/DOCUMENTATION_PROGRESS.md`.
3. Update counts in `docs/DOCUMENTATION_COVERAGE.md`.
4. Run the link check.
5. Confirm `git status` shows only `docs/` changes.
