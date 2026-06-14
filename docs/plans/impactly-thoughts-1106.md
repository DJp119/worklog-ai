# Impactly — Implementation Plan ("Impactly thoughts 1106")

Source: `Impactly thoughts 1106.pdf` (GTM · Pricing · Onboarding · Website, June 2026).
The PDF's THOUGHTS section is strategy (no code). The ACTIONS section drives three code workstreams.

## Confirmed decisions
- **Website changes target the `client/` app only** (its copy matches the PDF exactly). The separate `worklog-marketing/` Next.js site is left untouched.
- **Org-goals alignment = boolean instruction only** (no extra goal-text field collected).
- **Waitlist = real DB table + API** (not mailto placeholder).
- Build order: **C → A → B** (each independently shippable).

## Open items (confirm at implementation time, non-blocking)
1. "AI critique assistant" on Free pricing card — no dedicated paste-a-draft critique feature exists. Default: treat existing `/chat` coach as fulfilling it.
2. Stats bar currently shows 4 stats; PDF names 3. Default: keep 4, swap the two named (leave `100% private` and `5 min/week`).

---

## Workstream C — Website copy (client/ only)

Landing copy lives in `client/src/locales/en/base.json` (components reference i18n keys).
Components: `client/src/components/LandingPage.tsx`, `client/src/components/landing/PainGrid.tsx`, `PlaygroundWidget.tsx`.

### C1. Remove
| Item | Location | Action |
|---|---|---|
| Company logos (Google/Meta/Stripe/Netflix/Uber) | `LandingPage.tsx:17-43` (`BRAND_LOGOS`) + `:209-221` render + `landing.proof.title` | Remove const, the logos `<section>`, unused imports. Leave a comment marking future testimonials slot. |
| "10x RATED THEIR APPRAISAL STRONGER" | `LandingPage.tsx:194-195` + `landing.proof.stat2Label` | Value `10x`→`5 secs`; `stat2Label`→`"appraisal draft"`. |
| "Hybrid AI" | `LandingPage.tsx:202-203` | Value→`20+`; sub-label→`LANGUAGES` (render `20+ LANGUAGES` / sub `SUPPORTED`). |
| "AVERAGE" qualifier | `landing.proof.stat3Label` | "average log entry time" → "log entry time". |

### C2. Update copy (base.json edits)
| Key | From → To |
|---|---|
| `landing.hero.subtitle` (:342) | "what you ship" → "what you accomplish" |
| `landing.hero.ctaPrimary` (:343) | "Start tracking free" → "Start free" |
| `landing.features.okrTitle` (:366) | "OKR mapping" → "Connect your work to company goals" |
| `landing.painGrid.s3Title` (:547) | "Perfect Alignment with Company Values" → "Clear Alignment with Company Values" |
| `landing.painGrid.p3Title` (:539) | "Recency Bias Minimizes Your Wins" → plain-language (e.g. "Your Best Work Gets Forgotten") |
| `landing.features.remindersTitle` (:370) | "Gentle weekly reminders" → "Your data, your control" (value only; keep key name) |

### C3. Playground default
`PlaygroundWidget.tsx:111` `useState("general")` → `useState("engineering")`; reorder `PRESETS` (:26-107) so engineering is first.

### C4. Keep as-is (verify only)
Hero headline (:341), trust signals (:180-186), December Panic / PainGrid, `landing.privacy.title`, `landing.finalCta.subtitle`, playground component.

### C5. i18n
Edit `en/base.json` only; other locales fall back at runtime. Propagation to other languages = optional follow-up.

**Verify:** `npm run dev:client` visual check; `npm run typecheck` + `npm run lint` clean.

---

## Workstream A — Pricing tiers (net-new)

### A1. Pricing section UI
- New `client/src/components/landing/PricingSection.tsx`, rendered in `LandingPage.tsx` (after Features), `#pricing` anchor + header nav link (:101-106).
- Two cards, existing `.glass` / gradient-button design (inline Tailwind, match `PainGrid.tsx`).
- **Free — Individual** (11 bullets per PDF) → CTA "Start free →" / "No credit card required" → `/login`.
- **Paid — Corporate Teams** ("Everything in free" + company goals, trickle-down OKRs, manager goal-setting, JIRA, Slack, more coming) → "$49/mo flat up to 10 users · $3/user/mo beyond 10" → CTA "Join the waitlist →" / "Be the first to access Teams when it launches."
- Strings in new `landing.pricing.*` namespace in `base.json`.

### A2. Waitlist capture
- **DB:** new `waitlist` table (`email`, `created_at`, optional `source`) in `supabase-schema-custom-auth.sql` (canonical — app uses custom auth).
- **Server:** public, rate-limited, email-validated `POST /api/waitlist` → insert; register in `server/src/index.ts`.
- **Client:** `api.joinWaitlist(email)` in `client/src/lib/api.ts`; inline email field on Corporate card with success state.

**Verify:** typecheck/lint; submit waitlist email → confirm Supabase row.

---

## Workstream B — Onboarding flow (largest)

Today: signup hardcodes `name='New User', company='Company', job_title='Developer'` (`Login.tsx:63`), drops user on `/dashboard`. No wizard exists.

### B1. Data model
Add to `user_profiles` (custom-auth schema), all nullable/defaulted:
`first_name`, `industry`, `function`, `years_experience`, `company_size`, `review_frequency`,
`org_goals_alignment BOOLEAN DEFAULT false`, `onboarding_completed BOOLEAN DEFAULT false`.
(`company_name` already exists — reuse for optional free-text.)
Mirror in `shared/src/index.ts` + `client/src/lib/api.ts`; extend `PUT /api/users/profile` (`server/src/routes/users.ts:70`).

### B2. Onboarding screens
New `client/src/pages/Onboarding.tsx` (route `/onboarding`, protected), 2 steps:
- Screen 1: First name (required).
- Screen 2: header "Hi {Name}, fill in the below to personalise your experience" + 7 fields (6 single-select dropdowns with exact PDF option lists/order + optional Company name free text).
- Field options → `client/src/lib/onboardingOptions.ts` (reused by Settings).
- Skip: unobtrusive; leaves `onboarding_completed=false`.
- Finish → `PUT /api/users/profile` (`onboarding_completed=true`) → `/dashboard`.

### B3. Routing gate
`App.tsx` / `ProtectedRoute`: if `onboarding_completed !== true`, redirect to `/onboarding` once.

### B4. Skip nudge banner
`Dashboard.tsx` (reuse banner pattern :195-223): dismissible banner with specific copy (e.g. "Tell us your review frequency so we can remind you at the right time").

### B5. Org-goals toggle + AI wiring
- **Settings:** add org-goals toggle (+ profile selects) to `Settings.tsx`.
- **AI:** when `org_goals_alignment === true`, inject a prompt instruction at `appraisal.ts:167-187` to align accomplishments to company/organisational objectives (boolean only).

**Verify:** new user → forced `/onboarding` → complete → fields persisted in Supabase; skip path → dashboard nudge; toggle on → appraisal reflects alignment instruction; typecheck/lint clean.

---

## Effort estimate
- C ≈ half day (low risk)
- A ≈ 1 day (incl. waitlist)
- B ≈ 2–3 days (DB migration gates the rest)
