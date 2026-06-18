/**
 * server/src/lib/jiraAdapter.ts
 *
 * Atlassian JIRA 3LO client helpers.
 * - getJiraClient / getJiraClientForOrg load + refresh tokens (lock-free)
 * - listAccessibleResources, fetchJiraMyself
 * - getJiraIssue, searchJiraJQL
 * - parseJiraIssueKey
 *
 * All HTTP calls use fetch with AbortSignal.timeout(15s) (Bug R fix).
 */

/* eslint-disable no-unused-vars -- interface method parameter names and
 * function-type-annotation parameters are part of the public type contract;
 * no-unused-vars (default config) doesn't understand TypeScript context.
 * tsc covers the actual type safety. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger.js'

const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token'
const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources'
const REQUEST_TIMEOUT_MS = 15_000

export interface JiraClient {
  accessToken: string
  cloudId: string
  baseUrl: string
  call<T = any>(method: string, path: string, body?: any): Promise<T>
}

class JiraHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function fetchWithTimeout(input: string, init: globalThis.RequestInit = {}) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('JIRA OAuth env not configured')

  const resp = await fetchWithTimeout(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    if (resp.status === 400 || resp.status === 401) {
      throw new JiraHttpError(resp.status, `JIRA refresh rejected (${resp.status}): ${txt}`)
    }
    throw new JiraHttpError(resp.status, `JIRA refresh failed (${resp.status}): ${txt}`)
  }
  const data: any = await resp.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in ?? 3600,
  }
}

/**
 * Lock-free atomic refresh (Bug R/Issue Y — never hold DB tx during network call).
 * Tries to acquire the lock by an atomic UPDATE; retries on contention.
 */
async function withRefreshLock(
  db: SupabaseClient,
  table: 'user_integrations' | 'org_integrations',
  integrationId: string,
  refreshFn: (refreshToken: string) => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>,
  decrypt: (packed: string) => string,
  encrypt: (plain: string) => string,
  isUser: boolean,
): Promise<{ accessToken: string; expiresAt: Date; cloudId?: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    // Lock acquisition: UPDATE only succeeds if either we already hold the
    // lock OR the previous holder's TTL has expired. The atomic CAS prevents
    // two refreshers from clobbering each other (Bug CG / Bug R).
    // We chain .eq filters (AND) rather than .or() because PostgREST .or()
    // syntax with IS NULL and timestamp comparison is unreliable across
    // versions.
    const cutoff = new Date(Date.now() - 30_000).toISOString()
    const lockResp = await db
      .from(table)
      .update({
        is_refreshing: true,
        refresh_started_at: new Date().toISOString(),
      })
      .eq('id', integrationId)
      .eq('is_refreshing', false)
      .select()
      .maybeSingle()

    let row: any = lockResp.data
    let lockAcquired = !lockResp.error && !!row

    if (!lockAcquired) {
      // Try stealing a stale lock (>30s old)
      const steal = await db
        .from(table)
        .update({
          is_refreshing: true,
          refresh_started_at: new Date().toISOString(),
        })
        .eq('id', integrationId)
        .lt('refresh_started_at', cutoff)
        .select()
        .maybeSingle()
      if (!steal.error && steal.data) {
        row = steal.data
        lockAcquired = true
      }
    }

    if (!lockAcquired) {
      // Could not acquire — back off and check if a peer has refreshed
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
      const r2 = await db.from(table).select('access_token,access_token_enc,token_expires_at,config').eq('id', integrationId).maybeSingle()
      if (!r2.error && r2.data) {
        const tokenField = isUser ? r2.data.access_token : r2.data.access_token_enc
        if (r2.data.token_expires_at && new Date(r2.data.token_expires_at) > new Date(Date.now() + 60_000) && tokenField) {
          return {
            accessToken: decrypt(tokenField),
            expiresAt: new Date(r2.data.token_expires_at),
            cloudId: r2.data.config?.cloudId,
          }
        }
      }
      continue
    }

    const refreshTokenEnc = isUser ? row.refresh_token : row.refresh_token_enc
    const acquiredAt = row.refresh_started_at
    if (!refreshTokenEnc) {
      // Only release if WE still hold the lock
      await db.from(table).update({ is_refreshing: false }).eq('id', integrationId).eq('refresh_started_at', acquiredAt)
      throw new Error('No refresh token available')
    }

    let newTokens: { accessToken: string; refreshToken: string; expiresIn: number }
    try {
      newTokens = await refreshFn(decrypt(refreshTokenEnc))
    } catch (err: any) {
      // Only release if WE still own the lock — matches acquisition timestamp
      await db.from(table).update({ is_refreshing: false }).eq('id', integrationId).eq('refresh_started_at', acquiredAt)
      if (err instanceof JiraHttpError && (err.status === 400 || err.status === 401)) {
        await db.from(table).update({ is_active: false }).eq('id', integrationId)
        throw new Error('JIRA refresh token revoked — please reconnect')
      }
      throw err
    }

    const newExpiresAt = new Date(Date.now() + newTokens.expiresIn * 1000)
    let written = false
    // Bug AI: exponential-backoff retry of DB write of the newly-refreshed
    // tokens. The HTTP call to Atlassian has already invalidated the old
    // refresh token (rotating-refresh-token policy). If the DB write fails,
    // we MUST retry until success or we lose the integration. 3 retries over
    // ~1.4s of backoff before giving up.
    for (let i = 0; i < 3 && !written; i++) {
      const payload: Record<string, any> = isUser
        ? { access_token: encrypt(newTokens.accessToken), refresh_token: encrypt(newTokens.refreshToken), token_expires_at: newExpiresAt.toISOString() }
        : { access_token_enc: encrypt(newTokens.accessToken), refresh_token_enc: encrypt(newTokens.refreshToken), expires_at: newExpiresAt.toISOString() }
      payload.is_refreshing = false
      // Atomic release: only write if refresh_started_at still matches our acquisition
      const { error: writeErr } = await db.from(table).update(payload).eq('id', integrationId).eq('refresh_started_at', acquiredAt)
      if (!writeErr) written = true
      else {
        logger.with('err', writeErr).warn(`Token persist retry ${i + 1}`)
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, i)))
      }
    }
    if (!written) {
      // Lock may have been stolen — emergency release if we still own it
      await db.from(table).update({ is_refreshing: false }).eq('id', integrationId).eq('refresh_started_at', acquiredAt)
      throw new Error('Failed to persist refreshed JIRA tokens')
    }
    return {
      accessToken: newTokens.accessToken,
      expiresAt: newExpiresAt,
      cloudId: row.config?.cloudId,
    }
  }
  throw new Error('Could not acquire JIRA refresh lock after retries')
}

let _crypto: typeof import('./crypto.js') | null = null
async function getCrypto() {
  if (!_crypto) _crypto = await import('./crypto.js')
  return _crypto
}

export async function getJiraClient(userId: string, _opts?: { cloudId?: string }): Promise<JiraClient> {
  const db: SupabaseClient = (await import('./database.js')).supabase
  const { data, error } = await db
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_expires_at, config, provider')
    .eq('user_id', userId)
    .eq('provider', 'jira')
    .eq('is_active', true)
    .single()
  if (error || !data) throw new Error('JIRA not connected for user')

  const { encryptSecret, decryptSecret } = await getCrypto()
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : null
  let accessToken = decryptSecret(data.access_token)
  if (!expiresAt || expiresAt.getTime() - Date.now() < 60_000) {
    const refreshed = await withRefreshLock(
      db, 'user_integrations', data.id, refreshAccessToken, decryptSecret, encryptSecret, true,
    )
    accessToken = refreshed.accessToken
  }
  let cloudId = data.config?.cloudId
  if (!cloudId) {
    const sites = await listAccessibleResources({ accessToken })
    if (sites.length === 0) throw new Error('No JIRA cloudId — please reconnect and select a site')
    cloudId = sites[0].id
  }
  return makeClient(accessToken, cloudId)
}

export async function getJiraClientForOrg(orgId: string): Promise<JiraClient> {
  const db: SupabaseClient = (await import('./database.js')).supabase
  const { data, error } = await db
    .from('org_integrations')
    .select('id, access_token_enc, refresh_token_enc, expires_at, config, provider')
    .eq('org_id', orgId)
    .eq('provider', 'jira')
    .eq('is_active', true)
    .single()
  if (error || !data) throw new Error('JIRA not connected for org')

  const { encryptSecret, decryptSecret } = await getCrypto()
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null
  let accessToken = decryptSecret(data.access_token_enc)
  if (!expiresAt || expiresAt.getTime() - Date.now() < 60_000) {
    const refreshed = await withRefreshLock(
      db, 'org_integrations', data.id, refreshAccessToken, decryptSecret, encryptSecret, false,
    )
    accessToken = refreshed.accessToken
  }
  const cloudId = data.config?.cloudId
  if (!cloudId) throw new Error('No JIRA cloudId configured for org')
  return makeClient(accessToken, cloudId)
}

function makeClient(accessToken: string, cloudId: string): JiraClient {
  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`
  return {
    accessToken,
    cloudId,
    baseUrl,
    async call<T = any>(method: string, path: string, body?: any): Promise<T> {
      const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`
      const resp = await fetchWithTimeout(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        if (resp.status === 404) throw new JiraHttpError(404, `JIRA ${method} ${path} → 404 (not found)`)
        throw new JiraHttpError(resp.status, `JIRA ${method} ${path} → ${resp.status}: ${txt}`)
      }
      return (await resp.json()) as T
    },
  }
}

export async function listAccessibleResources(client: { accessToken: string }): Promise<Array<{ id: string; name: string; url: string; avatarUrl?: string; scopes: string[] }>> {
  const resp = await fetchWithTimeout(ATLASSIAN_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${client.accessToken}`, Accept: 'application/json' },
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`accessible-resources failed: ${resp.status} ${txt}`)
  }
  const data: any = await resp.json()
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    avatarUrl: r.avatarUrl,
    scopes: r.scopes ?? [],
  }))
}

export async function fetchJiraMyself(client: JiraClient): Promise<{ accountId: string; displayName: string; emailAddress: string }> {
  const data = await client.call<any>('GET', '/rest/api/3/myself')
  return {
    accountId: data.accountId,
    displayName: data.displayName,
    emailAddress: data.emailAddress,
  }
}

/**
 * Exchange an Atlassian authorization code for access/refresh tokens.
 * Used by both user-level and org-level JIRA connect flows.
 */
export async function exchangeJiraCode(code: string, redirectUri: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  id_token?: string
  scope?: string
}> {
  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('JIRA OAuth env not configured')

  const resp = await fetchWithTimeout(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`JIRA token exchange HTTP ${resp.status}: ${txt}`)
  }
  return (await resp.json()) as any
}

export async function getJiraIssue(client: JiraClient, issueIdOrKey: string): Promise<any> {
  return client.call('GET', `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}?fields=status,summary`)
}

export async function searchJiraJQL(client: JiraClient, jql: string, fields: string[] = ['summary', 'status'], maxResults = 50): Promise<any> {
  const params = new URLSearchParams({ jql, maxResults: String(maxResults), fields: fields.join(',') })
  return client.call('GET', `/rest/api/3/search?${params.toString()}`)
}

export function parseJiraIssueKey(url: string): { issueKey: string; domain?: string } {
  const trimmed = url.trim()
  const m = trimmed.match(/(?:https?:\/\/[\w.-]+\.atlassian\.net)?\/browse\/([A-Z][A-Z0-9_]+-\d+)/i)
  if (m) {
    const domainMatch = trimmed.match(/https?:\/\/([\w.-]+\.atlassian\.net)/i)
    return { issueKey: m[1], domain: domainMatch?.[1] }
  }
  const simple = trimmed.match(/^([A-Z][A-Z0-9_]+-\d+)$/i)
  if (simple) return { issueKey: simple[1] }
  throw new Error(`Cannot parse JIRA issue key from: ${url}`)
}

export { JiraHttpError }
