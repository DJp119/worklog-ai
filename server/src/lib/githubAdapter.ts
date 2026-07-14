/**
 * server/src/lib/githubAdapter.ts
 *
 * GitHub identity OAuth + GitHub App helpers.
 */

/* eslint-disable no-unused-vars -- interface method parameter names are part of
 * the public type contract; no-unused-vars (default config) doesn't understand
 * TypeScript interface members. tsc covers the actual type safety. */

import type { SupabaseClient } from '@supabase/supabase-js'

const REQUEST_TIMEOUT_MS = 15_000

export interface GithubClient {
  token: string
  call<T = any>(method: string, path: string, body?: any): Promise<T>
  graphql<T = any>(query: string, variables?: Record<string, any>): Promise<T>
}

let _crypto: typeof import('./crypto.js') | null = null
async function getCrypto() {
  if (!_crypto) _crypto = await import('./crypto.js')
  return _crypto
}

function makeClient(token: string): GithubClient {
  return {
    token,
    async call<T = any>(method: string, path: string, body?: any): Promise<T> {
      const resp = await fetch(`https://api.github.com${path.startsWith('/') ? path : '/' + path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        if (resp.status === 404) throw new Error(`GitHub ${method} ${path} → 404 (not found)`)
        throw new Error(`GitHub ${method} ${path} → ${resp.status}: ${txt}`)
      }
      return (await resp.json()) as T
    },
    async graphql<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
      const resp = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`GitHub GraphQL failed: ${resp.status} ${txt}`)
      }
      const data: any = await resp.json()
      if (data.errors?.length) throw new Error(`GitHub GraphQL error: ${JSON.stringify(data.errors)}`)
      return data.data as T
    },
  }
}

export async function getGithubClient(userId: string): Promise<GithubClient> {
  const db: SupabaseClient = (await import('./database.js')).supabase
  const { data, error } = await db
    .from('user_integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'github')
    .eq('is_active', true)
    .single()
  if (error || !data) throw new Error('GitHub not connected for user')
  const { decryptSecret } = await getCrypto()
  return makeClient(decryptSecret(data.access_token))
}

const installationCache = new Map<string, { token: string; expiresAt: number }>()

export async function getGithubAppClient(installationId: string): Promise<GithubClient> {
  const cached = installationCache.get(installationId)
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return makeClient(cached.token)
  }
  const appId = process.env.GITHUB_APP_ID
  const privateKeyPem = process.env.GITHUB_APP_PRIVATE_KEY
  if (!appId || !privateKeyPem) throw new Error('GitHub App env not configured')

  const crypto = await import('crypto')
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iat: now - 30, exp: now + 9 * 60, iss: appId })).toString('base64url')
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKeyPem).toString('base64url')
  const jwt = `${header}.${payload}.${signature}`

  const resp = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`GitHub installation token failed: ${resp.status} ${txt}`)
  }
  const data: any = await resp.json()
  const expiresAt = new Date(data.expires_at).getTime()
  installationCache.set(installationId, { token: data.token, expiresAt })
  return makeClient(data.token)
}

export async function fetchGithubIssue(client: GithubClient, owner: string, repo: string, number: number): Promise<any> {
  return client.call('GET', `/repos/${owner}/${repo}/issues/${number}`)
}

export async function fetchGithubPull(client: GithubClient, owner: string, repo: string, number: number): Promise<any> {
  return client.call('GET', `/repos/${owner}/${repo}/pulls/${number}`)
}

export async function searchGithubPRs(
  client: GithubClient,
  nodeIds: string[],
): Promise<Array<{ id: string; state: string; merged: boolean; title: string; url: string; number: number } | null>> {
  if (nodeIds.length === 0) return []
  const query = `query($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on PullRequest { id state merged title url number }
    }
  }`
  const data = await client.graphql<{ nodes: any[] }>(query, { ids: nodeIds })
  return (data.nodes ?? []).map((n) => (n ? { id: n.id, state: n.state, merged: n.merged, title: n.title, url: n.url, number: n.number } : null))
}

export function parseGithubUrl(url: string): { owner: string; repo: string; number: number; type: 'pr' | 'issue' } {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/i)
  if (!m) throw new Error(`Cannot parse GitHub URL: ${url}`)
  return { owner: m[1], repo: m[2], number: Number(m[4]), type: m[3].toLowerCase() === 'pull' ? 'pr' : 'issue' }
}
