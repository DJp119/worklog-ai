# Bug Hunter Report

- Findings reviewed: 3
- Confirmed: 3
- Dismissed: 0
- Manual review: 0

## Confirmed Bugs
- BUG-7 | Medium | server/src/routes/auth.ts | POST /api/auth/reset-password updates the user's password but does NOT revoke existing refresh tokens. An attacker who had previously stolen a valid refresh token (e.g., via a prior XSS exfiltration of the client's localStorage, or via DB leak) can keep using it indefinitely after the victim resets their password, because the password update does not touch refresh_tokens. Contrast with the in-app change-password flow at users.ts:251-259, which DOES revoke all refresh tokens. The reset-password flow — which is the one invoked in the account-compromise scenario — is strictly less secure than the in-app change-password flow.
  Confidence: 92 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Re-read server/src/routes/auth.ts:552-613 (reset-password) and server/src/routes/users.ts:192-264 (change-password). The reset-password handler at line 587-590 updates users.password_hash and at line 598 deletes the password_reset_tokens row, but never revokes refresh_tokens. The change-password handler at users.ts:251-259 DOES revoke all refresh tokens for the user. The inconsistency is real: the account-compromise recovery path is strictly less secure than the routine change-password path. An attacker who exfiltrated the victim's refreshToken before the compromise retains full account access for the original 7-30 day session, even after the victim resets their password.

**Reachability:** AUTHENTICATED — attacker must already hold a valid (non-revoked) refresh token for the victim.
**Exploitability:** MEDIUM — requires a prior token exfiltration (XSS, device compromise, DB leak) which the threat model already lists as I2.
**CVSS:** CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:L (7.1)
**Proof of Concept:**
- Payload: any active refresh token stolen from the victim (e.g., via XSS exfiltrating localStorage)
- Request: curl -X POST https://api.worklog-ai.com/api/auth/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"<stolen>"}'
- Expected: 401 — the password-reset flow should have revoked this token
- Actual: 200 with a fresh access token; attacker retains full access for the original session TTL even after the victim resets their password
- BUG-8 | Low | server/src/middleware/auth.ts | Refresh tokens are stored in the refresh_tokens table as plaintext (column `token TEXT NOT NULL UNIQUE` in supabase-schema.sql:254). The same is true of password_reset_tokens (supabase-schema.sql:242) and email_verifications (supabase-schema.sql:230). The threat model (`.bug-hunter/threat-model.md:21`) lists these tokens as 'Credentials' alongside password hashes, and S3 in the same document explicitly states password reset tokens are 'stored as bcrypt-hashed at rest' — but the schema and code never hash them. If the database is compromised (SQL injection, backup leak, rogue insider), the attacker can immediately use every stored refresh token to mint new access tokens without needing to crack anything. A mitigation that is documented as in-place is not actually implemented.
  Confidence: 80 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Re-read server/src/middleware/auth.ts:58-95 (createRefreshToken + revokeRefreshToken use plaintext `token` column) and supabase-schema.sql:230, 242, 254 (all three token tables — email_verifications, password_reset_tokens, refresh_tokens — store token as `TEXT NOT NULL` with no hash column). The threat model at .bug-hunter/threat-model.md:21 lists these as Credentials and S3 explicitly states reset tokens are 'stored as bcrypt-hashed at rest' — a documented mitigation that is NOT implemented. DB exfiltration yields every active refresh token in plaintext. The 512-bit entropy on refresh tokens mitigates brute force but does not help with direct exfiltration. CWE-256 is correct; Low severity is appropriate because the attack path requires DB read access (RLS gap, backup leak, insider).

**Reachability:** INTERNAL — only reachable via DB read access.
**Exploitability:** MEDIUM — requires a backup leak, RLS gap, or insider.
**CVSS:** CVSS:3.1/AV:L/AC:H/PR:H/UI:N/S:U/C:H/I:H/A:N (5.7)
- BUG-9 | Low | server/src/middleware/requestId.ts | requestIdMiddleware reads the `x-request-id` header from the client verbatim (line 6) and uses it (a) as the value of the response's `X-Request-Id` header, and (b) as the `requestId` field in the MDC log context, which is then interpolated into every log line emitted during the request. A malicious or misconfigured client can supply newlines, carriage returns, ANSI escape codes, or HTML/script tags in the header. These flow directly into structured log output and into the response header. Log injection (CWE-117) is the primary concern: an attacker can forge log lines that appear to come from other requests, or smuggle terminal escape sequences that alter the operator's log viewer. The response header is a secondary, lower-severity vector (response splitting is blocked by Node's `res.setHeader`, but the value is still echoed to the client).
  Confidence: 75 (high) | INDEPENDENTLY_VERIFIED
  Analysis: Re-read server/src/middleware/requestId.ts:1-16. Line 6 reads `req.headers['x-request-id']` as a string with no validation. The value flows to `res.setHeader('X-Request-Id', requestId)` (line 7) and to the MDC context `{ requestId }` (line 10), which is then consumed by every logger.info/warn/error call in the request lifecycle. Node's `res.setHeader` blocks HTTP response splitting, so the response header echo is low-impact. The MDC path is the real concern: the structured logger interpolates requestId into every log record, so a client can forge newlines, ANSI escape codes, or HTML/script fragments into the log stream. CWE-117 is correct; the attacker requires no auth (any unauthenticated request triggers the logger via the global requestIdMiddleware on server/src/index.ts).

**Reachability:** EXTERNAL — any unauthenticated request to any endpoint.
**Exploitability:** HARD — requires the operator to view logs in a vulnerable terminal/UI.
**CVSS:** CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N (5.3)

## Manual Review
- None

## Dismissed Findings
- None
