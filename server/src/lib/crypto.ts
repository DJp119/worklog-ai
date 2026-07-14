/**
 * server/src/lib/crypto.ts
 * AES-256-GCM encryption for OAuth tokens + HMAC-SHA256 state tokens for OAuth CSRF protection.
 * Key format: v1:<sha256_prefix_first_8_hex_chars>:<iv_b64>:<tag_b64>:<ct_b64>
 * Key rotation is position-independent — decrypt searches all keys matching the prefix.
 */

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { logger } from './logger.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set for OAuth state signing')

const MAX_STATE_AGE_MS = 10 * 60 * 1000 // 10 minutes

// --- Key loading and validation ---

function loadKeys(): Map<string, Buffer> {
  const keyList = process.env.INTEGRATION_ENCRYPTION_KEYS ?? process.env.INTEGRATION_ENCRYPTION_KEY ?? ''
  if (!keyList.trim()) throw new Error('INTEGRATION_ENCRYPTION_KEY or INTEGRATION_ENCRYPTION_KEYS must be set')
  const rawKeys = keyList.split(',').map(k => k.trim()).filter(Boolean)
  if (rawKeys.length === 0) throw new Error('No encryption keys found in INTEGRATION_ENCRYPTION_KEYS')

  const keys = new Map<string, Buffer>()
  for (const raw of rawKeys) {
    // SECURITY (Bug #6 / security review): REJECT keys that are not exactly
    // 32 bytes after base64 or hex decode. The previous fallback silently
    // SHA-256-hashed arbitrary strings, which lets operators deploy with
    // a low-entropy key (e.g. "worklog-default") that is publicly computable.
    // Fail fast with a precise error so the operator must supply a strong
    // 32-byte key (64 hex chars OR 44 base64 chars with padding).
    let decoded: Buffer
    const hexMatch = /^[0-9a-fA-F]+$/.test(raw)
    const base64Match = /^[A-Za-z0-9+/]+=*$/.test(raw)

    if (hexMatch) {
      if (raw.length !== 64) {
        throw new Error(
          `Invalid encryption key: hex string must be exactly 64 chars (32 bytes), got ${raw.length}. ` +
          'Generate a key with: openssl rand -hex 32'
        )
      }
      decoded = Buffer.from(raw, 'hex')
    } else if (base64Match) {
      decoded = Buffer.from(raw, 'base64')
      if (decoded.length !== 32) {
        throw new Error(
          `Invalid encryption key: base64 must decode to exactly 32 bytes, got ${decoded.length}. ` +
          'Generate a key with: openssl rand -base64 32'
        )
      }
    } else {
      throw new Error(
        'Invalid encryption key: must be 64 hex chars or 44 base64 chars (32 bytes). ' +
        'Plain strings are NOT accepted — generate a key with: openssl rand -hex 32'
      )
    }

    if (decoded.length !== 32) {
      throw new Error(`Invalid encryption key: must be 32 bytes, got ${decoded.length}`)
    }
    const prefix = crypto.createHash('sha256').update(decoded).digest('hex').slice(0, 8)
    keys.set(prefix, decoded)
    logger.debug('Loaded encryption key with prefix v1:{}', prefix)
  }
  if (keys.size === 0) throw new Error('No valid 32-byte encryption keys found in INTEGRATION_ENCRYPTION_KEYS')
  return keys
}

const KEYS = loadKeys()
const DEFAULT_KEY = KEYS.values().next().value!
const DEFAULT_KEY_PREFIX = crypto.createHash('sha256').update(DEFAULT_KEY).digest('hex').slice(0, 8)

// --- AES-256-GCM encrypt / decrypt ---

/** Encrypt a plaintext string. Returns: v1:<prefix>:<iv_b64>:<tag_b64>:<ct_b64> */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', DEFAULT_KEY, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${DEFAULT_KEY_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/**
 * Decrypt a versioned ciphertext string produced by encryptSecret.
 * Finds the matching key by prefix — position-independent rotation.
 */
export function decryptSecret(packed: string): string {
  if (!packed.startsWith('v1:')) throw new Error('Unknown token version or malformed ciphertext')
  const parts = packed.slice(3).split(':')
  if (parts.length !== 4) throw new Error('Malformed ciphertext — must have 4 parts after v1:')
  const [prefix, ivB64, tagB64, ctB64] = parts

  const key = KEYS.get(prefix)
  if (!key) throw new Error(`No matching encryption key for prefix v1:${prefix}`)

  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct = Buffer.from(ctB64, 'base64')

  if (iv.length !== 12) throw new Error('Invalid IV length (must be 12 bytes)')
  if (tag.length !== 16) throw new Error('Invalid GCM auth tag (must be 16 bytes)')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ct).toString('utf8') + decipher.final('utf8')
}

// --- OAuth state token (HMAC-SHA256 CSRF protection) ---

export interface OAuthStatePayload {
  orgId?: string
  userId: string
  provider: string
  /** The OAuth callback path the flow was initiated from. Used to
   *  prevent a state minted for one callback URL from being replayed
   *  against a different one (Bug CRITICAL-#4). */
  audience: string
  nonce: string
  createdAt: number
}

/**
 * Create a signed, time-limited OAuth state token for the GET → POST confirm flow.
 * Encodes initiating user + target org + the callback audience to
 * prevent cross-tenant hijacking and cross-flow state reuse.
 */
export function makeOAuthState(
  payload: Omit<OAuthStatePayload, 'createdAt' | 'nonce'>,
): string {
  return jwt.sign(
    { ...payload, nonce: crypto.randomBytes(16).toString('hex'), createdAt: Date.now() },
    JWT_SECRET,
    { expiresIn: '10m' },
  )
}

/**
 * Verify and decode a state token. Returns null if expired, tampered,
 * or the `audience` does not match the caller's expected callback.
 */
export function verifyOAuthState(token: string, expectedAudience?: string): OAuthStatePayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as OAuthStatePayload
    if (Date.now() - decoded.createdAt > MAX_STATE_AGE_MS) return null
    if (expectedAudience && decoded.audience !== expectedAudience) return null
    return decoded
  } catch {
    return null
  }
}