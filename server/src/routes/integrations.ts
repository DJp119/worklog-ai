/**
 * server/src/routes/integrations.ts
 *
 * OAuth connect/confirm/disconnect endpoints for JIRA, GitHub, Slack, GitHub App.
 * Follows the GET→POST confirm flow (Bug AO / Bug DK) to prevent OAuth account
 * hijacking through browser-redirect CSRF.
 *
 *   GET   /api/integrations/jira/connect          → 302 to Atlassian 3LO
 *   GET   /api/integrations/jira/callback         → 302 to SPA (code+state)
 *   POST  /api/integrations/jira/confirm          → exchanges code, returns requiresSiteSelection
 *   GET   /api/integrations/jira/sites?key=...    → returns site list (from temp_oauth_states)
 *   POST  /api/integrations/jira/select-site      → saves site selection
 *   GET   /api/integrations/github/connect        → 302 to GitHub
 *   GET   /api/integrations/github/callback       → 302 to SPA
 *   POST  /api/integrations/github/confirm        → exchanges code
 *   POST  /api/integrations/jira/org-connect      → org-level JIRA connect
 *   POST  /api/integrations/jira/org-confirm      → org JIRA confirm
 *   POST  /api/integrations/slack/org-connect     → org Slack connect
 *   POST  /api/integrations/slack/org-callback    → org Slack confirm
 *   POST  /api/integrations/github/app-connect    → org GitHub App connect
 *   POST  /api/integrations/slack/link/start      → request 6-digit PIN
 *   POST  /api/integrations/slack/link/confirm    → confirm PIN
 *
 * Tokens are encrypted at rest with AES-256-GCM (crypto.ts).
 */

import { Router } from 'express'
import crypto from 'crypto'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireOrgRole } from '../services/authz.js'
import {
  encryptSecret,
  makeOAuthState,
  verifyOAuthState,
} from '../lib/crypto.js'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/database.js'
import { isFeatureEnabled } from '../services/subscriptionService.js'
import {
  listAccessibleResources,
  exchangeJiraCode,
  fetchJiraMyself,
} from '../lib/jiraAdapter.js'

export const integrationRoutes = Router()

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const getFrontendUrl = (): string => {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()
}

const JIRA_SCOPES = 'read:jira-work read:jira-user offline_access'
const GITHUB_USER_SCOPES = 'read:user repo'
const SLACK_SCOPES = 'chat:write commands users:read users:read.email'

function buildJiraAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: process.env.JIRA_CLIENT_ID ?? '',
    scope: JIRA_SCOPES,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent',
  })
  return `https://auth.atlassian.com/authorize?${params.toString()}`
}

function buildGitHubAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    state,
    scope: GITHUB_USER_SCOPES,
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

function buildSlackAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    state,
    scope: SLACK_SCOPES,
  })
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

function buildGitHubAppInstallUrl(state: string): string {
  const appSlug = process.env.GITHUB_APP_SLUG ?? 'worklog-ai'
  return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`
}

/**
 * Save a temporary OAuth state keyed by a UUID in `temp_oauth_states`.
 * Returns the UUID key to embed in the redirect URL.
 * (Issue Z fix — avoids JWT bloat in query strings.)
 */
async function putTempOAuth(data: Record<string, any>, ttlMs = 10 * 60 * 1000): Promise<string> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()
  const { data: row, error } = await supabase
    .from('temp_oauth_states')
    .insert({ data, expires_at: expiresAt })
    .select('key')
    .single()
  if (error || !row) throw new Error('Failed to store OAuth state')
  return String(row.key)
}

async function getTempOAuth(key: string): Promise<{ data: any; expires_at: string } | null> {
  const { data, error } = await supabase
    .from('temp_oauth_states')
    .select('data, expires_at')
    .eq('key', key)
    .single()
  if (error || !data) return null
  return data as { data: any; expires_at: string }
}

async function deleteTempOAuth(key: string): Promise<void> {
  await supabase.from('temp_oauth_states').delete().eq('key', key)
}

// ---------------------------------------------------------------------------
// JIRA user-level OAuth flow
// ---------------------------------------------------------------------------

/** POST /api/integrations/jira/connect — initiate user JIRA OAuth */
integrationRoutes.post('/jira/connect', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.JIRA_CLIENT_ID || !process.env.JIRA_CLIENT_SECRET) {
      return res.status(400).json({ success: false, error: 'JIRA integration is not configured on the server. Please set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET in the environment variables.' })
    }
    const stateToken = makeOAuthState({ userId: req.userId!, provider: 'jira', audience: 'jira' })
    const redirectUri = `${getFrontendUrl()}/api/integrations/jira/callback`
    const authUrl = buildJiraAuthUrl(stateToken, redirectUri)
    return res.json({ success: true, data: { authUrl } })
  } catch (err: any) {
    logger.with('err', err).error('POST jira/connect failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/integrations/jira/connect — initiate user JIRA OAuth */
integrationRoutes.get('/jira/connect', requireAuth, async (req: AuthRequest, res) => {
  if (!process.env.JIRA_CLIENT_ID || !process.env.JIRA_CLIENT_SECRET) {
    return res.status(400).send('JIRA integration is not configured on the server. Please set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET in the environment variables.')
  }
  const stateToken = makeOAuthState({ userId: req.userId!, provider: 'jira', audience: 'jira' })
  const redirectUri = `${getFrontendUrl()}/api/integrations/jira/callback`
  res.redirect(buildJiraAuthUrl(stateToken, redirectUri))
})

/** GET /api/integrations/jira/callback — Atlassian redirects here, we forward to SPA */
integrationRoutes.get('/jira/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })
  const params = new URLSearchParams({ provider: 'jira', code: String(code), state: String(state) })
  res.redirect(`${getFrontendUrl()}/integrations?${params.toString()}`)
})

/** POST /api/integrations/jira/confirm — exchanges the code; may return requiresSiteSelection */
integrationRoutes.post('/jira/confirm', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.body as { code?: string; state?: string }
    if (!code || !state) return res.status(400).json({ success: false, error: 'code and state required' })

    const payload = verifyOAuthState(state, 'jira')
    if (!payload || payload.userId !== req.userId! || payload.provider !== 'jira') {
      return res.status(403).json({ success: false, error: 'Invalid or expired state' })
    }

    const tokens = await exchangeJiraCode(code, `${getFrontendUrl()}/api/integrations/jira/callback`)
    const { access_token, refresh_token, expires_in, id_token } = tokens as {
      access_token: string
      refresh_token: string
      expires_in: number
      id_token?: string
    }

    // Bug AM / Bug DL: extract accountId from id_token (or fallback to /myself)
    let jiraAccountId: string | null = null
    if (id_token) {
      try {
        const parts = String(id_token).split('.')
        if (parts.length >= 2) {
          const payloadJson = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
          jiraAccountId = payloadJson.sub ?? payloadJson.account_id ?? null
        }
      } catch (err) {
        logger.with('err', err).warn('Failed to parse JIRA id_token')
      }
    }

    const sites = await listAccessibleResources({ accessToken: access_token })

    if (sites.length === 0) {
      return res.status(400).json({ success: false, error: 'No JIRA sites accessible to this account' })
    }

    // Fallback to /myself if id_token extraction didn't work (Bug AM / Bug DL)
    if (!jiraAccountId && sites.length > 0) {
      try {
        const client = {
          accessToken: access_token,
          cloudId: sites[0].id,
          baseUrl: `https://api.atlassian.com/ex/jira/${sites[0].id}`,
          call: async (method: string, path: string, body?: any) => {
            const url = `https://api.atlassian.com/ex/jira/${sites[0].id}${path.startsWith('/') ? path : '/' + path}`
            const resp = await fetch(url, {
              method,
              headers: {
                Authorization: `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: body ? JSON.stringify(body) : undefined,
            })
            if (!resp.ok) throw new Error(`JIRA myself call failed: ${resp.status}`)
            return resp.json()
          }
        }
        const myself = await fetchJiraMyself(client)
        jiraAccountId = myself.accountId
      } catch (err) {
        logger.with('err', err).warn('Failed to fetch JIRA myself accountId fallback')
      }
    }

    // If only one site, persist immediately; otherwise stash in temp state.
    if (sites.length === 1) {
      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: req.userId!,
          provider: 'jira',
          access_token: encryptSecret(access_token),
          refresh_token: encryptSecret(refresh_token),
          token_expires_at: new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString(),
          is_active: true,
          config: {
            accountId: jiraAccountId,
            cloudId: sites[0].id,
            sites: sites.map((s) => ({ id: s.id, name: s.name, url: s.url })),
          },
        }, { onConflict: 'user_id,provider' })
      if (error) throw error
      return res.json({ success: true, data: { provider: 'jira' } })
    }

    // Multiple sites — store OAuth tokens in temp state (Issue Z fix)
    const key = await putTempOAuth({
      userId: req.userId!,
      provider: 'jira',
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in ?? 3600,
      accountId: jiraAccountId,
      sites,
    })
    return res.json({ success: true, data: { provider: 'jira', requiresSiteSelection: true, key } })
  } catch (err: any) {
    logger.with('err', err).error('POST jira/confirm failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/integrations/jira/sites?key=<UUID> — list sites from temp state */
integrationRoutes.get('/jira/sites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const key = String(req.query.key ?? '')
    if (!key) return res.status(400).json({ success: false, error: 'key required' })

    const cached = await getTempOAuth(key)
    if (!cached || new Date(cached.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'State expired or not found' })
    }
    if (cached.data?.userId !== req.userId!) {
      return res.status(403).json({ success: false, error: 'OAuth state user mismatch' })
    }
    return res.json({ success: true, data: { sites: cached.data.sites } })
  } catch (err: any) {
    logger.with('err', err).error('GET jira/sites failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** POST /api/integrations/jira/select-site — save chosen site to user_integrations */
integrationRoutes.post('/jira/select-site', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { key, cloudId } = req.body as { key?: string; cloudId?: string }
    if (!key || !cloudId) return res.status(400).json({ success: false, error: 'key and cloudId required' })

    const cached = await getTempOAuth(key)
    if (!cached || new Date(cached.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'State expired or not found' })
    }
    if (cached.data?.userId !== req.userId!) {
      return res.status(403).json({ success: false, error: 'OAuth state user mismatch' })
    }
    const chosen = (cached.data.sites as Array<{ id: string; name: string; url: string }>).find(
      (s) => s.id === cloudId,
    )
    if (!chosen) return res.status(400).json({ success: false, error: 'cloudId not in cached sites' })

    const { error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: req.userId!,
        provider: 'jira',
        access_token: encryptSecret(cached.data.accessToken),
        refresh_token: encryptSecret(cached.data.refreshToken),
        token_expires_at: new Date(Date.now() + (cached.data.expiresIn ?? 3600) * 1000).toISOString(),
        is_active: true,
        config: {
          accountId: cached.data.accountId,
          cloudId: chosen.id,
          sites: cached.data.sites,
        },
      }, { onConflict: 'user_id,provider' })
    if (error) throw error
    await deleteTempOAuth(key)
    return res.json({ success: true, data: { provider: 'jira' } })
  } catch (err: any) {
    logger.with('err', err).error('POST jira/select-site failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// GitHub user-level OAuth
// ---------------------------------------------------------------------------

/** POST /api/integrations/github/connect — initiate user GitHub OAuth */
integrationRoutes.post('/github/connect', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      return res.status(400).json({ success: false, error: 'GitHub integration is not configured on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the environment variables.' })
    }
    const stateToken = makeOAuthState({ userId: req.userId!, provider: 'github', audience: 'github' })
    const redirectUri = `${getFrontendUrl()}/api/integrations/github/callback`
    const authUrl = buildGitHubAuthUrl(stateToken, redirectUri)
    return res.json({ success: true, data: { authUrl } })
  } catch (err: any) {
    logger.with('err', err).error('POST github/connect failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/integrations/github/connect — initiate user GitHub OAuth */
integrationRoutes.get('/github/connect', requireAuth, async (req: AuthRequest, res) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.status(400).send('GitHub integration is not configured on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the environment variables.')
  }
  const stateToken = makeOAuthState({ userId: req.userId!, provider: 'github', audience: 'github' })
  const redirectUri = `${getFrontendUrl()}/api/integrations/github/callback`
  res.redirect(buildGitHubAuthUrl(stateToken, redirectUri))
})

/** GET /api/integrations/github/callback — GitHub redirects here, we forward to SPA */
integrationRoutes.get('/github/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })
  const params = new URLSearchParams({ provider: 'github', code: String(code), state: String(state) })
  res.redirect(`${getFrontendUrl()}/integrations?${params.toString()}`)
})

/** POST /api/integrations/github/confirm — exchange GitHub code */
integrationRoutes.post('/github/confirm', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.body as { code?: string; state?: string }
    if (!code || !state) return res.status(400).json({ success: false, error: 'code and state required' })
    const payload = verifyOAuthState(state, 'github')
    if (!payload || payload.userId !== req.userId! || payload.provider !== 'github') {
      return res.status(403).json({ success: false, error: 'Invalid or expired state' })
    }

    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })
    if (!resp.ok) throw new Error(`GitHub token exchange HTTP ${resp.status}`)
    const tok: any = await resp.json()
    if (!tok.access_token) throw new Error('GitHub token exchange failed')

    const userResp = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json' },
    })
    if (!userResp.ok) throw new Error('GitHub user info failed')
    const ghUser: any = await userResp.json()

    const { error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: req.userId!,
        provider: 'github',
        access_token: encryptSecret(tok.access_token),
        refresh_token: null,
        token_expires_at: null,
        is_active: true,
        config: {
          githubId: ghUser.id,
          login: ghUser.login,
          name: ghUser.name ?? null,
          avatarUrl: ghUser.avatar_url ?? null,
        },
      }, { onConflict: 'user_id,provider' })
    if (error) throw error
    return res.json({ success: true, data: { provider: 'github' } })
  } catch (err: any) {
    logger.with('err', err).error('POST github/confirm failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Org-level JIRA (one site per org)
// ---------------------------------------------------------------------------

/** POST /api/integrations/jira/org-connect — initiate org JIRA OAuth */
integrationRoutes.post('/jira/org-connect', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orgId } = req.body as { orgId?: string }
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId required' })

    // Org role check (inline)
    const { getUserOrgRole, orgRoleAtLeast } = await import('../services/authz.js')
    const role = await getUserOrgRole(req.supabase!, req.userId!, orgId)
    if (!role || !orgRoleAtLeast(role, 'admin')) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const integrationsEnabled = await isFeatureEnabled(req.supabase!, orgId, 'integrations')
    if (!integrationsEnabled) {
      return res.status(403).json({ success: false, error: 'Integrations require a Pro plan or higher.', upgradeUrl: '/billing' })
    }

    if (!process.env.JIRA_CLIENT_ID || !process.env.JIRA_CLIENT_SECRET) {
      return res.status(400).json({ success: false, error: 'JIRA integration is not configured on the server. Please set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET in the environment variables.' })
    }

    const stateToken = makeOAuthState({ userId: req.userId!, provider: 'jira_org', orgId, audience: 'jira_org' })
    const redirectUri = `${getFrontendUrl()}/api/integrations/jira/org-callback`
    const authUrl = buildJiraAuthUrl(stateToken, redirectUri)
    return res.json({ success: true, data: { authUrl } })
  } catch (err: any) {
    logger.with('err', err).error('POST jira/org-connect failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/integrations/jira/org-callback — Atlassian redirects here, we forward to SPA */
integrationRoutes.get('/jira/org-callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })
  const params = new URLSearchParams({ code: String(code), state: String(state), provider: 'jira_org' })
  res.redirect(`${getFrontendUrl()}/integrations?${params.toString()}`)
})

/** POST /api/integrations/jira/org-confirm — exchange org JIRA code */
integrationRoutes.post('/jira/org-confirm', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orgId, code, state } = req.body as { orgId?: string; code?: string; state?: string }
    if (!orgId || !code || !state) return res.status(400).json({ success: false, error: 'orgId, code, state required' })

    // Org role check (inline — see jira/org-connect for the why).
    const { getUserOrgRole, orgRoleAtLeast } = await import('../services/authz.js')
    const role = await getUserOrgRole(req.supabase!, req.userId!, orgId)
    if (!role || !orgRoleAtLeast(role, 'admin')) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const payload = verifyOAuthState(state, 'jira_org')
    if (!payload || payload.userId !== req.userId! || payload.provider !== 'jira_org' || payload.orgId !== orgId) {
      return res.status(403).json({ success: false, error: 'Invalid or expired state' })
    }

    const tokens = await exchangeJiraCode(code, `${getFrontendUrl()}/api/integrations/jira/org-callback`)
    const { access_token, refresh_token, expires_in } = tokens as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const sites = await listAccessibleResources({ accessToken: access_token })
    if (sites.length === 0) {
      return res.status(400).json({ success: false, error: 'No JIRA sites accessible' })
    }
    if (sites.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'Multiple JIRA sites available — org-level connection supports one site. Disconnect other site access first.',
      })
    }
    const site = sites[0]

    // Generate a webhook secret (32 random bytes, hex). Stored encrypted;
    // never returned in the response body and never put in the URL — the
    // webhook URL is org_id-only, and JIRA verifies via the
    // x-hub-signature-256 header using the encrypted secret.
    const webhookSecret = crypto.randomBytes(32).toString('hex')

    const { error } = await supabase
      .from('org_integrations')
      .upsert({
        org_id: orgId,
        provider: 'jira',
        external_install_id: site.id,
        access_token_enc: encryptSecret(access_token),
        refresh_token_enc: encryptSecret(refresh_token),
        expires_at: new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString(),
        webhook_secret_enc: encryptSecret(webhookSecret),
        config: {
          cloudId: site.id,
          sites: [{ id: site.id, name: site.name, url: site.url, domain: new URL(site.url).hostname }],
        },
        is_active: true,
        installed_by: req.userId!,
      }, { onConflict: 'org_id,provider' })
    if (error) throw error

    // Webhook URL contains org_id only — JIRA signs the body with the secret
    // server-side via HMAC, and the server resolves the secret by org_id
    // from org_integrations.webhook_secret_enc.
    const webhookUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/webhooks/jira?org_id=${orgId}`
    return res.json({ success: true, data: { provider: 'jira', webhookUrl } })
  } catch (err: any) {
    logger.with('err', err).error('POST jira/org-confirm failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Org-level Slack
// ---------------------------------------------------------------------------

/** POST /api/integrations/slack/org-connect — initiate org Slack OAuth */
integrationRoutes.post('/slack/org-connect', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orgId } = req.body as { orgId?: string }
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId required' })
    // Org role check (inline — see jira/org-connect for the why).
    const { getUserOrgRole, orgRoleAtLeast } = await import('../services/authz.js')
    const role = await getUserOrgRole(req.supabase!, req.userId!, orgId)
    if (!role || !orgRoleAtLeast(role, 'admin')) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const integrationsEnabled = await isFeatureEnabled(req.supabase!, orgId, 'integrations')
    if (!integrationsEnabled) {
      return res.status(403).json({ success: false, error: 'Integrations require a Pro plan or higher.', upgradeUrl: '/billing' })
    }

    if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
      return res.status(400).json({ success: false, error: 'Slack integration is not configured on the server. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in the environment variables.' })
    }

    const stateToken = makeOAuthState({ userId: req.userId!, provider: 'slack_org', orgId, audience: 'slack_org' })
    const redirectUri = `${getFrontendUrl()}/api/integrations/slack/org-callback`
    const authUrl = buildSlackAuthUrl(stateToken, redirectUri)
    return res.json({ success: true, data: { authUrl } })
  } catch (err: any) {
    logger.with('err', err).error('POST slack/org-connect failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/integrations/slack/org-callback — Slack redirects here, we forward to SPA */
integrationRoutes.get('/slack/org-callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })
  const params = new URLSearchParams({ code: String(code), state: String(state), provider: 'slack_org' })
  res.redirect(`${getFrontendUrl()}/integrations?${params.toString()}`)
})

/** POST /api/integrations/slack/org-callback — exchange org Slack code */
integrationRoutes.post('/slack/org-callback', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code, state, orgId } = req.body as { code?: string; state?: string; orgId?: string }
    if (!code || !state) return res.status(400).json({ success: false, error: 'code and state required' })
    const payload = verifyOAuthState(state, 'slack_org')
    if (!payload || payload.userId !== req.userId! || payload.provider !== 'slack_org') {
      return res.status(403).json({ success: false, error: 'Invalid or expired state' })
    }
    const resolvedOrgId = orgId ?? payload.orgId
    if (!resolvedOrgId) return res.status(400).json({ success: false, error: 'orgId required' })
    if (payload.orgId && payload.orgId !== resolvedOrgId) {
      return res.status(403).json({ success: false, error: 'orgId mismatch with state' })
    }

    const orgRole = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', resolvedOrgId)
      .eq('user_id', req.userId!)
      .single()
    if (!orgRole.data || (orgRole.data.role !== 'admin' && orgRole.data.role !== 'owner')) {
      return res.status(403).json({ success: false, error: 'Forbidden — org admin required' })
    }

    const resp = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID ?? '',
        client_secret: process.env.SLACK_CLIENT_SECRET ?? '',
        code,
        redirect_uri: `${getFrontendUrl()}/api/integrations/slack/org-callback`,
      }).toString(),
    })
    if (!resp.ok) throw new Error(`Slack token HTTP ${resp.status}`)
    const tok: any = await resp.json()
    if (!tok.ok) throw new Error(`Slack token exchange failed: ${tok.error}`)
    if (!tok.bot_token || !tok.team?.id) throw new Error('Slack token missing bot_token or team.id')

    const { error } = await supabase
      .from('org_integrations')
      .upsert({
        org_id: resolvedOrgId,
        provider: 'slack',
        external_install_id: String(tok.team.id),
        bot_token_enc: encryptSecret(tok.bot_token),
        access_token_enc: encryptSecret(tok.access_token ?? tok.bot_token),
        refresh_token_enc: null,
        config: {
          teamName: tok.team.name,
          botUserId: tok.bot_user_id,
          scope: tok.scope,
        },
        is_active: true,
        installed_by: req.userId!,
      }, { onConflict: 'org_id,provider' })
    if (error) throw error

    return res.json({ success: true, data: { provider: 'slack' } })
  } catch (err: any) {
    logger.with('err', err).error('POST slack/org-callback failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Org-level GitHub App
// ---------------------------------------------------------------------------

/** POST /api/integrations/github/app-connect — initiate org GitHub App install */
integrationRoutes.post('/github/app-connect', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orgId } = req.body as { orgId?: string }
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId required' })
    // Org role check (inline — see jira/org-connect for the why).
    const { getUserOrgRole, orgRoleAtLeast } = await import('../services/authz.js')
    const role = await getUserOrgRole(req.supabase!, req.userId!, orgId)
    if (!role || !orgRoleAtLeast(role, 'admin')) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const integrationsEnabled = await isFeatureEnabled(req.supabase!, orgId, 'integrations')
    if (!integrationsEnabled) {
      return res.status(403).json({ success: false, error: 'Integrations require a Pro plan or higher.', upgradeUrl: '/billing' })
    }

    const stateToken = makeOAuthState({ userId: req.userId!, provider: 'github_app', orgId, audience: 'github_app' })
    const authUrl = buildGitHubAppInstallUrl(stateToken)
    return res.json({ success: true, data: { authUrl } })
  } catch (err: any) {
    logger.with('err', err).error('POST github/app-connect failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** GET /api/integrations/github/app-callback — GitHub redirects here after install */
integrationRoutes.get('/github/app-callback', requireAuth, async (req: AuthRequest, res) => {
  const { installation_id, setup_action, state } = req.query
  if (!installation_id) return res.status(400).send('Missing installation_id')

  let orgId: string | null = null
  if (state) {
    const payload = verifyOAuthState(String(state), 'github_app')
    if (payload && payload.orgId && payload.userId === req.userId!) {
      orgId = payload.orgId
    }
  }

  if (!orgId) {
    return res.redirect(
      `${getFrontendUrl()}/integrations/link-github?installation_id=${installation_id}`,
    )
  }

  const { error } = await supabase
    .from('org_integrations')
    .upsert({
      org_id: orgId,
      provider: 'github_app',
      external_install_id: String(installation_id),
      is_active: true,
      installed_by: req.userId!,
      config: { setup_action: setup_action ?? null },
    }, { onConflict: 'org_id,provider' })
  if (error) logger.with('err', error).warn('github/app-callback upsert failed')

  return res.redirect(`${getFrontendUrl()}/integrations?github_connected=true`)
})

// ---------------------------------------------------------------------------
// Slack account linking (6-digit PIN — Bug AQ)
// Rate-limited in production: 5 PIN-start + 5 PIN-confirm attempts per
// 15 minutes per IP. The PIN is only 6 digits; without this cap, an
// attacker can enumerate valid codes at 100 req/s and brute-force the
// link in ~3 hours.
// ---------------------------------------------------------------------------
import { Router as _Router } from 'express'
import rateLimit from 'express-rate-limit'

const slackLinkStartLimiter = process.env.NODE_ENV === 'development'
  ? (_req: any, _res: any, next: any) => next()
  : rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, error: 'Too many PIN requests' } })
const slackLinkConfirmLimiter = process.env.NODE_ENV === 'development'
  ? (_req: any, _res: any, next: any) => next()
  : rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, error: 'Too many PIN attempts' } })
void _Router

/** POST /api/integrations/slack/link/start — generate a 6-digit PIN
 * SECURITY (Bug AQ / CRITICAL-#2): use a CSPRNG (`crypto.randomInt`) and
 * persist the email binding. Without these, the PIN is brute-forceable
 * in ~3 hours at 100 req/s and the email binding (Bug O) is dropped.
 */
integrationRoutes.post('/slack/link/start', requireAuth, slackLinkStartLimiter, async (req: AuthRequest, res) => {
  try {
    const { slackTeamId, slackUserId, email } = req.body as {
      slackTeamId?: string
      slackUserId?: string
      email?: string
    }
    if (!slackTeamId || !slackUserId || !email) {
      return res.status(400).json({ success: false, error: 'slackTeamId, slackUserId, email required' })
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
      return res.status(400).json({ success: false, error: 'email format invalid' })
    }

    let code: string = ''
    let inserted = false
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      // CSPRNG — uniformly distributed over [100000, 1000000)
      code = String(crypto.randomInt(100000, 1000000))
      const { error } = await supabase
        .from('temp_slack_codes')
        .upsert(
          {
            slack_team_id: slackTeamId,
            slack_user_id: slackUserId,
            code,
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            email,
          },
          { onConflict: 'slack_team_id,slack_user_id' },
        )
      if (!error) {
        inserted = true
      } else {
        logger.with('err', error).with('attempt', attempt).warn('slack/link/start: insert collision, retrying')
      }
    }
    if (!inserted) {
      return res.status(500).json({ success: false, error: 'Failed to generate unique PIN' })
    }
    return res.json({ success: true, data: { code, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() } })
  } catch (err: any) {
    logger.with('err', err).error('POST slack/link/start failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** POST /api/integrations/slack/link/confirm — confirm the 6-digit PIN
 * SECURITY (Bug O / CRITICAL-#3): the PIN's `email` is now bound to the
 * authenticated user's email. If the authed user is `userB` but the PIN
 * was generated with `userA`'s email, the link is rejected — preventing
 * cross-user Slack identity takeover.
 */
integrationRoutes.post('/slack/link/confirm', requireAuth, slackLinkConfirmLimiter, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body as { code?: string }
    if (!code) return res.status(400).json({ success: false, error: 'code required' })

    const { data: pinRow, error: pinErr } = await supabase
      .from('temp_slack_codes')
      .select('slack_team_id, slack_user_id, email, expires_at')
      .eq('code', code)
      .single()

    if (pinErr || !pinRow) return res.status(400).json({ success: false, error: 'Invalid or expired code' })
    if (new Date(pinRow.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Code expired' })
    }

    // EMAIL BINDING: the PIN is bound to the email supplied at generation.
    // The authed user's email must match.
    const { data: userRow } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.userId!)
      .maybeSingle()
    if (!userRow || !userRow.email) {
      return res.status(403).json({ success: false, error: 'Could not verify your email' })
    }
    if (String(userRow.email).toLowerCase() !== String(pinRow.email).toLowerCase()) {
      logger
        .with('userId', req.userId)
        .with('authedEmail', userRow.email)
        .with('pinEmail', pinRow.email)
        .warn('slack/link/confirm: email binding mismatch — possible takeover attempt')
      return res.status(403).json({ success: false, error: 'PIN was generated for a different email' })
    }

    const { data: existing } = await supabase
      .from('slack_user_links')
      .select('user_id')
      .eq('slack_team_id', pinRow.slack_team_id)
      .eq('slack_user_id', pinRow.slack_user_id)
      .maybeSingle()
    if (existing && existing.user_id !== req.userId!) {
      return res.status(400).json({ success: false, error: 'This Slack account is already linked to another user' })
    }

    const { data: userOrgs } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', req.userId!)
    const orgIds = (userOrgs ?? []).map((o: any) => o.org_id)
    if (orgIds.length === 0) {
      return res.status(403).json({ success: false, error: 'No organization membership found' })
    }
    const { data: validInstall } = await supabase
      .from('org_integrations')
      .select('org_id')
      .eq('provider', 'slack')
      .eq('external_install_id', pinRow.slack_team_id)
      .eq('is_active', true)
      .in('org_id', orgIds)
      .maybeSingle()
    if (!validInstall) {
      return res.status(403).json({ success: false, error: 'Slack workspace is not installed for any of your organizations' })
    }

    // Catch UNIQUE collisions separately so we never leak schema details.
    const { error: linkErr } = await supabase
      .from('slack_user_links')
      .upsert(
        {
          user_id: req.userId!,
          slack_team_id: pinRow.slack_team_id,
          slack_user_id: pinRow.slack_user_id,
        },
        { onConflict: 'slack_team_id,slack_user_id' },
      )
    if (linkErr) {
      if (linkErr.code === '23505') {
        return res.status(409).json({ success: false, error: 'This Slack account is already linked' })
      }
      throw linkErr
    }

    await supabase.from('temp_slack_codes').delete().eq('code', code)

    return res.json({ success: true, data: { ok: true } })
  } catch (err: any) {
    logger.with('err', err).error('POST slack/link/confirm failed')
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// User-level integration listing
// ---------------------------------------------------------------------------

/** GET /api/integrations/user — list current user's integrations */
integrationRoutes.get('/user', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('id, provider, created_at, token_expires_at, is_active, config')
      .eq('user_id', req.userId!)
    if (error) throw error
    const safe = (data ?? []).map((row: any) => ({
      id: row.id,
      provider: row.provider,
      created_at: row.created_at,
      token_expires_at: row.token_expires_at,
      is_active: row.is_active,
      config: row.config
        ? { accountId: row.config.accountId, githubId: row.config.githubId, login: row.config.login, name: row.config.name }
        : null,
    }))
    return res.json({ success: true, data: safe })
  } catch (err: any) {
    logger.with('err', err).error('GET user integrations failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** DELETE /api/integrations/user/:provider — disconnect user integration */
integrationRoutes.delete('/user/:provider', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', req.userId!)
      .eq('provider', req.params.provider)
    if (error) throw error
    return res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE user integration failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

// ---------------------------------------------------------------------------
// Org-level integration listing
// ---------------------------------------------------------------------------

/** GET /api/integrations/org/:orgId — list org integrations (org member+) */
integrationRoutes.get('/org/:orgId', requireAuth, requireOrgRole('member'), async (req: AuthRequest, res) => {
  try {
    // MEDIUM-#21: don't leak `installed_by` to non-admin members. The
    // installer is an admin-only data point. Members only need to know
    // *which* integrations are active, not *who* installed them.
    const { data: callerOrgRole } = await req.supabase!
      .from('org_members')
      .select('role')
      .eq('org_id', req.params.orgId)
      .eq('user_id', req.userId!)
      .maybeSingle()
    const isAdmin = callerOrgRole?.role === 'admin' || callerOrgRole?.role === 'owner'
    const selectCols = isAdmin
      ? 'id, provider, is_active, installed_by, created_at, external_install_id'
      : 'id, provider, is_active, created_at, external_install_id'
    const { data, error } = await supabase
      .from('org_integrations')
      .select(selectCols)
      .eq('org_id', req.params.orgId)
    if (error) throw error
    return res.json({ success: true, data: data ?? [] })
  } catch (err: any) {
    logger.with('err', err).error('GET org integrations failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

/** DELETE /api/integrations/org/:orgId/:provider — disconnect org integration (org admin+) */
integrationRoutes.delete('/org/:orgId/:provider', requireAuth, requireOrgRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { error } = await supabase
      .from('org_integrations')
      .update({ is_active: false })
      .eq('org_id', req.params.orgId)
      .eq('provider', req.params.provider)
    if (error) throw error
    return res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE org integration failed')
    res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})
