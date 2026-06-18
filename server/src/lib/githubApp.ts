/**
 * server/src/lib/githubApp.ts
 *
 * GitHub App installation callback helpers.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyOAuthState, makeOAuthState } from './crypto.js'
import { logger } from './logger.js'

const REQUEST_TIMEOUT_MS = 15_000

export interface AppCallbackParams {
  installationId: string
  setupAction: string
  state: string | null
}

export function parseAppCallback(query: Record<string, any>): AppCallbackParams {
  return {
    installationId: String(query.installation_id ?? ''),
    setupAction: String(query.setup_action ?? 'install'),
    state: query.state ? String(query.state) : null,
  }
}

export function getOrgFromState(state: string): { userId: string; orgId: string; provider: string } | null {
  const payload = verifyOAuthState(state)
  if (!payload) return null
  if (payload.provider !== 'github_app') return null
  if (!payload.orgId) return null
  return { userId: payload.userId, orgId: payload.orgId, provider: payload.provider }
}

export function buildAppState(userId: string, orgId: string): string {
  return makeOAuthState({ userId, provider: 'github_app', orgId, audience: 'github_app' })
}

interface InstallationDetails {
  id: number
  target_type: string
  account: { id: number; login: string; type: string; avatar_url?: string }
  permissions?: Record<string, string>
  html_url?: string
}

export async function resolveInstallationOrg(
  installationId: string,
  appJwt: string,
): Promise<{ accountLogin: string; accountType: string; targetType: string }> {
  const resp = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    throw new Error(`GitHub getInstallation failed: ${resp.status} ${t}`)
  }
  const data = (await resp.json()) as InstallationDetails
  if (data.target_type !== 'Organization') {
    throw new Error('Only Organization installations are supported')
  }
  return { accountLogin: data.account.login, accountType: data.account.type, targetType: data.target_type }
}

export async function matchOrgByLogin(db: SupabaseClient, login: string): Promise<string | null> {
  const slug = login.toLowerCase()
  const { data } = await db
    .from('organizations')
    .select('id')
    .ilike('slug', slug)
    .maybeSingle()
  return data?.id ?? null
}

export async function storeInstallation(
  db: SupabaseClient,
  params: {
    orgId: string
    installationId: string
    installedBy: string
    accountLogin: string
    accountType: string
    permissions?: Record<string, string>
    htmlUrl?: string
  },
): Promise<void> {
  const { error } = await db
    .from('org_integrations')
    .upsert(
      {
        org_id: params.orgId,
        provider: 'github_app',
        external_install_id: params.installationId,
        installed_by: params.installedBy,
        is_active: true,
        config: {
          target_type: params.accountType,
          account_login: params.accountLogin,
          permissions: params.permissions ?? {},
          html_url: params.htmlUrl,
        },
      },
      { onConflict: 'org_id,provider' },
    )
  if (error) {
    logger.with('err', error).error('storeInstallation failed')
    throw error
  }
}

export async function uninstallApp(db: SupabaseClient, installationId: string): Promise<void> {
  const { error } = await db
    .from('org_integrations')
    .update({ is_active: false })
    .eq('provider', 'github_app')
    .eq('external_install_id', installationId)
  if (error) throw error
}

export function buildInstallUrl(appSlug: string, state: string): string {
  return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`
}
