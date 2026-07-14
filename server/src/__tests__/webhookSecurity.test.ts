/**
 * server/src/__tests__/webhookSecurity.test.ts
 *
 * Behavioral tests for the webhook signature verification helpers.
 * These run without a DB or network — they exercise pure functions with
 * pre-computed HMAC vectors.
 *
 * Run: `npx vitest run server/src/__tests__/webhookSecurity.test.ts`
 */

// vi.hoisted runs in vitest's hoisted phase, before the import statements
// are evaluated, so the env vars exist when the module is loaded.
const setupEnv = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-32-chars-or-more-aaaaaaaa'
  process.env.GITHUB_APP_WEBHOOK_SECRET = 'test-github-secret-32-chars-or-more-bbbb'
  process.env.SLACK_SIGNING_SECRET = 'test-slack-secret-32-chars-or-more-cccc'
  process.env.INTEGRATION_ENCRYPTION_KEYS = 'a'.repeat(64) // 32 bytes hex
})
void setupEnv

import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'
import { verifyGithubSignature, verifySlackSignature, verifyJiraWebhookToken } from '../lib/webhookSecurity.js'
import { encryptSecret, decryptSecret } from '../lib/crypto.js'

describe('webhook security: verifyGithubSignature', () => {
  const SECRET = 'test-github-secret-32-chars-or-more-bbbb'
  const raw = Buffer.from('{"action":"opened","zen":"hi"}', 'utf8')
  const valid = 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex')

  it('accepts a valid signature', () => {
    expect(verifyGithubSignature(raw, valid)).toBe(true)
  })

  it('rejects a wrong signature', () => {
    expect(verifyGithubSignature(raw, 'sha256=' + 'a'.repeat(64))).toBe(false)
  })

  it('rejects a missing-prefix signature (DoS vector Bug AJ)', () => {
    const bare = crypto.createHmac('sha256', SECRET).update(raw).digest('hex')
    expect(verifyGithubSignature(raw, bare)).toBe(false)
  })

  it('rejects an empty signature', () => {
    expect(verifyGithubSignature(raw, '')).toBe(false)
  })

  it('rejects undefined signature without throwing', () => {
    expect(() => verifyGithubSignature(raw, undefined as any)).not.toThrow()
    expect(verifyGithubSignature(raw, undefined as any)).toBe(false)
  })

  it('handles a tampered body even with a valid signature header', () => {
    const tampered = Buffer.from('{"action":"closed"}', 'utf8')
    expect(verifyGithubSignature(tampered, valid)).toBe(false)
  })
})

describe('webhook security: verifySlackSignature', () => {
  const SECRET = 'test-slack-secret-32-chars-or-more-cccc'
  const ts = Math.floor(Date.now() / 1000).toString()
  const raw = Buffer.from('token=xxx&team_id=T123', 'utf8')
  const baseString = `v0:${ts}:${raw.toString('utf8')}`
  const valid = 'v0=' + crypto.createHmac('sha256', SECRET).update(baseString).digest('hex')

  it('accepts a valid signature with current timestamp', () => {
    expect(verifySlackSignature(raw, ts, valid)).toBe(true)
  })

  it('rejects a stale timestamp (>5 min skew)', () => {
    const oldTs = (Math.floor(Date.now() / 1000) - 600).toString()
    const oldBase = `v0:${oldTs}:${raw.toString('utf8')}`
    const oldSig = 'v0=' + crypto.createHmac('sha256', SECRET).update(oldBase).digest('hex')
    expect(verifySlackSignature(raw, oldTs, oldSig)).toBe(false)
  })

  it('rejects a future timestamp beyond skew', () => {
    const futureTs = (Math.floor(Date.now() / 1000) + 600).toString()
    const futureBase = `v0:${futureTs}:${raw.toString('utf8')}`
    const futureSig = 'v0=' + crypto.createHmac('sha256', SECRET).update(futureBase).digest('hex')
    expect(verifySlackSignature(raw, futureTs, futureSig)).toBe(false)
  })

  it('rejects a missing v0= prefix', () => {
    const bare = crypto.createHmac('sha256', SECRET).update(baseString).digest('hex')
    expect(verifySlackSignature(raw, ts, bare)).toBe(false)
  })

  it('rejects a non-numeric timestamp without crashing', () => {
    expect(() => verifySlackSignature(raw, 'not-a-number', valid)).not.toThrow()
    expect(verifySlackSignature(raw, 'not-a-number', valid)).toBe(false)
  })
})

describe('webhook security: verifyJiraWebhookToken (token via encrypted secret)', () => {
  const storedPlaintext = 'a'.repeat(64)
  const storedEnc = encryptSecret(storedPlaintext)

  it('accepts the correct token', () => {
    expect(verifyJiraWebhookToken(storedPlaintext, storedEnc)).toBe(true)
  })

  it('rejects a wrong token', () => {
    expect(verifyJiraWebhookToken('b'.repeat(64), storedEnc)).toBe(false)
  })

  it('rejects empty token without crashing', () => {
    expect(verifyJiraWebhookToken('', storedEnc)).toBe(false)
  })
})

describe('crypto: encryptSecret / decryptSecret round-trip', () => {
  it('round-trips a long token', () => {
    const plain = 'xoxb-' + 'a'.repeat(200)
    const enc = encryptSecret(plain)
    expect(enc.startsWith('v1:')).toBe(true)
    expect(decryptSecret(enc)).toBe(plain)
  })

  it('round-trips a unicode token', () => {
    const plain = 'token with é and ñ'
    expect(decryptSecret(encryptSecret(plain))).toBe(plain)
  })

  it('produces a different ciphertext for the same plaintext (random IV)', () => {
    const plain = 'identical input'
    const a = encryptSecret(plain)
    const b = encryptSecret(plain)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe(plain)
    expect(decryptSecret(b)).toBe(plain)
  })

  it('rejects a ciphertext with the wrong version prefix', () => {
    expect(() => decryptSecret('v0:abc:def:ghi:jkl')).toThrow(/Unknown token version/)
  })

  it('rejects a malformed ciphertext (wrong part count)', () => {
    expect(() => decryptSecret('v1:abc:def')).toThrow(/Malformed/)
  })
})
