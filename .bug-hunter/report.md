# Bug Hunter Report

- Findings reviewed: 6
- Confirmed: 6
- Dismissed: 0
- Manual review: 0

## Confirmed Bugs
- BUG-1 | Low | server/src/routes/auth.ts | POST /api/auth/reset-password never deletes the consumed token from password_reset_tokens. The SELECT only fetches user_id and expires_at, so resetData.id is undefined; the DELETE then filters by .eq('id', resetData.user_id) which compares the user_id UUID against the tokens.id column — never matches. Stale tokens accumulate in the DB indefinitely.
  Confidence: 92 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Verified by reading auth.ts:566-571 and 597-598. The SELECT clause is `select('user_id, expires_at')`; the DELETE clause is `.eq('id', resetData.user_id)`. Since resetData has no `id` field, .eq() compares the tokens.id column to the user_id UUID. The UUIDs are distinct; PostgREST returns 0 affected rows. Token rows persist after a successful reset. Confirmed real bug. Security impact is bounded by the 1h token expiry, but the cleanup comment is a lie and the DB accumulates stale rows.
- BUG-2 | Low | server/src/lib/email.ts | Translated strings from Google Translate are interpolated unescaped into HTML email bodies. tx() returns the raw translatedText; the htmlBody template literal embeds it via ${...} with no HTML escaping. If the translation contains HTML-like tokens (e.g., for languages with rich punctuation, or in a cache-poisoning scenario), they could break email layout. Most modern email clients strip <script>/on* but allow CSS injection.
  Confidence: 85 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Verified by reading email.ts:29-58 (tx returns raw translatedText) and lines 151-176, 206-230, 268-300 (htmlBody uses unescaped ${...} interpolation). No HTML-escape helper exists in the file. Confirmed for all three email types: verification, password reset, and weekly reminder. Risk is low because Google Translate returns clean text and email clients neutralize active content, but the unescaped interpolation is a defense-in-depth gap.
- BUG-3 | Medium | server/src/middleware/auth.ts | ACCESS_TOKEN_SECRET falls back to a hardcoded literal 'dev-secret-change-in-production' if JWT_SECRET is not set. If an operator deploys without setting JWT_SECRET, all JWTs are signed with a publicly-known string and any attacker can forge access tokens for any userId. The string itself even reads as a TODO.
  Confidence: 95 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Verified by reading middleware/auth.ts:25 verbatim. The literal 'dev-secret-change-in-production' is a hardcoded fallback. Confirmed no fail-fast check exists at server/src/index.ts startup (only SUPABASE_SERVICE_KEY is checked). If JWT_SECRET is unset, the server boots and accepts tokens signed with the known string. Mitigated in practice by the env always being set, but the footgun is a real risk for any future deploy that forgets. Promotes to Critical severity in the event of an accidental un-set, but the bug's static state warrants Medium.
- BUG-4 | Low | server/src/routes/users.ts | PUT /api/users/profile accepts preferred_language as an arbitrary string with no validation against SUPPORTED_EMAIL_LANGS or any other enum. An attacker can store any value (e.g., ../../etc/passwd, <script>alert(1)</script>). The value is used to call Google Translate with target=<lang>; Google will reject invalid codes, but the value also gets read by the cron jobs and could appear in PostHog events or logs.
  Confidence: 80 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Verified by reading users.ts:81 and the upsert at 122-132. No validation of preferred_language against any enum. The value flows to Google Translate (which silently rejects invalid codes), PostHog events, and cron-job queries. No XSS, no SQLi, no privilege escalation. The bug is missing input validation, period — CWE-20.
- BUG-5 | Low | server/src/middleware/auth.ts | requireAuth attaches a Supabase client built with the SERVICE ROLE key to every authenticated request. The codebase currently scopes all queries by req.userId, so the practical risk is low, but any future route handler that uses req.supabase without an explicit user_id filter would bypass RLS and read/write any user's data. This is a defense-in-depth gap (no second line of defense).
  Confidence: 80 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Verified by reading middleware/auth.ts:171-178. The service-role Supabase client is constructed and attached to req.supabase on every authenticated request. All current route handlers scope by req.userId, so no current exploit. The bug is the missing second line of defense — a future handler that forgets to scope would bypass RLS. Promotes to High if such a handler is added; static state warrants Low.
- BUG-6 | Low | server/src/routes/auth.ts | POST /api/auth/refresh hardcodes the new refresh token's TTL to 30 days, ignoring the original login's rememberMe flag. A user who logged in with rememberMe=false (7 days) and then refreshes gets a 30-day refresh token they originally declined.
  Confidence: 95 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Verified by reading auth.ts:368 (tokenExpiryDays = rememberMe ? 30 : 7) and 619-663 (refresh handler ignores this). The refresh_tokens table does not persist the original TTL. The hardcoded 30 at line 647 is the only source. Confirmed: every refresh resets the user's choice. This is a privacy/consent violation, not a security bypass.

## Manual Review
- None

## Dismissed Findings
- None
